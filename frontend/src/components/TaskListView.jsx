import { ChevronLeft, ChevronRight, Copy, Folder } from "lucide-react";
import { PriorityBadge, CategoryBadge, RiskBadge } from "./ui/Badge";
import { ScheduleBlock } from "./ScheduleInfo";
import { CapacityText, HistoryNote, WorkDaysText, DeadlineRange } from "./TaskInfo";
import Avatar, { initials } from "./ui/Avatar";
import EmptyState from "./ui/EmptyState";
import Button from "./ui/Button";
import { SkeletonTaskCard, SkeletonTaskRow } from "./ui/Skeleton";

const STATUS_OPTIONS = [
  { value: "todo", label: "Belum Dikerjakan" },
  { value: "in_progress", label: "Dikerjakan" },
  { value: "done", label: "Selesai" },
];

const PRIORITY_OPTIONS = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "Tinggi" },
  { value: "medium", label: "Sedang" },
  { value: "low", label: "Rendah" },
];

// Compact inline dropdown for quick edits directly from the row — full edit
// (title, dates, project, ...) still goes through the modal via onOpen.
function QuickSelect({ value, options, onChange, tone }) {
  return (
    <div onClick={(e) => e.stopPropagation()} className="inline-block">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-8 rounded-lg border border-line bg-white px-2 text-[12.5px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 ${tone || "text-ink"}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function TaskListView({
  tasks,
  memberById,
  loading,
  page,
  pageCount,
  total,
  onPageChange,
  onOpen,
  onCopy,
  onQuickUpdate,
}) {
  // Loading vs. genuinely empty must look different, or a slow network and
  // "no tasks match this filter" are indistinguishable to the user.
  if (loading) {
    return (
      <div>
        <div className="hidden overflow-hidden rounded-2xl border border-line/70 bg-white md:block">
          <table className="w-full text-left text-[13px]">
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonTaskRow key={i} />
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-2.5 md:hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonTaskCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (tasks.length === 0) return <EmptyState>Tidak ada tugas</EmptyState>;

  return (
    <div>
      {/* Desktop: table */}
      <div className="hidden overflow-x-auto rounded-2xl border border-line/70 bg-white md:block">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-line text-[12px] text-ink-soft">
              <th className="px-3 py-3 font-medium">Tugas</th>
              <th className="px-3 py-3 font-medium">Assignee</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium">Prioritas</th>
              <th className="px-3 py-3 font-medium">Due</th>
              <th className="px-3 py-3 font-medium">Jadwal</th>
              <th className="px-3 py-3 font-medium">Estimasi &amp; Risiko</th>
              <th className="px-3 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => {
              const assignee = memberById[t.assignee_id];
              return (
                <tr
                  key={t.id}
                  onClick={() => onOpen(t)}
                  className="cursor-pointer border-b border-line last:border-0 hover:bg-ink/[0.02]"
                >
                  <td className="max-w-[280px] px-3 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <PriorityBadge priority={t.priority} />
                      <CategoryBadge category={t.category} />
                    </div>
                    <div className="mt-1 truncate font-medium text-ink">{t.title}</div>
                    {t.project && (
                      <div className="mt-0.5 flex items-center gap-1 text-[11.5px] text-ink-faint">
                        <Folder size={10} />
                        {t.project}
                      </div>
                    )}
                    <HistoryNote task={t} className="mt-1" />
                  </td>
                  <td className="px-3 py-3">
                    {assignee ? (
                      <div className="flex items-center gap-1.5 text-[12.5px] text-ink-soft">
                        <Avatar name={assignee.name} color={assignee.color} size={22} />
                        {assignee.name.split(" ")[0]}
                      </div>
                    ) : (
                      <span className="text-[12.5px] text-ink-faint">Belum ditentukan</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <QuickSelect
                      value={t.status}
                      options={STATUS_OPTIONS}
                      onChange={(v) => onQuickUpdate(t.id, { status: v })}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <QuickSelect
                      value={t.priority}
                      options={PRIORITY_OPTIONS}
                      onChange={(v) => onQuickUpdate(t.id, { priority: v })}
                    />
                  </td>
                  <td className="min-w-[96px] px-3 py-3 text-ink-soft">
                    <div className="whitespace-nowrap">{t.due_date}</div>
                    <div className="mt-0.5 text-[11.5px] text-ink-faint"><DeadlineRange task={t} /></div>
                  </td>
                  <td className="min-w-[150px] max-w-[220px] px-3 py-3">
                    {t.schedule ? (
                      <ScheduleBlock schedule={t.schedule} />
                    ) : (
                      <span className="text-[12.5px] text-ink-faint">—</span>
                    )}
                  </td>
                  <td className="min-w-[116px] px-3 py-3 text-ink-soft">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-medium text-ink">{t.estimated_hours}h</span>
                      <RiskBadge risk={t.deadline?.risk} />
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-ink-faint">
                      <WorkDaysText task={t} />
                    </div>
                    <div className="mt-0.5 text-[11.5px]">
                      <CapacityText task={t} />
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCopy(t);
                      }}
                      title="Salin tugas ini"
                      className="flex h-7 w-7 items-center justify-center rounded-full text-ink-faint hover:bg-ink/[0.06] hover:text-ink"
                    >
                      <Copy size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards */}
      <div className="space-y-2.5 md:hidden">
        {tasks.map((t) => {
          const assignee = memberById[t.assignee_id];
          return (
            <div key={t.id} className="rounded-xl border border-line/70 bg-white p-3.5">
              <div onClick={() => onOpen(t)} className="cursor-pointer">
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
                <div className="mt-2 flex items-center gap-2 text-[12px] text-ink-soft">
                  {assignee ? (
                    <span className="flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-soft text-[9px] font-semibold text-accent">
                        {initials(assignee.name)}
                      </span>
                      {assignee.name.split(" ")[0]}
                    </span>
                  ) : (
                    <span className="text-ink-faint">Belum ditentukan</span>
                  )}
                  <span>· Due {t.due_date}</span>
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
              </div>

              <div className="mt-3 flex items-center gap-2 border-t border-line pt-2.5">
                <QuickSelect
                  value={t.status}
                  options={STATUS_OPTIONS}
                  onChange={(v) => onQuickUpdate(t.id, { status: v })}
                  tone="flex-1"
                />
                <QuickSelect
                  value={t.priority}
                  options={PRIORITY_OPTIONS}
                  onChange={(v) => onQuickUpdate(t.id, { priority: v })}
                  tone="flex-1"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCopy(t);
                  }}
                  title="Salin tugas ini"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-faint hover:bg-ink/[0.06] hover:text-ink"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-[12.5px] text-ink-soft">
            {total} tugas · Halaman {page} dari {pageCount}
          </span>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
              <ChevronLeft size={15} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= pageCount}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight size={15} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
