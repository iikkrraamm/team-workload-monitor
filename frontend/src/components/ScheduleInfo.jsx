import clsx from "clsx";

// Schedule check for todo / in-progress tasks (from task.schedule). The
// server sends null for done and leave tasks, and these render nothing then.

const LABEL = {
  on_track: "On track",
  terlambat: "Terlambat",
  lewat_deadline: "Lewat deadline",
};

const BADGE_STYLE = {
  on_track: "bg-status-normal/10 text-ok",
  terlambat: "bg-status-padat/10 text-warn",
  lewat_deadline: "bg-status-overload/10 text-status-overload",
};

const BAR_STYLE = {
  on_track: "bg-status-normal",
  terlambat: "bg-status-padat",
  lewat_deadline: "bg-status-overload",
};

const pct = (n) => `${Number(Number(n).toFixed(1))}%`;

export function ScheduleBadge({ schedule }) {
  if (!schedule) return null;
  return (
    <span
      title={schedule.reason}
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-medium",
        BADGE_STYLE[schedule.state]
      )}
    >
      {LABEL[schedule.state] || schedule.state}
    </span>
  );
}

// "Seharusnya 50%" with a thin bar filled to the planned progress.
export function ShouldBeProgress({ schedule, className }) {
  if (!schedule) return null;
  return (
    <div className={className} title={schedule.reason}>
      <div className="flex items-center justify-between gap-2 text-[11.5px] text-ink-soft">
        <span>Seharusnya</span>
        <strong className="font-semibold text-ink">{pct(schedule.should_be_progress)}</strong>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.06]">
        <div
          className={clsx("h-full rounded-full", BAR_STYLE[schedule.state])}
          style={{ width: `${Math.min(Math.max(schedule.should_be_progress, 0), 100)}%` }}
        />
      </div>
    </div>
  );
}

// Badge + "Seharusnya X%" bar + the one-line reason: the full schedule
// readout used on the Kanban card and in the List view.
export function ScheduleBlock({ schedule, className }) {
  if (!schedule) return null;
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <ScheduleBadge schedule={schedule} />
      </div>
      <ShouldBeProgress schedule={schedule} />
      <div className="mt-1 text-[11px] leading-snug text-ink-faint">{schedule.reason}</div>
    </div>
  );
}
