import uuid
from datetime import datetime, timedelta, date as date_cls

from flask import Blueprint, jsonify, request

from database import get_db
from workload import (
    allocate_tasks_in_window,
    capacity_balance_by_deadline,
    count_capacity_days,
    daily_hours_for_task,
    daterange,
    parse_date,
    task_row_to_dict as _task_row_to_dict,
)


tasks_bp = Blueprint("tasks", __name__)


def _add_in_filter(query, params, column, values):
    """Append `AND column IN (?, ?, ...)` for a non-empty list of values."""
    if not values:
        return query
    placeholders = ",".join("?" for _ in values)
    params.extend(values)
    return query + f" AND {column} IN ({placeholders})"


@tasks_bp.get("/api/tasks")
def list_tasks():
    db = get_db()
    query = "SELECT * FROM tasks WHERE 1=1"
    params = []
    # Multi-select filters arrive as repeated params (?priority=a&priority=b).
    # A single value still works, so older callers are unaffected.
    for arg, column in (
        ("assignee_id", "assignee_id"),
        ("status", "status"),
        ("priority", "priority"),
        ("category", "category"),
        ("project", "project"),
    ):
        values = [v for v in request.args.getlist(arg) if v]
        query = _add_in_filter(query, params, column, values)
    if request.args.get("due_before"):
        try:
            due_before = parse_date(request.args.get("due_before"))
            query += " AND due_date <= ?"
            params.append(due_before.isoformat())
        except Exception:
            pass
    if request.args.get("due_after"):
        try:
            due_after = parse_date(request.args.get("due_after"))
            query += " AND due_date >= ?"
            params.append(due_after.isoformat())
        except Exception:
            pass
    if request.args.get("q"):
        search = f"%{request.args.get('q')}%"
        query += " AND (title LIKE ? OR description LIKE ? OR project LIKE ?)"
        params.extend([search, search, search])
    query += " ORDER BY due_date ASC"
    rows = db.execute(query, params).fetchall()
    results = []

    for row in rows:
        task = _task_row_to_dict(row)
        try:
            due = parse_date(task["due_date"])
        except Exception:
            due = None
        today = date_cls.today()
        if not due:
            task["deadline"] = None
            results.append(task)
            continue

        capacity = 8
        assignee = None
        if task.get("assignee_id"):
            assignee = db.execute(
                "SELECT * FROM members WHERE id = ?", (task["assignee_id"],)
            ).fetchone()
            if assignee:
                capacity = assignee["capacity_hours_per_day"]
        if assignee is None:
            if task.get("assignee_id"):
                task["assignee_id"] = None
            task["deadline"] = None
            results.append(task)
            continue

        task_start = parse_date(task.get("start_date")) or today
        window_start = max(task_start, today)
        work_days = count_capacity_days(window_start, due, [task])
        capacity_total = work_days * capacity
        assigned_tasks = db.execute(
            "SELECT * FROM tasks WHERE assignee_id = ? AND status != 'done'",
            (assignee["id"],),
        ).fetchall()
        # A done task has no work left to schedule. daily_hours_for_task only
        # zeroes a task's contribution for days *after* today (it's meant for
        # historical load totals elsewhere, where a task done today should
        # still count toward today's actual hours). Reused here for "hours
        # still needed before the deadline", that same rule made an already-
        # finished task look like it still needed hours today — while
        # allocate_tasks_in_window (below) already excludes done tasks from
        # allocation entirely, leaving 0 hours allocated to it. The mismatch
        # (needs > 0, allocated = 0) made every done task flip to "tidak
        # cukup" regardless of how comfortably it actually fit.
        is_done = (task.get("status") or "").lower() == "done"
        estimated_remaining = (
            0.0
            if is_done
            else sum(daily_hours_for_task(task, day) for day in daterange(window_start, due))
        )

        allocation = allocate_tasks_in_window(
            db, assignee["id"], window_start, due, exclude_done=True
        )
        allocated_task_hours = sum(
            allocation["allocations"].get(day.isoformat(), {}).get(task["id"], 0.0)
            for day in daterange(window_start, due)
        )
        available_hours = capacity_balance_by_deadline(
            db, assignee["id"], assigned_tasks, window_start, due, capacity
        )
        assigned_total = capacity_total - available_hours
        if available_hours < 0 or allocated_task_hours < estimated_remaining:
            risk = "tidak_cukup"
        else:
            risk = "cukup"

        task["deadline"] = {
            "due_date": due.isoformat(),
            "window_start": window_start.isoformat(),
            "work_days_remaining": work_days,
            "capacity_total": capacity_total,
            "assigned_hours_total": round(assigned_total, 1),
            "available_hours": available_hours,
            "est_remaining_hours": round(estimated_remaining, 1),
            "risk": risk,
            "counted_as_history": (parse_date(task.get("start_date")) or today) <= today
            and (task.get("status") or "") == "done",
        }

        if risk == "tidak_cukup":
            task["suggestions"] = []
            other_members = db.execute(
                "SELECT * FROM members WHERE id != ?", (task.get("assignee_id"),)
            ).fetchall()
            for other_member in other_members:
                other_capacity = other_member["capacity_hours_per_day"]
                other_tasks = db.execute(
                    "SELECT * FROM tasks WHERE assignee_id = ? AND status != 'done'",
                    (other_member["id"],),
                ).fetchall()
                slack = capacity_balance_by_deadline(
                    db,
                    other_member["id"],
                    other_tasks,
                    window_start,
                    due,
                    other_capacity,
                )
                if slack >= estimated_remaining:
                    task["suggestions"].append({
                        "action": "reassign",
                        "suggested_assignee_id": other_member["id"],
                        "suggested_assignee_name": other_member["name"],
                        "reason": f"{other_member['name']} memiliki {slack} jam kosong sampai {due.isoformat()}",
                    })
            if not task["suggestions"]:
                task["suggestions"].append({
                    "action": "reschedule_or_reassign",
                    "suggested_new_due_date": (due + timedelta(days=3)).isoformat(),
                    "reason": "Tidak cukup jam tersisa — sarankan jadwalkan ulang atau alihkan tugas ke tim lain.",
                })
        results.append(task)

    return jsonify(results)


@tasks_bp.get("/api/tasks/risk")
def list_risky_tasks():
    all_tasks = list_tasks().get_json()
    risky_tasks = [
        task for task in all_tasks
        if task.get("status") != "done"
        and task.get("deadline")
        and task["deadline"].get("risk") == "tidak_cukup"
    ]
    return jsonify(risky_tasks)


@tasks_bp.post("/api/tasks")
def create_task():
    data = request.get_json(force=True)
    db = get_db()
    task_id = str(uuid.uuid4())
    today = date_cls.today().isoformat()
    db.execute(
        """INSERT INTO tasks (id, title, description, assignee_id, priority, estimated_hours,
           status, category, project, start_date, due_date, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            task_id,
            data.get("title", "Tugas baru"),
            data.get("description", ""),
            data.get("assignee_id"),
            data.get("priority", "medium"),
            float(data.get("estimated_hours", 1)),
            data.get("status", "todo"),
            data.get("category", "kerja"),
            data.get("project", ""),
            data.get("start_date", today),
            data.get("due_date", today),
            datetime.utcnow().isoformat(),
        ),
    )
    db.commit()
    row = db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    return jsonify(_task_row_to_dict(row)), 201


@tasks_bp.put("/api/tasks/<task_id>")
def update_task(task_id):
    data = request.get_json(force=True)
    db = get_db()
    existing = db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    if not existing:
        return jsonify({"error": "Task tidak ditemukan"}), 404
    db.execute(
        """UPDATE tasks SET title=?, description=?, assignee_id=?, priority=?, estimated_hours=?,
           status=?, category=?, project=?, start_date=?, due_date=? WHERE id=?""",
        (
            data.get("title", existing["title"]),
            data.get("description", existing["description"]),
            data.get("assignee_id", existing["assignee_id"]),
            data.get("priority", existing["priority"]),
            float(data.get("estimated_hours", existing["estimated_hours"])),
            data.get("status", existing["status"]),
            data.get("category", existing["category"] if "category" in existing.keys() else "kerja"),
            data.get("project", existing["project"] if "project" in existing.keys() else ""),
            data.get("start_date", existing["start_date"]),
            data.get("due_date", existing["due_date"]),
            task_id,
        ),
    )
    db.commit()
    row = db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    return jsonify(_task_row_to_dict(row))


@tasks_bp.delete("/api/tasks/<task_id>")
def delete_task(task_id):
    db = get_db()
    db.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    db.commit()
    return jsonify({"ok": True})