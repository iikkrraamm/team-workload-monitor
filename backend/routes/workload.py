from datetime import date as date_cls

from flask import Blueprint, jsonify, request

from database import get_db
from serializers import activity_row_to_dict, member_row_to_dict
from workload import (
    allocate_tasks_in_window,
    compute_burnout_risk,
    compute_member_workload,
    daterange,
    parse_date,
    period_range,
    suggest_for_overload,
    task_row_to_dict,
)


workload_bp = Blueprint("workload", __name__)


@workload_bp.get("/api/workload")
def get_workload():
    db = get_db()
    period = request.args.get("period", "week")
    reference_date = request.args.get("date")
    ref_date = parse_date(reference_date) if reference_date else date_cls.today()
    members = db.execute("SELECT * FROM members ORDER BY name").fetchall()
    results = []

    for member in members:
        info = compute_member_workload(db, member, period, ref_date)
        info["suggestions"] = (
            suggest_for_overload(db, member, period, ref_date)
            if info["status"] == "overload"
            else []
        )
        results.append(info)

    return jsonify({
        "period": period,
        "reference_date": ref_date.isoformat(),
        "members": results,
    })


@workload_bp.get("/api/workload/details")
def get_workload_details():
    db = get_db()
    member_id = request.args.get("member_id")
    if not member_id:
        return jsonify({"error": "member_id is required"}), 400
    period = request.args.get("period", "week")
    reference_date = request.args.get("date")
    ref_date = parse_date(reference_date) if reference_date else date_cls.today()
    start, end = period_range(period, ref_date)
    allocation = allocate_tasks_in_window(db, member_id, start, end)

    rows = db.execute("SELECT * FROM tasks WHERE assignee_id = ?", (member_id,)).fetchall()
    tasks = []
    for row in rows:
        task = task_row_to_dict(row)
        task_start = parse_date(task.get("start_date")) or parse_date(task.get("due_date"))
        task_due = parse_date(task.get("due_date")) or task_start
        if task_start is None or task_due is None:
            continue
        if task_due < task_start:
            task_due = task_start
        if task_start > end or task_due < start:
            continue

        daily_allocations = {}
        total_hours = 0.0
        for day in daterange(start, end):
            day_key = day.isoformat()
            hours = allocation["allocations"].get(day_key, {}).get(task["id"], 0.0)
            if hours:
                daily_allocations[day_key] = round(hours, 2)
                total_hours += hours
        tasks.append({
            "id": task["id"],
            "title": task["title"],
            "status": task.get("status"),
            "estimated_hours": task.get("estimated_hours"),
            "total_in_window": round(total_hours, 2),
            "per_day": daily_allocations,
            "start_date": task.get("start_date"),
            "due_date": task.get("due_date"),
        })

    activity_rows = db.execute(
        """SELECT * FROM activities
           WHERE member_id = ? AND date >= ? AND date <= ? ORDER BY date""",
        (member_id, start.isoformat(), end.isoformat()),
    ).fetchall()
    activities = [activity_row_to_dict(row) for row in activity_rows]

    return jsonify({
        "member_id": member_id,
        "period": period,
        "range": {"start": start.isoformat(), "end": end.isoformat()},
        "tasks": tasks,
        "activities": activities,
        "allocations": allocation["allocations"],
        "activity_sums": allocation["activities"],
    })


@workload_bp.get("/api/burnout")
def get_burnout():
    db = get_db()
    reference_date = request.args.get("date")
    ref_date = parse_date(reference_date) if reference_date else date_cls.today()
    lookback_days = int(request.args.get("lookback_days", 14))
    members = db.execute("SELECT * FROM members ORDER BY name").fetchall()
    return jsonify([
        compute_burnout_risk(db, member, ref_date, lookback_days)
        for member in members
    ])


@workload_bp.get("/api/dashboard")
def get_dashboard():
    db = get_db()
    ref_date = date_cls.today()
    members = db.execute("SELECT * FROM members ORDER BY name").fetchall()
    status_counts = {"idle": 0, "low": 0, "normal": 0, "padat": 0, "overload": 0}
    member_cards = []
    for member in members:
        daily = compute_member_workload(db, member, "day", ref_date)
        weekly = compute_member_workload(db, member, "week", ref_date)
        in_progress_tasks = db.execute(
            """SELECT title FROM tasks
               WHERE assignee_id = ? AND status = 'in_progress'
               AND (start_date IS NULL OR start_date <= ?)
               AND (due_date IS NULL OR due_date >= ?)
               ORDER BY due_date, title""",
            (member["id"], ref_date.isoformat(), ref_date.isoformat()),
        ).fetchall()
        status_counts[daily["status"]] += 1
        member_cards.append({
            "member": member_row_to_dict(member),
            "today_percent": daily["percent"],
            "today_status": daily["status"],
            "week_percent": weekly["percent"],
            "week_status": weekly["status"],
            "in_progress_tasks": [task["title"] for task in in_progress_tasks],
        })

    burnout_alerts = [
        risk for risk in (compute_burnout_risk(db, member, ref_date) for member in members)
        if risk["risk"] in ("medium", "high")
    ]
    task_status_counts = {"todo": 0, "in_progress": 0, "done": 0}
    tasks = db.execute("SELECT status FROM tasks").fetchall()
    for task in tasks:
        task_status_counts[task["status"]] = task_status_counts.get(task["status"], 0) + 1

    return jsonify({
        "reference_date": ref_date.isoformat(),
        "status_counts": status_counts,
        "member_cards": member_cards,
        "burnout_alerts": burnout_alerts,
        "task_status_counts": task_status_counts,
        "total_tasks": len(tasks),
    })