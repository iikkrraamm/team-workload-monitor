"""SQL client: run ad-hoc queries against the app database and keep a
library of saved queries.

Safety model. The app has no login, so an unrestricted SQL box would let
anyone who can reach the site rewrite or drop the data. Therefore:

* By default queries run on a separate connection opened read-only, with an
  authorizer that only lets SELECT (and a few introspection PRAGMAs)
  through. This is enforced by SQLite itself, not by inspecting the text.
* Write statements (INSERT/UPDATE/DELETE/DDL) are only accepted when the
  server is started with SQL_CLIENT_ALLOW_WRITE=1. ATTACH/DETACH stay
  blocked either way, so a query can't reach other database files.
* Every query has a time limit and a row cap.
"""

import math
import os
import sqlite3
import time
import uuid
from datetime import datetime
from pathlib import Path

from flask import Blueprint, jsonify, request

from database import DB_PATH, get_db


sql_bp = Blueprint("sql", __name__)

MAX_ROWS = 1000
TIMEOUT_SECONDS = 5
MAX_SQL_LENGTH = 100_000
MAX_NAME_LENGTH = 120

# PRAGMAs that only read metadata; allowed even in read-only mode.
READ_ONLY_PRAGMAS = {
    "table_info",
    "table_xinfo",
    "table_list",
    "index_list",
    "index_info",
    "index_xinfo",
    "foreign_key_list",
    "database_list",
}

_READ_ONLY_ACTIONS = {
    sqlite3.SQLITE_SELECT,
    sqlite3.SQLITE_READ,
    sqlite3.SQLITE_FUNCTION,
    sqlite3.SQLITE_RECURSIVE,
}


def _allow_write():
    return os.environ.get("SQL_CLIENT_ALLOW_WRITE") == "1"


def _read_only_authorizer(action, arg1, arg2, db_name, source):
    if action in _READ_ONLY_ACTIONS:
        return sqlite3.SQLITE_OK
    if action == sqlite3.SQLITE_PRAGMA and (arg1 or "").lower() in READ_ONLY_PRAGMAS:
        # arg2 is the pragma's argument (a table name, or the assigned
        # value), so it can't tell read from write. That's fine: everything
        # in the whitelist only reports metadata.
        return sqlite3.SQLITE_OK
    return sqlite3.SQLITE_DENY


def _write_authorizer(action, arg1, arg2, db_name, source):
    if action in (sqlite3.SQLITE_ATTACH, sqlite3.SQLITE_DETACH):
        return sqlite3.SQLITE_DENY
    return sqlite3.SQLITE_OK


def _open_connection(allow_write):
    if allow_write:
        conn = sqlite3.connect(DB_PATH)
        conn.set_authorizer(_write_authorizer)
    else:
        conn = sqlite3.connect(Path(DB_PATH).as_uri() + "?mode=ro", uri=True)
        conn.execute("PRAGMA query_only = ON")
        conn.set_authorizer(_read_only_authorizer)
    return conn


def _serialize(value):
    if isinstance(value, bytes):
        return f"<BLOB {len(value)} bytes>"
    if isinstance(value, float) and not math.isfinite(value):
        return str(value)
    return value


def _friendly_error(exc, allow_write):
    message = str(exc)
    lowered = message.lower()
    if "not authorized" in lowered:
        if allow_write:
            return "Query ditolak: ATTACH/DETACH tidak diizinkan."
        return "Query ditolak: mode read-only hanya mengizinkan SELECT."
    if "interrupted" in lowered:
        return f"Query dihentikan karena melebihi batas waktu {TIMEOUT_SECONDS} detik."
    if "one statement at a time" in lowered:
        return "Jalankan satu statement per eksekusi."
    return message


@sql_bp.get("/api/sql/schema")
def schema():
    """Tables and columns for the schema browser, plus the current mode."""
    db = get_db()
    tables = []
    rows = db.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' "
        "AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).fetchall()
    for row in rows:
        columns = [
            {"name": c["name"], "type": c["type"], "pk": bool(c["pk"])}
            for c in db.execute(f'PRAGMA table_info("{row["name"]}")')
        ]
        tables.append({"name": row["name"], "columns": columns})
    return jsonify(
        {"tables": tables, "allow_write": _allow_write(), "max_rows": MAX_ROWS}
    )


@sql_bp.post("/api/sql/execute")
def execute():
    data = request.get_json(force=True, silent=True) or {}
    sql = (data.get("sql") or "").strip()
    if not sql:
        return jsonify({"error": "Query tidak boleh kosong"}), 400
    if len(sql) > MAX_SQL_LENGTH:
        return jsonify({"error": "Query terlalu panjang"}), 400

    allow_write = _allow_write()
    conn = _open_connection(allow_write)
    deadline = time.monotonic() + TIMEOUT_SECONDS
    # Called every N VM instructions; a truthy return aborts the statement.
    conn.set_progress_handler(lambda: time.monotonic() > deadline, 10_000)

    started = time.monotonic()
    try:
        cursor = conn.execute(sql)
        if cursor.description is None:
            conn.commit()
            return jsonify(
                {
                    "columns": [],
                    "rows": [],
                    "row_count": 0,
                    "rows_affected": max(cursor.rowcount, 0),
                    "truncated": False,
                    "elapsed_ms": round((time.monotonic() - started) * 1000, 1),
                }
            )

        columns = [d[0] for d in cursor.description]
        fetched = cursor.fetchmany(MAX_ROWS + 1)
        truncated = len(fetched) > MAX_ROWS
        rows = [[_serialize(v) for v in row] for row in fetched[:MAX_ROWS]]
        if allow_write:
            conn.commit()
        return jsonify(
            {
                "columns": columns,
                "rows": rows,
                "row_count": len(rows),
                "truncated": truncated,
                "elapsed_ms": round((time.monotonic() - started) * 1000, 1),
            }
        )
    except sqlite3.Error as exc:
        conn.rollback()
        return jsonify({"error": _friendly_error(exc, allow_write)}), 400
    finally:
        conn.close()


# --- Saved queries ---------------------------------------------------------


def _saved_row_to_dict(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "sql": row["sql"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _validated_name_sql(data, require_all):
    """Return (name, sql, error). With require_all=False, missing fields stay None."""
    name = data.get("name")
    sql = data.get("sql")
    if name is not None:
        name = str(name).strip()
        if not name:
            return None, None, "Nama query tidak boleh kosong"
        if len(name) > MAX_NAME_LENGTH:
            return None, None, f"Nama query maksimal {MAX_NAME_LENGTH} karakter"
    if sql is not None:
        sql = str(sql).strip()
        if not sql:
            return None, None, "Query tidak boleh kosong"
        if len(sql) > MAX_SQL_LENGTH:
            return None, None, "Query terlalu panjang"
    if require_all and (name is None or sql is None):
        return None, None, "Nama dan query wajib diisi"
    return name, sql, None


@sql_bp.get("/api/sql/queries")
def list_saved_queries():
    rows = get_db().execute(
        "SELECT * FROM saved_queries ORDER BY updated_at DESC"
    ).fetchall()
    return jsonify([_saved_row_to_dict(r) for r in rows])


@sql_bp.post("/api/sql/queries")
def create_saved_query():
    data = request.get_json(force=True, silent=True) or {}
    name, sql, error = _validated_name_sql(data, require_all=True)
    if error:
        return jsonify({"error": error}), 400

    db = get_db()
    query_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    db.execute(
        "INSERT INTO saved_queries (id, name, sql, created_at, updated_at) VALUES (?,?,?,?,?)",
        (query_id, name, sql, now, now),
    )
    db.commit()
    row = db.execute("SELECT * FROM saved_queries WHERE id = ?", (query_id,)).fetchone()
    return jsonify(_saved_row_to_dict(row)), 201


@sql_bp.put("/api/sql/queries/<query_id>")
def update_saved_query(query_id):
    data = request.get_json(force=True, silent=True) or {}
    name, sql, error = _validated_name_sql(data, require_all=False)
    if error:
        return jsonify({"error": error}), 400

    db = get_db()
    row = db.execute("SELECT * FROM saved_queries WHERE id = ?", (query_id,)).fetchone()
    if row is None:
        return jsonify({"error": "Query tidak ditemukan"}), 404

    db.execute(
        "UPDATE saved_queries SET name = ?, sql = ?, updated_at = ? WHERE id = ?",
        (
            name if name is not None else row["name"],
            sql if sql is not None else row["sql"],
            datetime.utcnow().isoformat(),
            query_id,
        ),
    )
    db.commit()
    row = db.execute("SELECT * FROM saved_queries WHERE id = ?", (query_id,)).fetchone()
    return jsonify(_saved_row_to_dict(row))


@sql_bp.delete("/api/sql/queries/<query_id>")
def delete_saved_query(query_id):
    db = get_db()
    cur = db.execute("DELETE FROM saved_queries WHERE id = ?", (query_id,))
    db.commit()
    if cur.rowcount == 0:
        return jsonify({"error": "Query tidak ditemukan"}), 404
    return jsonify({"ok": True})
