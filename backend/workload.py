from datetime import datetime, timedelta, date as date_cls
from functools import lru_cache

from serializers import member_row_to_dict
from settings import DEFAULT_THRESHOLDS, get_thresholds

PRIORITY_WEIGHT = {"low": 1, "medium": 2, "high": 3, "urgent": 4}
# Task categories that mean time off rather than work. They must not count as
# load when judging burnout: a leave entered as a task with hours (e.g. 96h
# over 6 days) reads as 200% "overload" and would raise a take-a-break alert
# for someone who is already on a break.
BURNOUT_EXCLUDED_CATEGORIES = ("cuti",)
# Statuses that still have work ahead of them (everything except "done").
ACTIVE_TASK_STATUSES = ("todo", "in_progress")


def is_leave_task(task):
    """Time off entered as a task (category "cuti")."""
    category = (task.get("category") or "kerja").strip().lower()
    return category in BURNOUT_EXCLUDED_CATEGORIES


def can_suggest_moving(task):
    """Whether a task may appear in an overload suggestion (reassign or
    reschedule). Finished work has nothing left to move, and leave isn't work
    that can be handed to someone else."""
    status = (task.get("status") or "").strip().lower()
    return status != "done" and not is_leave_task(task)


def role_key(member):
    """Normalised role used to decide who counts as "the same role". An empty
    role gives an empty key, which callers must treat as matching nobody."""
    return (member["role"] or "").strip().casefold()


def is_exempt_from_deadline_risk(task):
    """True for tasks that must not be judged as "enough / not enough hours":
    finished work (nothing left to schedule) and leave (time off is not a
    deliverable that can miss a deadline). `task` is a dict from
    task_row_to_dict. Note this only stops the task itself from being rated
    and listed; it doesn't change how much capacity it uses up."""
    status = (task.get("status") or "").strip().lower()
    return status == "done" or is_leave_task(task)
# The status thresholds (low / normal / overload boundaries) are not constants:
# they live in the app_settings table and are read with settings.get_thresholds,
# so they can be changed from the Pengaturan page without touching the code.
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


def _weekday_count(start, end):
    """Number of Monday-Friday days in [start, end], without looping."""
    if end < start:
        return 0
    total = (end - start).days + 1
    weeks, rest = divmod(total, 7)
    first_loose_day = start + timedelta(days=weeks * 7)
    return weeks * 5 + sum(
        1 for i in range(rest) if (first_loose_day + timedelta(days=i)).weekday() < 5
    )


def count_workdays(start, end):
    return _weekday_count(start, end)


@lru_cache(maxsize=8192)
def task_work_plan(start, due):
    """The days a task's estimate is spread over: (number_of_days, weekend_dates).

    The hours are shared evenly over the working days (Monday-Friday) between
    start and due. Weekends stay empty (the person is idle), except when the
    task is due on a Saturday or Sunday: then the weekend the due date falls in
    takes part, i.e. the due day itself, plus the Saturday before a Sunday due
    date when the task has already started by then. Earlier weekends inside a
    long task never count, so a task spanning several weeks and due on a Sunday
    is not worked every weekend.

    `start` and `due` are the normalised span (see task_span)."""
    weekend = set()
    if due.weekday() >= 5:
        weekend.add(due)
        saturday = due - timedelta(days=1)
        if due.weekday() == 6 and saturday >= start:
            weekend.add(saturday)
    return _weekday_count(start, due) + len(weekend), frozenset(weekend)


def task_works_on_weekend_day(task, day):
    """True when `day` is a Saturday/Sunday the task's hours are spread onto."""
    span = task_span(task)
    if span is None:
        return False
    start, due = span
    if not (start <= day <= due):
        return False
    return day in task_work_plan(start, due)[1]


def count_capacity_days(start, end, tasks=(), force_workday=False):
    """Days of capacity in [start, end]: the working days (Monday-Friday), plus
    each Saturday/Sunday on which at least one of `tasks` has hours scheduled
    (a task due on that weekend, see task_work_plan). Tying the weekend days to
    the hours that actually land on them keeps load and capacity consistent:
    hours on a weekend are never measured against zero capacity, and a weekend
    nobody works stays out of the count (the person is idle that day)."""
    if force_workday:
        # A specific date was explicitly chosen (e.g. a "day" period on a
        # Sat/Sun) - treat it as a full working day instead of skipping it.
        return count_days(start, end)
    weekend_days = sum(
        1
        for day in daterange(start, end)
        if day.weekday() >= 5 and any(daily_hours_for_task(task, day) > 0 for task in tasks)
    )
    return count_workdays(start, end) + weekend_days


def task_row_to_dict(row):
    keys = row.keys()
    return {
        "id": row["id"],
        "title": row["title"],
        "description": row["description"],
        "assignee_id": row["assignee_id"],
        "priority": row["priority"],
        "estimated_hours": row["estimated_hours"],
        "status": row["status"],
        "category": row["category"] if "category" in keys else "kerja",
        "project": row["project"] if "project" in keys else "",
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
    # Only the days the task is worked on carry hours: working days, plus the
    # due weekend when the task is due on a Saturday/Sunday (task_work_plan).
    task_days, weekend_dates = task_work_plan(start, due)
    if task_days == 0:
        return 0.0
    if day.weekday() >= 5 and day not in weekend_dates:
        return 0.0
    return task["estimated_hours"] / task_days


def task_span(task):
    """A task's (start, due) exactly as daily_hours_for_task normalises them,
    or None when it has no usable dates."""
    start = parse_date(task.get("start_date"))
    due = parse_date(task.get("due_date"))
    if start is None and due is None:
        return None
    if start is None:
        start = due
    if due is None:
        due = start
    if due < start:
        due = start
    return start, due


def task_contribution(task, start, end):
    """How much of a task counts inside [start, end], and why.

    Uses daily_hours_for_task, the same rule compute_daily_load (and so the
    workload card's "jam terpakai") is built on, so the numbers always add
    up to the card. The estimate is spread evenly over the task's working days
    (Monday-Friday between start and due, plus the due weekend when the task is
    due on a Saturday/Sunday, see task_work_plan); a task whose deadline is
    longer than the window therefore contributes only its share of the working
    days that fall inside it. Returns None when none of the task's working days
    fall in the window.
    """
    span = task_span(task)
    if span is None:
        return None
    span_start, span_due = span
    if span_start > end or span_due < start:
        return None

    estimated = float(task.get("estimated_hours") or 0.0)
    work_days, weekend_dates = task_work_plan(span_start, span_due)
    # The days of this window the estimate is spread over.
    overlap = [
        day for day in daterange(max(start, span_start), min(end, span_due))
        if day.weekday() < 5 or day in weekend_dates
    ]
    if not overlap:
        return None
    per_day = {
        day.isoformat(): daily_hours_for_task(task, day)
        for day in overlap
    }
    is_done = (task.get("status") or "").strip().lower() == "done"
    # A finished task stops counting after today (daily_hours_for_task).
    counted_days = [d for d in overlap if not (is_done and d > date_cls.today())]
    hours = sum(per_day.values())
    return {
        "span_start": span_start.isoformat(),
        "span_due": span_due.isoformat(),
        # number of days the estimate is shared over (working days + due weekend)
        "span_days": work_days,
        "calendar_days": count_days(span_start, span_due),
        "weekend_days_in_span": len(weekend_dates),
        "hours_per_day": estimated / work_days if work_days else 0.0,
        "days_in_window": len(counted_days),
        "weekend_days_in_window": sum(1 for d in counted_days if d.weekday() >= 5),
        "hours_in_window": hours,
        "hours_outside_window": max(estimated - hours, 0.0),
        # True when some of the task's working days lie outside this window,
        # i.e. only part of the estimate is counted here.
        "prorated": len(overlap) < work_days,
        "done_cutoff": is_done and len(counted_days) < len(overlap),
        "per_day": {k: round(v, 4) for k, v in per_day.items() if v},
    }


def _is_work_day(day, weekend_dates):
    return day.weekday() < 5 or day in weekend_dates


def planned_progress(start, due, ref_date):
    """How far along a task should be at the end of `ref_date`: the share of
    its planned hours that fall on or before that day. It uses the same plan as
    the hour split (task_work_plan): the work is spread evenly over the working
    days from start to due, plus the due weekend when the task is due on a
    Saturday/Sunday. So the progress is exactly the cumulative planned hours
    divided by the estimate, and it stands still over a weekend nobody works.

    Four consecutive working days, Monday to Thursday, give 25 / 50 / 75 / 100;
    it is 0 before the start and 100 from the due date on.

    Returns (elapsed_days, span_days, percent): working days elapsed so far, the
    task's total working days, and the percentage."""
    span_days, weekend_dates = task_work_plan(start, due)
    if ref_date < start:
        elapsed = 0
    elif ref_date >= due:
        elapsed = span_days
    else:
        elapsed = _weekday_count(start, ref_date) + sum(1 for d in weekend_dates if d <= ref_date)
    return elapsed, span_days, round(elapsed / span_days * 100, 1) if span_days else 0.0


def first_work_day(start, due):
    """The first day on or after `start` the task's hours land on."""
    _, weekend_dates = task_work_plan(start, due)
    day = start
    while day < due and not _is_work_day(day, weekend_dates):
        day += timedelta(days=1)
    return day


def task_schedule_status(task, ref_date):
    """Where an unfinished task stands against its schedule on `ref_date`.

    Only todo / in_progress tasks are judged; done tasks, leave (cuti) and
    tasks without usable dates return None.

    There is no record of how much of a task is actually done, only its
    status, so the verdict is based on status plus the task's plan (the same
    working-day plan the hours are split by, see task_work_plan):

    * lewat_deadline: the due date has passed and the task isn't done.
    * terlambat:      still "todo" although at least one of its working days
                      has already gone by (a first day of work passed and
                      nothing was started). A weekend that carries no hours
                      doesn't count as a day gone by.
    * on_track:       everything else: in progress, or still todo before or on
                      its first working day.

    `should_be_progress` is the planned progress for that day (see
    planned_progress) so a screen can show what is expected today.
    """
    status = (task.get("status") or "").strip().lower()
    if status not in ACTIVE_TASK_STATUSES or is_leave_task(task):
        return None
    span = task_span(task)
    if span is None:
        return None
    start, due = span
    elapsed, span_days, should_be = planned_progress(start, due, ref_date)
    # Working days completely behind us (through yesterday).
    elapsed_before_today = planned_progress(start, due, ref_date - timedelta(days=1))[0]
    begins = first_work_day(start, due)

    days_until_due = (due - ref_date).days          # 0 = due today, < 0 = overdue
    days_overdue = max(-days_until_due, 0)
    days_late_start = elapsed_before_today if status == "todo" else 0

    if ref_date > due:
        state = "lewat_deadline"
        reason = f"Lewat deadline {days_overdue} hari (due {due.isoformat()})."
    elif days_late_start > 0:
        state = "terlambat"
        reason = (
            f"Belum dimulai padahal dijadwalkan sejak {begins.isoformat()} "
            f"({days_late_start} hari kerja terlewat); seharusnya sudah {should_be:g}%."
        )
    else:
        state = "on_track"
        if ref_date < begins:
            ahead = (begins - ref_date).days
            reason = f"Dijadwalkan mulai {begins.isoformat()} ({ahead} hari lagi)."
        elif status == "todo":
            reason = (
                "Belum dimulai, deadline hari ini."
                if ref_date == due
                else "Dijadwalkan mulai hari ini."
            )
        elif ref_date == due:
            reason = "Sedang dikerjakan, deadline hari ini."
        else:
            reason = (
                f"Sedang dikerjakan sesuai jadwal: seharusnya {should_be:g}% "
                f"(hari kerja {elapsed} dari {span_days})."
            )

    return {
        "state": state,
        "should_be_progress": should_be,
        "elapsed_days": elapsed,
        "span_days": span_days,
        "start_date": start.isoformat(),
        "due_date": due.isoformat(),
        "days_until_due": days_until_due,
        "days_overdue": days_overdue,
        "days_late_start": days_late_start,
        "reason": reason,
    }


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


def allocate_tasks_in_window(db, member_id, start, end, exclude_done=False, force_workday=False):
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
        is_weekend = day.weekday() >= 5 and not force_workday
        weekend_due_tasks = [
            task for task in tasks
            if is_weekend
            and (task.get("status") or "").lower() != "done"
            and task_works_on_weekend_day(task, day)
        ]
        if is_weekend and not weekend_due_tasks:
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
            if is_weekend and (
                (task.get("status") or "").lower() == "done"
                or not task_works_on_weekend_day(task, day)
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


def classify_workload(percent, total_hours, thresholds=None):
    """Status of a load, from the configured thresholds (settings.py):
    idle with no hours; low below low_max; normal up to and including
    normal_max; padat below overload_from; overload from overload_from on.
    `percent` should be the figure that is shown (rounded to 1 decimal), so
    what a screen displays and what it is classified as never disagree."""
    t = thresholds or DEFAULT_THRESHOLDS
    if total_hours == 0:
        return "idle"
    if percent < t["low_max"]:
        return "low"
    if percent <= t["normal_max"]:
        return "normal"
    if percent < t["overload_from"]:
        return "padat"
    return "overload"


def _task_category(row):
    keys = row.keys()
    value = row["category"] if "category" in keys else None
    # Legacy rows without a category are regular work.
    return (value or "kerja").strip().lower()


def compute_daily_load(db, member_id, day, exclude_categories=()):
    """Hours a member is loaded on `day`. Tasks whose category is listed in
    `exclude_categories` are skipped; by default every task counts."""
    tasks = db.execute(
        "SELECT * FROM tasks WHERE assignee_id = ?", (member_id,)
    ).fetchall()
    if exclude_categories:
        tasks = [t for t in tasks if _task_category(t) not in exclude_categories]
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
    # All tasks, finished ones included: a task done earlier this week still
    # carries its hours on the days it was worked (daily_hours_for_task only
    # stops counting a done task after today), so a weekend it was due on must
    # also count as capacity or its hours would sit on a day with none.
    member_tasks = db.execute(
        "SELECT * FROM tasks WHERE assignee_id = ?",
        (member["id"],),
    ).fetchall()
    capacity = member["capacity_hours_per_day"] * count_capacity_days(
        start, end, [task_row_to_dict(task) for task in member_tasks],
        force_workday=(period == "day"),
    )
    if capacity:
        percent = round((total_hours / capacity) * 100, 1)
        status = classify_workload(percent, total_hours, get_thresholds(db))
    else:
        percent = None if total_hours else 0
        status = "overload" if total_hours else "idle"
    capacity_days = (
        capacity / member["capacity_hours_per_day"]
        if member["capacity_hours_per_day"]
        else 0
    )
    return {
        "member": member_row_to_dict(member),
        "period": period,
        "range": {"start": start.isoformat(), "end": end.isoformat()},
        "total_hours": round(total_hours, 1),
        "capacity_hours": round(capacity, 1),
        "capacity_days": round(capacity_days, 2),
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
    # Only real, unfinished work can be suggested for moving. (Leave and done
    # hours still count toward the overload itself, see total_hours below.)
    active_tasks = [
        task for task in tasks
        if can_suggest_moving(task)
        and any(daily_hours_for_task(task, day) > 0 for day in daterange(start, end))
    ]
    total_hours = sum(
        compute_daily_load(db, member["id"], day) for day in daterange(start, end)
    )
    all_member_tasks = [
        task_row_to_dict(row)
        for row in db.execute("SELECT * FROM tasks WHERE assignee_id = ?", (member["id"],)).fetchall()
    ]
    capacity = member["capacity_hours_per_day"] * count_capacity_days(
        start, end, all_member_tasks, force_workday=(period == "day")
    )
    remaining_excess = total_hours - capacity
    if remaining_excess <= 0:
        return []

    other_members = db.execute(
        "SELECT * FROM members WHERE id != ?", (member["id"],)
    ).fetchall()
    # Work is only handed to someone with the same role; a member without a
    # role has no "same role" colleagues.
    own_role = role_key(member)
    other_members = [m for m in other_members if own_role and role_key(m) == own_role]
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
    if not own_role:
        no_target_reason = "Peran anggota belum diisi, jadi tidak ada rekan seperan — sarankan jadwalkan ulang."
    elif not other_members:
        no_target_reason = f"Tidak ada rekan lain dengan peran {member['role']} — sarankan jadwalkan ulang."
    else:
        no_target_reason = "Tidak ada rekan seperan yang cukup longgar — sarankan jadwalkan ulang."

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
                "reason": (
                    f"Alihkan tugas untuk mengurangi overload — {target['name']} "
                    f"(peran sama: {target['role']}) memiliki kapasitas."
                ),
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
                "reason": no_target_reason,
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
    """Burnout risk from the last `lookback_days` days.

    Each day gets a state:
    * overload: a working day whose load is "overload" under the configured
                threshold (110% of capacity by default).
    * normal:   any other working day. It breaks the streak.
    * overtime: a Saturday/Sunday with any hours scheduled, however few. Working
                a rest day counts as overload, so it adds to the streak.
    * rest:     a Saturday/Sunday with no hours (the person is idle). It is
                skipped: it neither breaks the streak nor adds to it.

    The streak is the run of overload/overtime days ending at ref_date, stepping
    over idle weekends. overload_days counts overload and overtime days, so the
    streak can never exceed it.
    """
    daily_percents = []
    capacity = member["capacity_hours_per_day"]
    thresholds = get_thresholds(db)
    for offset in range(lookback_days - 1, -1, -1):
        day = ref_date - timedelta(days=offset)
        hours = compute_daily_load(
            db, member["id"], day, exclude_categories=BURNOUT_EXCLUDED_CATEGORIES
        )
        percent = round((hours / capacity) * 100, 1) if capacity else 0
        if day.weekday() >= 5:
            state = "overtime" if hours > 0 else "rest"
        else:
            state = "overload" if classify_workload(percent, hours, thresholds) == "overload" else "normal"
        daily_percents.append({"date": day.isoformat(), "percent": percent, "state": state})

    overload_days = sum(1 for item in daily_percents if item["state"] in ("overload", "overtime"))
    streak = 0
    for item in reversed(daily_percents):
        if item["state"] == "rest":
            continue
        if item["state"] == "normal":
            break
        streak += 1

    if streak >= 5 or overload_days >= 10:
        risk = "high"
        message = (
            f"{member['name']} berada dalam kondisi overload {streak} hari berturut-turut "
            f"(akhir pekan libur tidak memutus rangkaian; {overload_days} dari {lookback_days} "
            "hari terakhir). Sangat disarankan mengambil "
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