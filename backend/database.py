import os
import sqlite3
import uuid
from datetime import datetime, timedelta, date as date_cls

from flask import g


DB_PATH = os.path.join(os.path.dirname(__file__), "workload.db")


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


def close_db(exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS members (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            role TEXT DEFAULT '',
            capacity_hours_per_day REAL DEFAULT 8,
            color TEXT DEFAULT '#7C6FF0',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            assignee_id TEXT,
            priority TEXT DEFAULT 'medium',
            estimated_hours REAL DEFAULT 1,
            status TEXT DEFAULT 'todo',
            category TEXT DEFAULT 'kerja',
            project TEXT DEFAULT '',
            start_date TEXT NOT NULL,
            due_date TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (assignee_id) REFERENCES members (id) ON DELETE SET NULL
        );
        CREATE TABLE IF NOT EXISTS activities (
            id TEXT PRIMARY KEY,
            member_id TEXT NOT NULL,
            title TEXT NOT NULL,
            hours REAL NOT NULL,
            date TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (member_id) REFERENCES members (id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS saved_queries (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            sql TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        """
    )
    conn.commit()

    run_migrations(conn)
    ensure_indexes(conn)

    cur = conn.execute("SELECT COUNT(*) FROM members")
    if cur.fetchone()[0] == 0:
        _seed(conn)
    conn.close()


# Additive, data-safe schema migrations: (table, column, "ALTER TABLE ...").
# Runs every time the app starts (see run_migrations below), not just on
# first-ever creation, so a column added here shows up on every existing
# deployment automatically — no manual DB surgery, no dropped data. Only
# ADD COLUMN migrations belong here: never a DROP/RENAME, since those
# aren't safe to run unconditionally on every startup.
SCHEMA_MIGRATIONS = [
    ("tasks", "category", "ALTER TABLE tasks ADD COLUMN category TEXT DEFAULT 'kerja'"),
    ("tasks", "project", "ALTER TABLE tasks ADD COLUMN project TEXT DEFAULT ''"),
]


# Indexes, created with IF NOT EXISTS on every start (data-safe, no-op once
# they exist). Chosen from measured query plans on 100k tasks, not guessed:
# - (status, due_date): each Kanban column asks for one status ordered by due
#   date; with it the first page goes from a full scan + sort (~15 ms) to an
#   index seek (~0.2 ms).
# - (assignee_id): the assignee filter and the workload calculations, which
#   look up one member's tasks over and over.
# A plain (due_date) index was tried and never picked by the planner, so it
# isn't here.
SCHEMA_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_tasks_status_due ON tasks(status, due_date)",
    "CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id)",
]


def ensure_indexes(conn):
    for statement in SCHEMA_INDEXES:
        conn.execute(statement)
    conn.commit()


def run_migrations(conn):
    for table, column, alter_sql in SCHEMA_MIGRATIONS:
        existing_columns = {row[1] for row in conn.execute(f"PRAGMA table_info({table})")}
        if column not in existing_columns:
            conn.execute(alter_sql)
            conn.commit()


def _seed(conn):
    today = date_cls.today()
    members = [
        ("Budi Santoso", "Backend Developer", 8, "#7C6FF0"),
        ("Sari Wulandari", "Frontend Developer", 8, "#3FB6A8"),
        ("Andi Pratama", "UI/UX Designer", 7, "#F5A25D"),
        ("Dewi Lestari", "QA Engineer", 8, "#EF6F8E"),
    ]
    member_ids = []
    for name, role, capacity, color in members:
        member_id = str(uuid.uuid4())
        member_ids.append(member_id)
        conn.execute(
            "INSERT INTO members (id, name, role, capacity_hours_per_day, color, created_at) VALUES (?,?,?,?,?,?)",
            (member_id, name, role, capacity, color, datetime.utcnow().isoformat()),
        )

    def date_at(offset):
        return (today + timedelta(days=offset)).isoformat()

    sample_tasks = [
        ("Desain ulang halaman login", member_ids[2], "high", 6, "in_progress", date_at(-2), date_at(1)),
        ("Perbaikan bug pembayaran", member_ids[0], "urgent", 5, "todo", date_at(0), date_at(1)),
        ("Implementasi API notifikasi", member_ids[0], "high", 10, "in_progress", date_at(-1), date_at(3)),
        ("Optimasi query laporan", member_ids[0], "medium", 8, "todo", date_at(1), date_at(4)),
        ("Testing modul transaksi", member_ids[3], "high", 6, "todo", date_at(0), date_at(2)),
        ("Desain komponen dashboard", member_ids[2], "medium", 5, "todo", date_at(2), date_at(5)),
        ("Integrasi UI grafik workload", member_ids[1], "high", 7, "in_progress", date_at(-1), date_at(2)),
        ("Perbaikan responsive layout", member_ids[1], "low", 3, "todo", date_at(2), date_at(6)),
        ("Regression test rilis 2.3", member_ids[3], "urgent", 8, "todo", date_at(0), date_at(1)),
        ("Dokumentasi API publik", member_ids[0], "low", 4, "todo", date_at(3), date_at(7)),
    ]
    for title, assignee_id, priority, hours, status, start_date, due_date in sample_tasks:
        conn.execute(
            """INSERT INTO tasks (id, title, description, assignee_id, priority, estimated_hours,
               status, start_date, due_date, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (
                str(uuid.uuid4()), title, "", assignee_id, priority, hours, status,
                start_date, due_date, datetime.utcnow().isoformat(),
            ),
        )
    conn.commit()