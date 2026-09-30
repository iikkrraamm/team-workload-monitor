from datetime import date as date_cls

from flask import Blueprint, jsonify, request

from database import get_db
from serializers import activity_row_to_dict, member_row_to_dict
from workload import (
    compute_burnout_risk,
    compute_member_workload,
    count_workdays,
    daterange,
    parse_date,
    period_range,
    suggest_for_overload,
    task_contribution,
    task_row_to_dict,
)


workload_bp = Blueprint("workload", __name__)

# Risk levels shown in the dashboard's burnout card. "medium" is still
# computed and returned by /api/burnout, it just isn't raised as a warning.
DASHBOARD_ALERT_LEVELS = ("high",)


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
    """Breakdown behind one member's "jam terpakai" on the workload card.

    Every number here comes from the same rule the card uses (a task's
    estimate spread evenly over the days from start to due, plus activity
    hours), so the rows add up exactly to summary.total_hours. Each task also
    carries the figures needed to show the working: estimate, number of days
    it is spread over, hours per day and how many of those days fall in the
    period.
    """
    db = get_db()
    member_id = request.args.get("member_id")
    if not member_id:
        return jsonify({"error": "member_id is required"}), 400
    member = db.execute("SELECT * FROM members WHERE id = ?", (member_id,)).fetchone()
    if member is None:
        return jsonify({"error": "member not found"}), 404
    period = request.args.get("period", "week")
    reference_date = request.args.get("date")
    ref_date = parse_date(reference_date) if reference_date else date_cls.today()
    start, end = period_range(period, ref_date)

    # The card's own figures: the single source the rows must add up to.
    card = compute_member_workload(db, member, period, ref_date)

    rows = db.execute("SELECT * FROM tasks WHERE assignee_id = ?", (member_id,)).fetchall()
    tasks = []
    for row in rows:
        task = task_row_to_dict(row)
        contribution = task_contribution(task, start, end)
        if contribution is None:
            continue
        hours = contribution["hours_in_window"]
        tasks.append({
            "id": task["id"],
            "title": task["title"],
            "status": task.get("status"),
            "category": (task.get("category") or "kerja"),
            "priority": task.get("priority"),
            "estimated_hours": task.get("estimated_hours"),
            "start_date": task.get("start_date"),
            "due_date": task.get("due_date"),
            "span_start": contribution["span_start"],
            "span_due": contribution["span_due"],
            "span_days": contribution["span_days"],
            "hours_per_day": round(contribution["hours_per_day"], 4),
            "days_in_window": contribution["days_in_window"],
            "weekend_days_in_window": contribution["weekend_days_in_window"],
            "hours_in_window": round(hours, 4),
            "hours_outside_window": round(contribution["hours_outside_window"], 4),
            "prorated": contribution["prorated"],
            "done_cutoff": contribution["done_cutoff"],
            # kept for older clients; same value as hours_in_window
            "total_in_window": round(hours, 4),
            "per_day": contribution["per_day"],
        })
    tasks.sort(key=lambda t: (-t["hours_in_window"], t["title"] or ""))

    activity_rows = db.execute(
        """SELECT * FROM activities
           WHERE member_id = ? AND date >= ? AND date <= ? ORDER BY date""",
        (member_id, start.isoformat(), end.isoformat()),
    ).fetchall()
    activities = [activity_row_to_dict(row) for row in activity_rows]

    task_hours = sum(t["hours_in_window"] for t in tasks)
    activity_hours = sum(float(a["hours"] or 0.0) for a in activities)
    activity_by_day = {}
    for a in activities:
        activity_by_day[a["date"]] = activity_by_day.get(a["date"], 0.0) + float(a["hours"] or 0.0)
    daily = []
    for day in daterange(start, end):
        key = day.isoformat()
        day_task_hours = sum(t["per_day"].get(key, 0.0) for t in tasks)
        day_activity_hours = activity_by_day.get(key, 0.0)
        daily.append({
            "date": key,
            "task_hours": round(day_task_hours, 4),
            "activity_hours": round(day_activity_hours, 4),
            "total_hours": round(day_task_hours + day_activity_hours, 4),
        })

    workdays = count_workdays(start, end)
    return jsonify({
        "member_id": member_id,
        "period": period,
        "range": {"start": start.isoformat(), "end": end.isoformat()},
        "summary": {
            # rounded to 1 decimal, identical to the card
            "total_hours": card["total_hours"],
            "capacity_hours": card["capacity_hours"],
            "percent": card["percent"],
            "status": card["status"],
            # the exact sums behind that figure
            "task_hours": round(task_hours, 4),
            "activity_hours": round(activity_hours, 4),
            "exact_total_hours": round(task_hours + activity_hours, 4),
            "capacity_hours_per_day": member["capacity_hours_per_day"],
            "capacity_days": card["capacity_days"],
            "workdays_in_period": workdays,
            # weekend days that were counted as working days
            "capacity_extra_weekend_days": max(round(card["capacity_days"] - workdays, 2), 0),
        },
        "tasks": tasks,
        "activities": activities,
        "daily": daily,
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
    reference_date = request.args.get("date")
    ref_date = parse_date(reference_date) if reference_date else date_cls.today()
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
        if risk["risk"] in DASHBOARD_ALERT_LEVELS
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