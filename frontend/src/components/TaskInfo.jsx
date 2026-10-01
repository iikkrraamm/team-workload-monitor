import clsx from "clsx";

// Small pieces of task information shared by the Kanban card and the List
// view (desktop table and mobile cards), so both always show the same things
// the same way. Each one reads straight from the /api/tasks item.

// "2026-10-01 → 2026-10-04". Each date is kept in one piece so that, when the
// column is narrow, the line breaks at the arrow and never inside a date
// (browsers would otherwise happily split "2026-09-" / "29" at a hyphen),
// with the arrow staying attached to the due date.
export function DeadlineRange({ task }) {
  const d = task.deadline;
  if (!d) return <>Tidak ada deadline</>;
  return (
    <>
      <span className="whitespace-nowrap">{d.window_start}</span>{" "}
      <span className="whitespace-nowrap">→ {d.due_date}</span>
    </>
  );
}

// Hours the assignee still has before the deadline ("Kekurangan 24h" /
// "12h tersedia"). Done and leave tasks come back with risk = null: they
// aren't rated, so they don't get a capacity note either.
export function CapacityText({ task }) {
  const d = task.deadline;
  if (!d || !d.risk) return null;
  const short = d.available_hours < 0;
  return (
    <span className={clsx(short ? "font-semibold text-status-overload" : "text-ink-soft")}>
      {short ? `Kekurangan ${Math.abs(d.available_hours)}h` : `${d.available_hours}h tersedia`}
    </span>
  );
}

export function WorkDaysText({ task }) {
  return <span>Sisa hari kerja: {task.deadline?.work_days_remaining ?? "-"}</span>;
}

export function HistoryNote({ task, className }) {
  if (!task.deadline?.counted_as_history) return null;
  return (
    <div className={clsx("text-[11px] italic text-ink-faint", className)}>
      Dihitung sebagai histori (tugas sudah selesai)
    </div>
  );
}
