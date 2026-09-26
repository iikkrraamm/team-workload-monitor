from datetime import datetime, timedelta, date as date_cls

from serializers import member_row_to_dict

PRIORITY_WEIGHT = {"low": 1, "medium": 2, "high": 3, "urgent": 4}
LOW_MAX = 30
NORMAL_MAX = 80
PADAT_MAX = 100
STATUS_LABEL_ID = {
    "idle": "Idle",
    "low": "Low",
    "normal": "Normal",
    "padat": "Padat",
    "overload": "Overload",
}


def parse_date(value):
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except Exception:
        return None


def daterange(start, end):
    for offset in range((end - start).days + 1):
        yield start + timedelta(days=offset)


def count_days(start, end):
    if end < start:
        return 0
    return sum(1 for _ in daterange(start, end))


def count_workdays(start, end):
    if end < start:
        return 0
    return sum(1 for day in daterange(start, end) if day.weekday() < 5)


def count_capacity_days(start, end, tasks=()):
    overtime_dates = set()
    for task in tasks:
        if (task.get("status") or "").lower() == "done":
            continue
        due = parse_date(task.get("due_date"))
        if due is None or due.weekday() < 5:
            continue
        task_start = parse_date(task.get("start_date")) or due
        if due < task_start:
            task_start = due
        overtime_start = max(start, task_start)
        overtime_end = min(end, due)
        overtime_dates.update(
            day for day in daterange(overtime_start, overtime_end)
            if day.weekday() >= 5
        )
    return count_workdays(start, end) + len(overtime_dates)


def task_row_to_dict(row):
    return {
        "id": row["id"],
        "title": row["title"],
        "description": row["description"],
        "assignee_id": row["assignee_id"],
        "priority": row["priority"],
        "estimated_hours": row["estimated_hours"],
        "status": row["status"],
        "start_date": row["start_date"],
        "due_date": row["due_date"],
    }


def daily_hours_for_task(task, day):
    """Return a task's estimated work contribution on a given date."""
    def get_value(field):
        try:
            return task.get(field)
        except Exception:
            try:
                return task[field]
            except Exception:
                return None

    start = parse_date(get_value("start_date"))
    due = parse_date(get_value("due_date"))
    status = (get_value("status") or "").lower()
    if status == "done" and day > date_cls.today():
        return 0.0
    if start is None and due is None:
        return 0.0
    if start is None:
        start = due
    if due is None:
        due = start
    if due < start:
        due = start
    if not (start <= day <= due):
        return 0.0
    task_days = count_days(start, due)
    if task_days == 0:
        return 0.0
    return task["estimated_hours"] / task_days


def assigned_hours_in_window(db, member_id, tasks, start, end):
    task_dicts = [task_row_to_dict(task) for task in tasks]
    total_hours = 0.0

    for day in daterange(start, end):
        total_hours += sum(daily_hours_for_task(task, day) for task in task_dicts)
        activity = db.execute(
            "SELECT SUM(hours) as h FROM activities WHERE member_id = ? AND date = ?",
            (member_id, day.isoformat()),
        ).fetchone()
        try:
            total_hours += float(activity["h"] or 0.0)
        except Exception:
            pass

    return total_hours


def capacity_balance_by_deadline(db, member_id, tasks, start, end, capacity):
    task_dicts = [task_row_to_dict(task) for task in tasks]
    required_hours = sum(
        daily_hours_for_task(task, day)
        for task in task_dicts
        if (task_due := parse_date(task.get("due_date"))) is not None
        and task_due <= end
        for day in daterange(start, end)
    )
    activity = db.execute(
        "SELECT SUM(hours) as h FROM activities WHERE member_id = ? AND date = ?",
        (member_id, end.isoformat()),
    ).fetchone()
    activity_hours = float(activity["h"] or 0.0) if activity else 0.0
    capacity_days = count_capacity_days(start, end, task_dicts)
    return round(capacity * capacity_days - required_hours - activity_hours, 1)


def allocate_tasks_in_window(db, member_id, start, end, exclude_done=False):
    """Allocate daily capacity to tasks by priority and due date."""
    member = db.execute("SELECT * FROM members WHERE id = ?", (member_id,)).fetchone()
    if not member:
        return {"allocations": {}, "activities": {}, "tasks": []}
    capacity = member["capacity_hours_per_day"]
    query = "SELECT * FROM tasks WHERE assignee_id = ?"
    if exclude_done:
        query += " AND status != 'done'"
    rows = db.execute(query, (member_id,)).fetchall()
    tasks = [task_row_to_dict(row) for row in rows]
    remaining = {task["id"]: float(task.get("estimated_hours") or 0.0) for task in tasks}
    allocations = {}
    activities_by_day = {}
    today = date_cls.today()

    for day in daterange(start, end):
        day_key = day.isoformat()
        activity = db.execute(
            "SELECT SUM(hours) as h FROM activities WHERE member_id = ? AND date = ?",
            (member_id, day_key),
        ).fetchone()
        activity_hours = float(activity["h"] or 0.0) if activity else 0.0
        activities_by_day[day_key] = activity_hours
        weekend_due_tasks = [
            task for task in tasks
            if day.weekday() >= 5
            and (task.get("status") or "").lower() != "done"
            and (task_due := parse_date(task.get("due_date"))) is not None
            and task_due.weekday() >= 5
            and (task_start := parse_date(task.get("start_date")) or start) <= day <= task_due
        ]
        if day.weekday() >= 5 and not weekend_due_tasks:
            allocations[day_key] = {}
            continue
        available = float(capacity) - activity_hours
        if available <= 0:
            allocations[day_key] = {}
            continue

        candidates = []
        for task in tasks:
            task_start = parse_date(task.get("start_date")) or start
            task_due = parse_date(task.get("due_date")) or end
            if day.weekday() >= 5 and (
                (task.get("status") or "").lower() == "done"
                or task_due.weekday() < 5
                or not (task_start <= day <= task_due)
            ):
                continue
            if not (task_start <= day <= task_due):
                continue
            if (task.get("status") or "").lower() == "done" and day > today:
                continue
            if remaining.get(task["id"], 0) > 0:
                candidates.append(task)
        candidates.sort(
            key=lambda task: (
                parse_date(task.get("due_date")) or end,
                -PRIORITY_WEIGHT.get(task.get("priority"), 2),
            )
        )

        day_allocations = {}
        for task in candidates:
            task_remaining = remaining.get(task["id"], 0.0)
            if task_remaining <= 0:
                continue
            allocated = min(task_remaining, available)
            if allocated <= 0:
                break
            day_allocations[task["id"]] = round(allocated, 2)
            remaining[task["id"]] = round(task_remaining - allocated, 2)
            available = round(available - allocated, 2)
        allocations[day_key] = day_allocations

    return {"allocations": allocations, "activities": activities_by_day, "tasks": tasks}


def classify_workload(percent, total_hours):
    if total_hours == 0:
        return "idle"
    if percent < LOW_MAX:
        return "low"
    if percent <= NORMAL_MAX:
        return "normal"
    if percent <= PADAT_MAX:
        return "padat"
    return "overload"


def compute_daily_load(db, member_id, day):
    tasks = db.execute(
        "SELECT * FROM tasks WHERE assignee_id = ?", (member_id,)
    ).fetchall()
    task_hours = sum(daily_hours_for_task(task, day) for task in tasks)
    activities = db.execute(
        "SELECT * FROM activities WHERE member_id = ? AND date = ?",
        (member_id, day.isoformat()),
    ).fetchall()
    return task_hours + sum(activity["hours"] for activity in activities)


def period_range(period, ref_date):
    if period == "day":
        return ref_date, ref_date
    if period == "week":
        start = ref_date - timedelta(days=ref_date.weekday())
        return start, start + timedelta(days=6)
    if period == "month":
        start = ref_date.replace(day=1)
        next_month = (
            start.replace(year=start.year + 1, month=1)
            if start.month == 12
            else start.replace(month=start.month + 1)
        )
        return start, next_month - timedelta(days=1)
    raise ValueError("period must be day, week or month")


def compute_member_workload(db, member, period, ref_date):
    start, end = period_range(period, ref_date)
    total_hours = sum(
        compute_daily_load(db, member["id"], day) for day in daterange(start, end)
    )
    active_tasks = db.execute(
        "SELECT * FROM tasks WHERE assignee_id = ? AND status != 'done'",
        (member["id"],),
    ).fetchall()
    capacity = member["capacity_hours_per_day"] * count_capacity_days(
        start, end, [task_row_to_dict(task) for task in active_tasks]
    )
    if capacity:
        raw_percent = (total_hours / capacity) * 100
        percent = round(raw_percent, 1)
        status = classify_workload(raw_percent, total_hours)
    else:
        percent = None if total_hours else 0
        status = "overload" if total_hours else "idle"
    return {
        "member": member_row_to_dict(member),
        "period": period,
        "range": {"start": start.isoformat(), "end": end.isoformat()},
        "total_hours": round(total_hours, 1),
        "capacity_hours": round(capacity, 1),
        "percent": percent,
        "status": status,
    }


def suggest_for_overload(db, member, period, ref_date):
    """Recommend workload changes for an overloaded team member."""
    start, end = period_range(period, ref_date)
    rows = db.execute(
        "SELECT * FROM tasks WHERE assignee_id = ? AND status != 'done'",
        (member["id"],),
    ).fetchall()
    tasks = [task_row_to_dict(row) for row in rows]
    active_tasks = [
        task for task in tasks
        if any(daily_hours_for_task(task, day) > 0 for day in daterange(start, end))
    ]
    total_hours = sum(
        compute_daily_load(db, member["id"], day) for day in daterange(start, end)
    )
    capacity = member["capacity_hours_per_day"] * count_capacity_days(start, end, tasks)
    remaining_excess = total_hours - capacity
    if remaining_excess <= 0:
        return []

    other_members = db.execute(
        "SELECT * FROM members WHERE id != ?", (member["id"],)
    ).fetchall()
    other_loads = []
    for other_member in other_members:
        info = compute_member_workload(db, other_member, period, ref_date)
        slack = info["capacity_hours"] - info["total_hours"]
        other_loads.append((other_member, info, slack))
    other_loads.sort(key=lambda item: item[1]["percent"])

    task_hours = {
        task["id"]: sum(
            daily_hours_for_task(task, day) for day in daterange(start, end)
        )
        for task in tasks
    }
    candidates = sorted(
        active_tasks,
        key=lambda task: (
            PRIORITY_WEIGHT.get((task.get("priority") or "").lower(), 2),
            parse_date(task.get("due_date")) or end,
        ),
    )
    suggestions = []

    for task in candidates:
        if remaining_excess <= 0:
            break
        hours = round(task_hours[task["id"]], 2)
        if hours <= 0:
            continue
        target = next(
            (
                other_member
                for other_member, info, slack in other_loads
                if slack >= hours and info["status"] in ("idle", "normal")
            ),
            None,
        )
        if target:
            suggestions.append({
                "task_id": task["id"],
                "task_title": task["title"],
                "priority": task["priority"],
                "action": "reassign",
                "suggested_assignee_id": target["id"],
                "suggested_assignee_name": target["name"],
                "reason": f"Alihkan tugas untuk mengurangi overload — {target['name']} memiliki kapasitas.",
            })
        else:
            suggestions.append({
                "task_id": task["id"],
                "task_title": task["title"],
                "priority": task["priority"],
                "action": "reschedule",
                "suggested_new_due_date": (
                    (parse_date(task["due_date"]) or date_cls.today()) + timedelta(days=3)
                ).isoformat(),
                "reason": "Tidak ada rekan yang cukup longgar — sarankan jadwalkan ulang.",
            })
        remaining_excess -= hours

    if remaining_excess > 0:
        activity_notes = []
        for day in daterange(start, end):
            activity = db.execute(
                "SELECT SUM(hours) as h FROM activities WHERE member_id = ? AND date = ?",
                (member["id"], day.isoformat()),
            ).fetchone()
            hours = float(activity["h"] or 0.0) if activity else 0.0
            if hours >= member["capacity_hours_per_day"] * 0.5:
                activity_notes.append(f"{day.isoformat()}:{hours}h")
        if activity_notes:
            suggestions.append({
                "task_id": None,
                "task_title": None,
                "priority": "none",
                "action": "reduce_activities",
                "reason": (
                    "Aktivitas non-task tinggi pada: "
                    f"{', '.join(activity_notes)}. Pertimbangkan kurangi meeting/support atau delegasi."
                ),
            })
    return suggestions


def compute_burnout_risk(db, member, ref_date, lookback_days=14):
    daily_percents = []
    capacity = member["capacity_hours_per_day"]
    for offset in range(lookback_days - 1, -1, -1):
        day = ref_date - timedelta(days=offset)
        hours = compute_daily_load(db, member["id"], day)
        percent = round((hours / capacity) * 100, 1) if capacity else 0
        daily_percents.append({"date": day.isoformat(), "percent": percent})

    overload_days = sum(1 for item in daily_percents if item["percent"] > PADAT_MAX)
    streak = 0
    for item in reversed(daily_percents):
        if item["percent"] <= PADAT_MAX:
            break
        streak += 1

    if streak >= 5 or overload_days >= 10:
        risk = "high"
        message = (
            f"{member['name']} berada dalam kondisi overload {streak} hari berturut-turut "
            f"({overload_days} dari {lookback_days} hari terakhir). Sangat disarankan mengambil "
            "cuti atau istirahat, dan mendistribusikan ulang tugas yang ada."
        )
    elif streak >= 3 or overload_days >= 6:
        risk = "medium"
        message = (
            f"{member['name']} sering overload ({overload_days} dari {lookback_days} hari terakhir). "
            "Pertimbangkan menjadwalkan waktu istirahat dalam waktu dekat."
        )
    else:
        risk = "low"
        message = f"{member['name']} dalam kondisi beban kerja yang wajar."

    return {
        "member_id": member["id"],
        "member_name": member["name"],
        "risk": risk,
        "overload_days": overload_days,
        "current_streak": streak,
        "lookback_days": lookback_days,
        "message": message,
        "history": daily_percents,
    }