import Card from "./ui/Card";
import Avatar from "./ui/Avatar";
import Button from "./ui/Button";
import { StatusPill, PRIORITY_LABEL } from "./ui/Badge";

const PROGRESS_COLOR = {
  idle: "bg-status-idle",
  low: "bg-status-low",
  normal: "bg-status-normal",
  padat: "bg-status-padat",
  overload: "bg-status-overload",
};

export default function MemberWorkloadRow({ entry, onShowDetails, onApplySuggestion }) {
  const m = entry;
  return (
    <Card className="mb-3.5 p-5">
      <div className="flex items-center gap-3.5">
        <Avatar name={m.member.name} color={m.member.color} />
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-semibold text-ink">{m.member.name}</div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.06]">
            <div
              className={`h-full rounded-full ${PROGRESS_COLOR[m.status]}`}
              style={{ width: `${Math.min(m.percent ?? 0, 100)}%` }}
            />
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div className="text-[14px] font-semibold text-ink">
            {m.percent == null ? "—" : `${m.percent}%`}
          </div>
          <StatusPill status={m.status} />
        </div>
      </div>

      <div className="mt-2.5 text-[12px] text-ink-faint">
        {m.total_hours} jam terpakai dari {m.capacity_hours} jam kapasitas ({m.range.start} — {m.range.end})
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="subtle" size="sm" onClick={onShowDetails}>
          Lihat rincian kontribusi
        </Button>
      </div>

      {m.suggestions?.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-line pt-3">
          <div className="text-[12.5px] font-semibold text-status-overload">
            Saran untuk mengurangi beban
          </div>
          {m.suggestions.map((s) => (
            <div
              key={s.task_id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-ink/[0.03] px-3.5 py-3"
            >
              <div className="min-w-0 text-[13px] text-ink">
                <div className="font-medium">
                  {s.task_title}{" "}
                  <span className="font-normal text-ink-soft">({PRIORITY_LABEL[s.priority]})</span>
                  {" — "}
                  {s.action === "reassign"
                    ? `alihkan ke ${s.suggested_assignee_name}`
                    : `jadwalkan ulang ke ${s.suggested_new_due_date}`}
                </div>
                <div className="text-[12px] text-ink-soft">{s.reason}</div>
              </div>
              <Button variant="primary" size="sm" onClick={() => onApplySuggestion(s)}>
                Terapkan
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
