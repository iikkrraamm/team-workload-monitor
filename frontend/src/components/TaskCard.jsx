import { Copy, Folder } from "lucide-react";
import { initials } from "./ui/Avatar";
import { PriorityBadge, CategoryBadge, RiskBadge } from "./ui/Badge";
import { ScheduleBlock } from "./ScheduleInfo";
import { CapacityText, HistoryNote, WorkDaysText, DeadlineRange } from "./TaskInfo";

export default function TaskCard({ task, assignee, columns, currentStatus, onOpen, onMove, onCopy }) {
  const t = task;
  return (
    <div
      onClick={onOpen}
      className="mb-2.5 cursor-pointer rounded-xl border border-line/70 bg-white p-3.5 transition-shadow hover:shadow-soft"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <PriorityBadge priority={t.priority} />
            <CategoryBadge category={t.category} />
          </div>
          <div className="mt-1.5 text-[14px] font-medium leading-snug text-ink">{t.title}</div>
          {t.project && (
            <div className="mt-1 flex items-center gap-1 text-[11.5px] text-ink-faint">
              <Folder size={11} />
              {t.project}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div className="text-[11.5px] text-ink-faint">Due {t.due_date}</div>
          {assignee ? (
            <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-ink-soft">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-soft text-[9px] font-semibold text-accent">
                {initials(assignee.name)}
              </span>
              {assignee.name.split(" ")[0]}
            </div>
          ) : (
            <div className="text-[11.5px] text-ink-faint">Belum ditentukan</div>
          )}
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between text-[11.5px] text-ink-faint">
        <span><DeadlineRange task={t} /></span>
        <CapacityText task={t} />
      </div>

      <ScheduleBlock schedule={t.schedule} className="mt-2.5" />

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-soft">
        <span>
          Estimasi <strong className="font-semibold text-ink">{t.estimated_hours}h</strong>
        </span>
        <WorkDaysText task={t} />
        {t.deadline && <RiskBadge risk={t.deadline.risk} />}
      </div>

      <HistoryNote task={t} className="mt-2" />

      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-2.5">
        {columns
          .filter((c) => c.key !== currentStatus)
          .map((c) => (
            <button
              key={c.key}
              onClick={(e) => {
                e.stopPropagation();
                onMove(c.key);
              }}
              className="rounded-full bg-ink/[0.04] px-2.5 py-1 text-[11.5px] font-medium text-ink-soft hover:bg-ink/[0.08]"
            >
              → {c.label}
            </button>
          ))}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCopy(task);
          }}
          className="ml-auto flex items-center gap-1 rounded-full bg-ink/[0.04] px-2.5 py-1 text-[11.5px] font-medium text-ink-soft hover:bg-ink/[0.08]"
          title="Salin tugas ini"
        >
          <Copy size={12} /> Salin
        </button>
      </div>
    </div>
  );
}
