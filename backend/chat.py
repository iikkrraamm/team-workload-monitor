import json
import os
import sqlite3
import uuid
from datetime import date, datetime, timedelta

from openai import OpenAI, OpenAIError
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer


class AIError(Exception):
    pass


TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "list_tasks",
            "description": "Cari atau tampilkan tugas. Gunakan saat pengguna menanyakan tugas yang ada atau sebelum perubahan jika judulnya belum jelas.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title_search": {"type": "string", "description": "Kata atau judul tugas yang dicari."},
                    "status": {"type": "string", "enum": ["todo", "in_progress", "done"]},
                    "member_name": {"type": "string", "description": "Nama penanggung jawab."},
                },
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_task",
            "description": "Buat satu tugas. Jika judul belum jelas, tanyakan dulu. Isi start_date jika pengguna menyebut tanggal mulai; jika tidak disebutkan gunakan hari ini. Isi due_date secara terpisah. Jika pengguna meminta tanggal mulai sama dengan deadline, gunakan tanggal yang sama pada keduanya. Jika prioritas tidak disebutkan gunakan medium; jika estimasi jam tidak disebutkan gunakan 1.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "assignee_name": {"type": "string"},
                    "priority": {"type": "string", "enum": ["urgent", "high", "medium", "low"], "default": "medium"},
                    "estimated_hours": {"type": "number", "minimum": 0.1, "default": 1},
                    "start_date": {"type": "string", "description": "Tanggal mulai YYYY-MM-DD; jika tidak disebutkan gunakan hari ini."},
                    "due_date": {"type": "string", "description": "Tanggal YYYY-MM-DD; bila tidak disebutkan gunakan tiga hari dari hari ini."},
                },
                "required": ["title"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_tasks",
            "description": "Buat beberapa tugas sekaligus saat pengguna meminta lebih dari satu tugas. Masukkan semua tugas yang diminta dalam satu pemanggilan, jangan hanya membuat tugas pertama. Isi start_date yang diminta; jika tanggal mulai diminta sama dengan deadline, gunakan tanggal sama pada keduanya. Untuk setiap tugas tanpa tanggal mulai gunakan hari ini; tanpa prioritas gunakan medium; tanpa estimasi gunakan 1 jam.",
            "parameters": {
                "type": "object",
                "properties": {
                    "tasks": {
                        "type": "array",
                        "minItems": 1,
                        "maxItems": 20,
                        "items": {
                            "type": "object",
                            "properties": {
                                "title": {"type": "string"},
                                "description": {"type": "string"},
                                "assignee_name": {"type": "string"},
                                "priority": {"type": "string", "enum": ["urgent", "high", "medium", "low"], "default": "medium"},
                                "estimated_hours": {"type": "number", "minimum": 0.1, "default": 1},
                                "start_date": {"type": "string", "description": "Tanggal mulai YYYY-MM-DD; default hari ini."},
                                "due_date": {"type": "string", "description": "Tanggal YYYY-MM-DD."},
                            },
                            "required": ["title"],
                            "additionalProperties": False,
                        },
                    },
                },
                "required": ["tasks"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_tasks",
            "description": "Perbarui beberapa tugas sekaligus saat pengguna meminta perubahan pada lebih dari satu tugas. Cari task dengan list_tasks dahulu, lalu pakai ID hasil pencarian. Jangan meminta ID kepada user.",
            "parameters": {
                "type": "object",
                "properties": {
                    "tasks": {
                        "type": "array",
                        "minItems": 1,
                        "maxItems": 20,
                        "items": {
                            "type": "object",
                            "properties": {
                                "task_id": {"type": "string", "description": "ID task dari hasil tool list_tasks."},
                                "new_title": {"type": "string"},
                                "description": {"type": "string"},
                                "assignee_name": {"type": "string"},
                                "priority": {"type": "string", "enum": ["urgent", "high", "medium", "low"]},
                                "estimated_hours": {"type": "number", "minimum": 0.1},
                                "start_date": {"type": "string", "description": "Tanggal YYYY-MM-DD."},
                                "due_date": {"type": "string", "description": "Tanggal YYYY-MM-DD."},
                                "status": {"type": "string", "enum": ["todo", "in_progress", "done"]},
                            },
                            "required": ["task_id"],
                            "additionalProperties": False,
                        },
                    },
                },
                "required": ["tasks"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_task_details",
            "description": "Perbarui detail tugas yang sudah ada seperti tanggal mulai, deadline, penanggung jawab, prioritas, estimasi, judul, atau deskripsi. Jika diminta tanggal mulai sama dengan deadline, set start_date dan due_date ke tanggal yang sama.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {"type": "string", "description": "ID task dari hasil tool list_tasks."},
                    "new_title": {"type": "string"},
                    "description": {"type": "string"},
                    "assignee_name": {"type": "string"},
                    "priority": {"type": "string", "enum": ["urgent", "high", "medium", "low"]},
                    "estimated_hours": {"type": "number", "minimum": 0.1},
                    "start_date": {"type": "string", "description": "Tanggal mulai baru dengan format YYYY-MM-DD. Jika diminta sama dengan deadline, isi sama dengan due_date."},
                    "due_date": {"type": "string", "description": "Deadline baru dengan format YYYY-MM-DD."},
                },
                "required": ["task_id"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_task_status",
            "description": "Ubah status tugas: todo belum dimulai, in_progress sedang dikerjakan, done selesai.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {"type": "string", "description": "ID task dari hasil tool list_tasks."},
                    "status": {"type": "string", "enum": ["todo", "in_progress", "done"]},
                },
                "required": ["task_id", "status"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_tasks",
            "description": "Siapkan penghapusan satu atau beberapa task yang sudah ditemukan lewat list_tasks. Gunakan ID dari hasil pencarian; jangan meminta ID, deadline, atau deskripsi kepada user. Penghapusan tetap menunggu konfirmasi user.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_ids": {
                        "type": "array",
                        "items": {"type": "string"},
                        "minItems": 1,
                        "maxItems": 20,
                        "description": "ID task persis seperti hasil tool list_tasks.",
                    },
                },
                "required": ["task_ids"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_workload",
            "description": "Hitung workload anggota atau seluruh tim untuk hari, minggu, atau bulan.",
            "parameters": {
                "type": "object",
                "properties": {
                    "member_name": {"type": "string", "description": "Kosongkan untuk ringkasan seluruh tim."},
                    "period": {"type": "string", "enum": ["day", "week", "month"]},
                },
                "required": ["period"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "save_sql_query",
            "description": "Buat dan simpan query SQLite read-only saat diminta. Gunakan hanya schema yang diberikan.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "sql": {"type": "string", "description": "Satu query SELECT atau WITH ... SELECT."},
                },
                "required": ["name", "sql"],
                "additionalProperties": False,
            },
        },
    },
]


def _make_client():
    api_key = (os.environ.get("OPENAI_API_KEY") or os.environ.get("OLLAMA_TOKEN", "")).strip()
    legacy_ollama_url = os.environ.get("OLLAMA_URL")
    base_url = os.environ.get("OPENAI_BASE_URL") or legacy_ollama_url
    if not api_key and legacy_ollama_url:
        api_key = "ollama"
    if not api_key:
        raise AIError("OPENAI_API_KEY belum dikonfigurasi.")
    model = (os.environ.get("OPENAI_MODEL") or os.environ.get("OLLAMA_MODEL", "gpt-4o-mini")).strip()
    if not model:
        raise AIError("OPENAI_MODEL belum dikonfigurasi.")
    return OpenAI(api_key=api_key, base_url=base_url, timeout=120), model


def _find_member(db, name):
    normalized = name.strip().casefold()
    if not normalized:
        return None
    members = db.execute("SELECT * FROM members ORDER BY name").fetchall()
    exact = [member for member in members if member["name"].casefold() == normalized]
    matches = exact or [member for member in members if normalized in member["name"].casefold()]
    if not matches:
        return None
    return matches[0] if len(matches) == 1 else matches


def _find_task(db, title):
    normalized = title.strip().casefold()
    tasks = db.execute("SELECT * FROM tasks ORDER BY title").fetchall()
    exact = [task for task in tasks if task["title"].casefold() == normalized]
    matches = exact or [task for task in tasks if normalized in task["title"].casefold()]
    if not matches:
        return None
    return matches[0] if len(matches) == 1 else matches


def _task_summary(db, task):
    assignee = None
    if task["assignee_id"]:
        row = db.execute("SELECT name FROM members WHERE id = ?", (task["assignee_id"],)).fetchone()
        assignee = row["name"] if row else None
    return {
        "id": task["id"],
        "title": task["title"],
        "status": task["status"],
        "priority": task["priority"],
        "estimated_hours": task["estimated_hours"],
        "due_date": task["due_date"],
        "assignee": assignee,
    }


def _confirmation_serializer():
    secret = (
        os.environ.get("AI_CHAT_CONFIRMATION_SECRET")
        or os.environ.get("OPENAI_API_KEY")
        or os.environ.get("OLLAMA_TOKEN")
    )
    if not secret:
        raise AIError("AI_CHAT_CONFIRMATION_SECRET belum dikonfigurasi untuk konfirmasi perubahan.")
    return URLSafeTimedSerializer(secret, salt="ai-chat-confirmation-v1")


def _prepare_task_update(db, task_input, known_task_ids=None):
    task_id = task_input.get("task_id")
    if not isinstance(task_id, str) or not task_id:
        return None, None, {"error": "Cari task dengan list_tasks terlebih dahulu."}
    if known_task_ids is not None and task_id not in known_task_ids:
        return None, None, {"error": "Gunakan ID task dari hasil list_tasks pada percakapan ini."}
    task = db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    if not task:
        return None, None, {"error": "Task sudah tidak tersedia. Cari ulang task sebelum mengubahnya."}
    title = task["title"]

    updates = {}
    if "new_title" in task_input:
        updates["title"] = str(task_input["new_title"]).strip()
        if not updates["title"]:
            return None, None, {"error": f'Judul baru untuk "{title}" tidak boleh kosong.'}
    if "description" in task_input:
        updates["description"] = str(task_input["description"])
    if "assignee_name" in task_input:
        member = _find_member(db, task_input["assignee_name"])
        if isinstance(member, list):
            return None, None, {"error": "Nama anggota tidak spesifik.", "candidates": [row["name"] for row in member]}
        if not member:
            return None, None, {"error": f'Anggota "{task_input["assignee_name"]}" tidak ditemukan.'}
        updates["assignee_id"] = member["id"]
    if "priority" in task_input:
        if task_input["priority"] not in {"urgent", "high", "medium", "low"}:
            return None, None, {"error": f'Prioritas task "{title}" tidak valid.'}
        updates["priority"] = task_input["priority"]
    if "estimated_hours" in task_input:
        try:
            hours = float(task_input["estimated_hours"])
        except (TypeError, ValueError):
            return None, None, {"error": f'Estimasi task "{title}" tidak valid.'}
        if hours <= 0:
            return None, None, {"error": f'Estimasi task "{title}" harus lebih dari nol.'}
        updates["estimated_hours"] = hours
    for field, label in (("start_date", "Tanggal mulai"), ("due_date", "Deadline")):
        if field in task_input:
            try:
                updates[field] = date.fromisoformat(task_input[field]).isoformat()
            except (TypeError, ValueError):
                return None, None, {"error": f'{label} task "{title}" tidak valid.'}
    if "status" in task_input:
        if task_input["status"] not in {"todo", "in_progress", "done"}:
            return None, None, {"error": f'Status task "{title}" tidak valid.'}
        updates["status"] = task_input["status"]
    if not updates:
        return None, None, {"error": f'Tidak ada field baru untuk task "{title}".'}
    return task, updates, None


def _display_task_value(db, field, value):
    if field == "assignee_id":
        if not value:
            return "Belum ditentukan"
        member = db.execute("SELECT name FROM members WHERE id = ?", (value,)).fetchone()
        return member["name"] if member else "Anggota tidak ditemukan"
    if value is None or value == "":
        return "(kosong)"
    return str(value)


def _make_update_confirmation(db, prepared_updates):
    entries = []
    items = []
    labels = {
        "title": "Judul",
        "description": "Deskripsi",
        "assignee_id": "Penanggung jawab",
        "priority": "Prioritas",
        "estimated_hours": "Estimasi jam",
        "start_date": "Tanggal mulai",
        "due_date": "Deadline",
        "status": "Status",
    }
    for task, updates in prepared_updates:
        expected = {field: task[field] for field in updates}
        entries.append({"task_id": task["id"], "expected": expected, "updates": updates})
        items.append({
            "title": task["title"],
            "changes": [
                {
                    "field": labels[field],
                    "before": _display_task_value(db, field, task[field]),
                    "after": _display_task_value(db, field, value),
                }
                for field, value in updates.items()
            ],
        })
    token = _confirmation_serializer().dumps({"operation": "update", "entries": entries})
    return {
        "confirmation": {"token": token, "operation": "update", "items": items},
        "reply": f"Periksa perubahan pada {len(items)} task. Belum ada data yang diubah.",
    }


def _make_delete_confirmation(db, tasks):
    if not isinstance(tasks, list):
        tasks = [tasks]
    entries = []
    items = []
    for task in tasks:
        snapshot = dict(task)
        preview = {
            key: _display_task_value(db, key, snapshot[key])
            for key in ("title", "description", "assignee_id", "priority", "estimated_hours", "status", "start_date", "due_date")
            if key in snapshot
        }
        entries.append({"task_id": task["id"], "expected": snapshot})
        items.append({"title": task["title"], "id": task["id"], "record": preview})
    token = _confirmation_serializer().dumps({
        "operation": "delete",
        "entries": entries,
    })
    return {
        "confirmation": {
            "token": token,
            "operation": "delete",
            "items": items,
        },
        "reply": f"Periksa {len(items)} task yang akan dihapus. Belum ada data yang dihapus.",
    }


def confirm_pending_action(db, token, confirmed):
    try:
        payload = _confirmation_serializer().loads(token, max_age=600)
    except SignatureExpired:
        return {"error": "Konfirmasi kedaluwarsa. Minta AI menyiapkan perubahan lagi."}
    except BadSignature:
        return {"error": "Token konfirmasi tidak valid."}

    if not confirmed:
        return {"reply": "Perubahan dibatalkan.", "action": "none"}
    operation = payload.get("operation")
    entries = payload.get("entries")
    if operation not in {"update", "delete"} or not isinstance(entries, list) or not entries:
        return {"error": "Data konfirmasi tidak valid."}

    rows = []
    for entry in entries:
        task = db.execute("SELECT * FROM tasks WHERE id = ?", (entry.get("task_id"),)).fetchone()
        if not task:
            return {"error": "Task sudah tidak tersedia. Minta AI menyiapkan perubahan lagi."}
        expected = entry.get("expected", {})
        if any(task[field] != value for field, value in expected.items() if field in task.keys()):
            return {"error": f'Data task "{task["title"]}" berubah sejak preview. Minta AI menyiapkan perubahan lagi.'}
        rows.append((task, entry))

    try:
        if operation == "delete":
            for task, _ in rows:
                db.execute("DELETE FROM tasks WHERE id = ?", (task["id"],))
        else:
            allowed_fields = {"title", "description", "assignee_id", "priority", "estimated_hours", "start_date", "due_date", "status"}
            for task, entry in rows:
                updates = entry.get("updates", {})
                if not updates or not set(updates).issubset(allowed_fields):
                    return {"error": "Field update pada konfirmasi tidak valid."}
                assignments = ", ".join(f"{field} = ?" for field in updates)
                db.execute(
                    f"UPDATE tasks SET {assignments} WHERE id = ?",
                    [*updates.values(), task["id"]],
                )
        db.commit()
    except sqlite3.Error as exc:
        db.rollback()
        return {"error": f"Perubahan tidak berhasil disimpan: {exc}"}

    titles = [task["title"] for task, _ in rows]
    if operation == "delete":
        return {
            "reply": f"{len(titles)} task dihapus: " + ", ".join(titles),
            "action": "delete_task" if len(titles) == 1 else "delete_tasks",
            "task_ids": [task["id"] for task, _ in rows],
        }
    return {
        "reply": f"Perubahan disimpan untuk {len(titles)} task: " + ", ".join(titles),
        "action": "update_task" if len(titles) == 1 else "update_tasks",
        "task_ids": [task["id"] for task, _ in rows],
        "updated_count": len(titles),
    }


def _execute_tool(name, arguments, db, compute_member_workload, status_label_id, validate_sql, known_task_ids=None):
    if name == "list_tasks":
        clauses = []
        params = []
        if arguments.get("title_search"):
            clauses.append("t.title LIKE ?")
            params.append(f"%{arguments['title_search']}%")
        if arguments.get("status"):
            clauses.append("t.status = ?")
            params.append(arguments["status"])
        if arguments.get("member_name"):
            member = _find_member(db, arguments["member_name"])
            if isinstance(member, list):
                return {"error": "Nama anggota tidak spesifik.", "candidates": [row["name"] for row in member]}
            if not member:
                return {"error": "Anggota tidak ditemukan."}
            clauses.append("t.assignee_id = ?")
            params.append(member["id"])
        where = " WHERE " + " AND ".join(clauses) if clauses else ""
        rows = db.execute(
            "SELECT t.* FROM tasks t" + where + " ORDER BY t.due_date, t.title LIMIT 30", params
        ).fetchall()
        return {"tasks": [_task_summary(db, task) for task in rows]}

    if name == "create_task":
        title = str(arguments.get("title", "")).strip()
        if not title:
            return {"error": "Judul tugas tidak boleh kosong."}
        assignee = None
        if arguments.get("assignee_name"):
            assignee = _find_member(db, arguments["assignee_name"])
            if isinstance(assignee, list):
                return {"error": "Nama anggota tidak spesifik.", "candidates": [row["name"] for row in assignee]}
            if not assignee:
                return {"error": "Anggota tidak ditemukan."}
        priority = arguments.get("priority", "medium")
        if priority not in {"urgent", "high", "medium", "low"}:
            return {"error": "Prioritas tidak valid."}
        hours = float(arguments.get("estimated_hours", 1))
        if hours <= 0:
            return {"error": "Estimasi jam harus lebih dari nol."}
        today = date.today()
        try:
            start = date.fromisoformat(arguments["start_date"]) if arguments.get("start_date") else today
            due = date.fromisoformat(arguments.get("due_date", "")) if arguments.get("due_date") else today + timedelta(days=3)
        except ValueError:
            return {"error": "Tanggal mulai atau deadline tidak valid."}
        task_id = str(uuid.uuid4())
        db.execute(
            """INSERT INTO tasks (id, title, description, assignee_id, priority, estimated_hours,
               status, start_date, due_date, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (task_id, title, arguments.get("description", ""), assignee["id"] if assignee else None,
                 priority, hours, "todo", start.isoformat(), due.isoformat(), datetime.utcnow().isoformat()),
        )
        db.commit()
        assignee_text = f" untuk {assignee['name']}" if assignee else " tanpa penanggung jawab"
        return {
            "message": f'Tugas "{title}" dibuat{assignee_text}, deadline {due.isoformat()}.',
            "action": "create_task",
            "task_id": task_id,
        }

    if name == "create_tasks":
        task_inputs = arguments.get("tasks")
        if not isinstance(task_inputs, list) or not 1 <= len(task_inputs) <= 20:
            return {"error": "Jumlah tugas harus antara 1 dan 20."}
        today = date.today()
        prepared_tasks = []
        for task_input in task_inputs:
            if not isinstance(task_input, dict):
                return {"error": "Data setiap tugas harus berupa objek."}
            title = str(task_input.get("title", "")).strip()
            if not title:
                return {"error": "Semua tugas harus memiliki judul."}
            assignee = None
            if task_input.get("assignee_name"):
                assignee = _find_member(db, task_input["assignee_name"])
                if isinstance(assignee, list):
                    return {"error": "Nama anggota tidak spesifik.", "candidates": [row["name"] for row in assignee]}
                if not assignee:
                    return {"error": f'Anggota "{task_input["assignee_name"]}" tidak ditemukan.'}
            priority = task_input.get("priority", "medium")
            if priority not in {"urgent", "high", "medium", "low"}:
                return {"error": f'Prioritas tugas "{title}" tidak valid.'}
            try:
                hours = float(task_input.get("estimated_hours", 1))
                start = date.fromisoformat(task_input["start_date"]) if task_input.get("start_date") else today
                due = date.fromisoformat(task_input["due_date"]) if task_input.get("due_date") else today + timedelta(days=3)
            except (TypeError, ValueError):
                return {"error": f'Estimasi, tanggal mulai, atau deadline tugas "{title}" tidak valid.'}
            if hours <= 0:
                return {"error": f'Estimasi tugas "{title}" harus lebih dari nol.'}
            prepared_tasks.append((
                str(uuid.uuid4()), title, task_input.get("description", ""),
                assignee["id"] if assignee else None, priority, hours, "todo",
                start.isoformat(), due.isoformat(), datetime.utcnow().isoformat(),
            ))
        try:
            db.executemany(
                """INSERT INTO tasks (id, title, description, assignee_id, priority, estimated_hours,
                   status, start_date, due_date, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)""",
                prepared_tasks,
            )
            db.commit()
        except sqlite3.Error as exc:
            db.rollback()
            return {"error": f"Tugas tidak berhasil disimpan: {exc}"}
        titles = [task[1] for task in prepared_tasks]
        task_ids = [task[0] for task in prepared_tasks]
        return {
            "message": f"{len(titles)} tugas berhasil dibuat: " + ", ".join(titles),
            "action": "create_tasks",
            "task_ids": task_ids,
            "created_count": len(titles),
        }

    if name == "delete_tasks":
        task_ids = arguments.get("task_ids")
        if not isinstance(task_ids, list) or not 1 <= len(task_ids) <= 20:
            return {"error": "Pilih antara 1 dan 20 task dari hasil pencarian."}
        if any(not isinstance(task_id, str) for task_id in task_ids):
            return {"error": "ID task dari hasil pencarian tidak valid."}
        if len(set(task_ids)) != len(task_ids):
            return {"error": "Daftar task memuat ID duplikat."}
        if known_task_ids is not None and not set(task_ids).issubset(known_task_ids):
            return {"error": "Cari task dengan list_tasks terlebih dahulu; penghapusan hanya dapat memakai ID dari hasil pencarian."}
        tasks = []
        for task_id in task_ids:
            task = db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
            if not task:
                return {"error": "Salah satu task sudah tidak tersedia. Cari ulang task sebelum menghapus."}
            tasks.append(task)
        return _make_delete_confirmation(db, tasks)

    if name == "update_task_status":
        task_id = arguments.get("task_id")
        if not isinstance(task_id, str) or not task_id:
            return {"error": "Cari task dengan list_tasks terlebih dahulu."}
        if known_task_ids is not None and task_id not in known_task_ids:
            return {"error": "Gunakan ID task dari hasil list_tasks pada percakapan ini."}
        task = db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
        if not task:
            return {"error": "Task sudah tidak tersedia. Cari ulang task sebelum mengubahnya."}
        status = arguments["status"]
        if status not in {"todo", "in_progress", "done"}:
            return {"error": "Status tugas tidak valid."}
        return _make_update_confirmation(db, [(task, {"status": status})])

    if name == "update_tasks":
        task_inputs = arguments.get("tasks")
        if not isinstance(task_inputs, list) or not 1 <= len(task_inputs) <= 20:
            return {"error": "Jumlah tugas harus antara 1 dan 20."}
        prepared_updates = []
        seen_task_ids = set()
        for task_input in task_inputs:
            if not isinstance(task_input, dict):
                return {"error": "Data setiap perubahan harus berupa objek."}
            task, updates, error = _prepare_task_update(db, task_input, known_task_ids)
            if error:
                return error
            if task["id"] in seen_task_ids:
                return {"error": f'Tugas "{task["title"]}" disebut lebih dari sekali.'}
            seen_task_ids.add(task["id"])
            prepared_updates.append((task, updates))
        return _make_update_confirmation(db, prepared_updates)

    if name == "update_task_details":
        task, updates, error = _prepare_task_update(db, arguments, known_task_ids)
        if error:
            return error
        return _make_update_confirmation(db, [(task, updates)])

    if name == "get_workload":
        period = arguments["period"]
        if period not in {"day", "week", "month"}:
            return {"error": "Periode harus day, week, atau month."}
        member_name = arguments.get("member_name", "").strip()
        if member_name:
            member = _find_member(db, member_name)
            if isinstance(member, list):
                return {"error": "Nama anggota tidak spesifik.", "candidates": [row["name"] for row in member]}
            if not member:
                return {"error": "Anggota tidak ditemukan."}
            info = compute_member_workload(db, member, period, date.today())
            return {"workload": info, "status_label": status_label_id[info["status"]]}
        results = []
        for member in db.execute("SELECT * FROM members ORDER BY name").fetchall():
            info = compute_member_workload(db, member, period, date.today())
            results.append({"workload": info, "status_label": status_label_id[info["status"]]})
        return {"team_workload": results}

    if name == "save_sql_query":
        query_name = str(arguments.get("name", "")).strip()[:120]
        sql = str(arguments.get("sql", "")).strip()
        if not query_name or not sql:
            return {"error": "Nama dan SQL harus diisi."}
        validation_error = validate_sql(sql)
        if validation_error:
            return {"error": f"Query ditolak: {validation_error}"}
        query_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        db.execute(
            "INSERT INTO saved_queries (id, name, sql, created_at, updated_at) VALUES (?,?,?,?,?)",
            (query_id, query_name, sql, now, now),
        )
        db.commit()
        return {"message": f'Query "{query_name}" berhasil dibuat dan disimpan di menu SQL.', "action": "save_sql_query", "query_id": query_id, "name": query_name, "sql": sql}

    return {"error": "Tool tidak dikenal."}


def chat_with_ai(db, history, compute_member_workload, status_label_id, validate_sql):
    client, model = _make_client()
    schema_rows = db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).fetchall()
    schema = []
    for table in schema_rows:
        columns = db.execute(f'PRAGMA table_info("{table["name"]}")').fetchall()
        schema.append(f'{table["name"]}: ' + ", ".join(f'{column["name"]} ({column["type"]})' for column in columns))

    messages = [{
        "role": "system",
        "content": (
            "Kamu adalah asisten tim berbahasa Indonesia yang ramah dan ringkas. Pahami maksud pengguna secara natural; "
            "pilih tool yang sesuai hanya ketika diperlukan. Untuk informasi yang kurang atau ambigu, tanyakan klarifikasi "
            "dan jangan menebak target perubahan. Jangan menghapus data kecuali diminta dengan jelas. "
            "Untuk permintaan penghapusan, jangan meminta ID, deadline, atau deskripsi. Cari task memakai list_tasks, gunakan ID dari hasilnya untuk delete_tasks, lalu tampilkan preview task dan tunggu konfirmasi user. Jika pencarian menghasilkan beberapa task dan maksud user tidak menyatakan semuanya, tampilkan kandidat untuk dipilih tanpa menyiapkan penghapusan. "
            "Untuk update, cari task berdasarkan kata/judul yang disebut user memakai list_tasks, gunakan ID hasilnya di update_task_details, update_task_status, atau update_tasks, lalu langsung tampilkan preview dan minta konfirmasi. Jangan meminta ID kepada user. Jika hanya satu task yang cocok, jangan menanyakan identitas lagi; jika beberapa cocok dan target belum jelas, minta user memilih kandidat. Jangan meminta field yang tidak diubah; tanyakan hanya jika nilai perubahan memang belum disebut atau ambigu. "
            "Jika pengguna menyebut tanggal mulai, selalu isi start_date sesuai tanggal itu dan jangan menggantinya dengan hari ini. Jika pengguna meminta tanggal mulai sama dengan due date/deadline, isi keduanya dengan tanggal yang sama. Hari ini hanya default bila tanggal mulai tidak disebutkan. "
            "Saat membuat task, gunakan priority medium dan estimated_hours 1 bila pengguna tidak menyebutkannya. "
            "Jika pengguna meminta beberapa tugas, gunakan create_tasks dan sertakan semuanya dalam satu pemanggilan. "
            "Jika pengguna meminta mengubah beberapa task, gunakan update_tasks dan sertakan semua task serta field yang diminta. "
            "Tanggal hari ini: " + date.today().isoformat() + ". "
            "Untuk SQL, buat hanya satu query SELECT/WITH read-only dengan schema berikut; tool akan memvalidasinya. "
            "Schema: " + "\n".join(schema)
        ),
    }]
    messages.extend(history)
    actions = []
    action_messages = []
    confirmations = []
    confirmation_messages = []
    known_task_ids = set()
    try:
        for _ in range(5):
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                tools=TOOLS,
                tool_choice="auto",
                temperature=0.2,
            )
            assistant_message = response.choices[0].message
            if not assistant_message.tool_calls:
                action = actions[-1] if actions else {"action": "none"}
                result = {"reply": assistant_message.content or "Ada yang bisa kubantu lagi?", **action}
                if actions:
                    result["actions"] = actions
                return result

            messages.append(assistant_message.model_dump(exclude_unset=True))
            for tool_call in assistant_message.tool_calls:
                try:
                    arguments = json.loads(tool_call.function.arguments)
                    result = _execute_tool(
                        tool_call.function.name,
                        arguments,
                        db,
                        compute_member_workload,
                        status_label_id,
                        validate_sql,
                        known_task_ids,
                    )
                except (ValueError, TypeError, KeyError, AttributeError) as exc:
                    result = {"error": f"Argumen tool tidak valid: {exc}"}
                if tool_call.function.name == "list_tasks":
                    known_task_ids.update(
                        task["id"] for task in result.get("tasks", []) if task.get("id")
                    )
                if result.get("confirmation"):
                    confirmations.append(result["confirmation"])
                    if result.get("reply"):
                        confirmation_messages.append(result["reply"])
                if result.get("action"):
                    actions.append({key: value for key, value in result.items() if key != "message"})
                    if result.get("message"):
                        action_messages.append(result["message"])
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(result, ensure_ascii=False),
                })
            if confirmations:
                return {
                    "reply": " ".join(confirmation_messages),
                    "confirmations": confirmations,
                    "action": "none",
                }
            if any(action["action"] == "create_tasks" for action in actions):
                return {
                    "reply": " ".join(action_messages),
                    **actions[-1],
                    "actions": actions,
                }
        if actions:
            return {
                "reply": " ".join(action_messages) or "Aksi berhasil dijalankan.",
                **actions[-1],
                "actions": actions,
            }
        raise AIError("AI terlalu lama menyelesaikan permintaan. Coba pecah menjadi permintaan yang lebih kecil.")
    except OpenAIError as exc:
        if actions:
            return {
                "reply": " ".join(action_messages) or "Aksi berhasil dijalankan.",
                **actions[-1],
                "actions": actions,
            }
        raise AIError(f"Tidak dapat menghubungi layanan AI: {exc}") from exc