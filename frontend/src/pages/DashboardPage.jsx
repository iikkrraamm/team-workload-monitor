import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { api } from "../lib/api";
import { formatDateInput } from "../lib/dateUtils";
import Card from "../components/ui/Card";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import Avatar from "../components/ui/Avatar";
import { StatusPill } from "../components/ui/Badge";

const STATUS_META = [
  { key: "idle", label: "Idle" },
  { key: "low", label: "Low" },
  { key: "normal", label: "Normal" },
  { key: "padat", label: "Padat" },
  { key: "overload", label: "Overload" },
];

const PROGRESS_COLOR = {
  idle: "bg-status-idle",
  low: "bg-status-low",
  normal: "bg-status-normal",
  padat: "bg-status-padat",
  overload: "bg-status-overload",
};

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [risky, setRisky] = useState([]);

  const load = useCallback(() => {
    // Same idea as WorkloadPage: send the browser's local date explicitly
    // instead of letting the backend default to the server's own timezone,
    // so "today" always means the user's today, not the server's.
    const today = formatDateInput(new Date());
    api.getDashboard(today).then(setData).catch(console.error);
    api.getRiskyTasks().then(setRisky).catch(() => setRisky([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) return <EmptyState>Memuat dashboard...</EmptyState>;

  const memberNames = Object.fromEntries(
    data.member_cards.map(({ member }) => [member.id, member.name])
  );

  return (
    <div>
      <PageHeader
        title="Dashboard Tim"
        subtitle={`Ringkasan beban kerja hari ini, ${data.reference_date}`}
      />

      <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
        {STATUS_META.map((s) => (
          <Card key={s.key} className="min-w-0 p-3.5 sm:p-4">
            <StatusPill status={s.key} />
            <div className="mt-2.5 text-[24px] font-semibold leading-none text-ink sm:mt-3 sm:text-[28px]">
              {data.status_counts[s.key] ?? 0}
            </div>
            <div className="mt-1 text-[12px] text-ink-soft sm:text-[12.5px]">
              orang berstatus {s.label.toLowerCase()}
            </div>
          </Card>
        ))}
      </div>

      {data.burnout_alerts.length > 0 && (
        <Card className="mb-6 p-5">
          <div className="mb-3 text-[15px] font-semibold text-ink">
            Peringatan Risiko Burnout
          </div>
          <div className="space-y-2">
            {data.burnout_alerts.map((a) => (
              <div
                key={a.member_id}
                className={
                  a.risk === "high"
                    ? "flex items-start gap-3 rounded-xl bg-status-overload/[0.08] px-4 py-3"
                    : "flex items-start gap-3 rounded-xl bg-status-padat/[0.08] px-4 py-3"
                }
              >
                <AlertTriangle
                  size={17}
                  className={a.risk === "high" ? "mt-0.5 shrink-0 text-status-overload" : "mt-0.5 shrink-0 text-status-padat"}
                />
                <div className="min-w-0 break-words text-[13.5px] leading-relaxed text-ink">
                  <strong className="font-semibold">{a.member_name}</strong> — {a.message}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* grid-cols-1 matters: a bare `grid` has an auto-sized column that grows to
          the longest unbroken line (task titles), pushing both cards off-screen. */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="min-w-0 p-5">
          <div className="mb-4 text-[15px] font-semibold text-ink">Beban Kerja Hari Ini</div>
          <div className="space-y-4">
            {data.member_cards.map((mc) => (
              <div
                key={mc.member.id}
                className="border-b border-line pb-4 last:border-0 last:pb-0 sm:border-0 sm:pb-0"
              >
                {/* Mobile layout */}
                <div className="flex items-start gap-3.5 sm:hidden">
                  <Avatar name={mc.member.name} color={mc.member.color} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-medium text-ink">{mc.member.name}</div>
                        <div className="truncate text-[12.5px] text-ink-faint">{mc.member.role}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <div className="text-[14px] font-semibold text-ink">
                          {mc.today_percent == null ? "—" : `${mc.today_percent}%`}
                        </div>
                        <StatusPill status={mc.today_status} />
                      </div>
                    </div>
                    <div className="mt-1.5 truncate text-[12px] text-ink-soft">
                      <span className="font-medium text-ink">Sedang dikerjakan: </span>
                      {mc.in_progress_tasks.length
                        ? mc.in_progress_tasks.join(", ")
                        : "Tidak ada task aktif hari ini"}
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.06]">
                      <div
                        className={`h-full rounded-full ${PROGRESS_COLOR[mc.today_status]}`}
                        style={{ width: `${Math.min(mc.today_percent ?? 0, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Desktop layout */}
                <div className="hidden items-center gap-3.5 sm:flex">
                  <Avatar name={mc.member.name} color={mc.member.color} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-medium text-ink">{mc.member.name}</div>
                    <div className="text-[12.5px] text-ink-faint">{mc.member.role}</div>
                    <div className="mt-1 truncate text-[12px] text-ink-soft">
                      <span className="font-medium text-ink">Sedang dikerjakan: </span>
                      {mc.in_progress_tasks.length
                        ? mc.in_progress_tasks.join(", ")
                        : "Tidak ada task aktif hari ini"}
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.06]">
                      <div
                        className={`h-full rounded-full ${PROGRESS_COLOR[mc.today_status]}`}
                        style={{ width: `${Math.min(mc.today_percent ?? 0, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <div className="text-[14px] font-semibold text-ink">
                      {mc.today_percent == null ? "—" : `${mc.today_percent}%`}
                    </div>
                    <StatusPill status={mc.today_status} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="min-w-0 p-5">
          <div className="mb-4 text-[15px] font-semibold text-ink">Status Tugas</div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Card className="min-w-0 border-none bg-ink/[0.03] p-2.5 shadow-none sm:p-3.5">
              <div className="text-[18px] font-semibold text-ink sm:text-[22px]">
                {data.task_status_counts.todo || 0}
              </div>
              <div className="mt-0.5 text-[11px] text-ink-soft sm:text-[12px]">Belum dikerjakan</div>
            </Card>
            <Card className="min-w-0 border-none bg-ink/[0.03] p-2.5 shadow-none sm:p-3.5">
              <div className="text-[18px] font-semibold text-ink sm:text-[22px]">
                {data.task_status_counts.in_progress || 0}
              </div>
              <div className="mt-0.5 text-[11px] text-ink-soft sm:text-[12px]">Dikerjakan</div>
            </Card>
            <Card className="min-w-0 border-none bg-ink/[0.03] p-2.5 shadow-none sm:p-3.5">
              <div className="text-[18px] font-semibold text-ink sm:text-[22px]">
                {data.task_status_counts.done || 0}
              </div>
              <div className="mt-0.5 text-[11px] text-ink-soft sm:text-[12px]">Selesai</div>
            </Card>
          </div>
          <div className="mt-4 text-[13px] leading-relaxed text-ink-soft">
            Total {data.total_tasks} tugas aktif di seluruh tim. Cek halaman "Analisis Beban"
            untuk rekomendasi reschedule / reassign otomatis saat ada anggota yang overload.
          </div>
        </Card>
      </div>

      {risky.length > 0 && (
        <Card className="mt-5 p-5">
          <div className="mb-3 text-[15px] font-semibold text-ink">
            Tugas Berisiko (Tidak Cukup Jam)
          </div>
          <div className="divide-y divide-line">
            {risky.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-medium text-ink">{t.title}</div>
                  <div className="text-[12.5px] text-ink-soft">
                    {memberNames[t.assignee_id] || "Unassigned"} · Due {t.due_date}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
