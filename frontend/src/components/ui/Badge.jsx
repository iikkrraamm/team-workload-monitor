import clsx from "clsx";

export const STATUS_LABEL = {
  idle: "Idle",
  low: "Low",
  normal: "Normal",
  padat: "Padat",
  overload: "Overload",
};

export const PRIORITY_LABEL = {
  urgent: "Urgent",
  high: "Tinggi",
  medium: "Sedang",
  low: "Rendah",
};

const STATUS_STYLE = {
  idle: "bg-status-idle/10 text-status-idle",
  low: "bg-status-low/10 text-[#0a7ea8]",
  normal: "bg-status-normal/10 text-[#1a8a3d]",
  padat: "bg-status-padat/10 text-[#c9760a]",
  overload: "bg-status-overload/10 text-status-overload",
};

const STATUS_DOT = {
  idle: "bg-status-idle",
  low: "bg-status-low",
  normal: "bg-status-normal",
  padat: "bg-status-padat",
  overload: "bg-status-overload",
};

export function StatusPill({ status }) {
  if (!status) return null;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium",
        STATUS_STYLE[status]
      )}
    >
      <span className={clsx("h-1.5 w-1.5 rounded-full", STATUS_DOT[status])} />
      {STATUS_LABEL[status]}
    </span>
  );
}

const PRIORITY_STYLE = {
  urgent: "bg-status-overload/10 text-status-overload",
  high: "bg-status-padat/10 text-[#c9760a]",
  medium: "bg-accent/10 text-accent",
  low: "bg-ink/[0.06] text-ink-soft",
};

export function PriorityBadge({ priority }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-semibold",
        PRIORITY_STYLE[priority]
      )}
    >
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

export const CATEGORY_LABEL = {
  kerja: "Kerja",
  meeting: "Meeting/Diskusi",
};

const CATEGORY_STYLE = {
  kerja: "bg-ink/[0.06] text-ink-soft",
  meeting: "bg-accent/10 text-accent",
};

export function CategoryBadge({ category }) {
  if (!category) return null;
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-semibold",
        CATEGORY_STYLE[category] || CATEGORY_STYLE.kerja
      )}
    >
      {CATEGORY_LABEL[category] || category}
    </span>
  );
}
