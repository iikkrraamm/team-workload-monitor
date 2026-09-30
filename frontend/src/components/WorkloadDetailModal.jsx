import Modal from "./ui/Modal";
import Button from "./ui/Button";
import EmptyState from "./ui/EmptyState";
import { CategoryBadge } from "./ui/Badge";

// 2 decimals at most, no trailing zeros: 20 -> "20", 3.3333 -> "3.33".
const fmt = (n) => Number(Number(n).toFixed(2)).toString();
const isExact = (n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
const approx = (n) => (isExact(n) ? fmt(n) : `≈ ${fmt(n)}`);

// The working behind one task's hours, from the numbers the server used.
function taskExplanation(t) {
  const estimate = Number(t.estimated_hours) || 0;
  const weekend =
    t.weekend_days_in_window > 0 ? `, termasuk ${t.weekend_days_in_window} hari akhir pekan` : "";
  const lines = [];

  if (!t.prorated && !t.done_cutoff) {
    lines.push(`Seluruh estimasi ${fmt(estimate)} jam jatuh di periode ini (${t.span_days} hari${weekend}).`);
  } else {
    lines.push(
      `Estimasi ${fmt(estimate)} jam dibagi rata ke ${t.span_days} hari kalender ` +
        `(${t.span_start} → ${t.span_due}, akhir pekan ikut dihitung): ` +
        `${fmt(estimate)} ÷ ${t.span_days} = ${approx(t.hours_per_day)} jam/hari.`
    );
    lines.push(
      `Periode ini mencakup ${t.days_in_window} hari${weekend}: ` +
        `${fmt(estimate)} ÷ ${t.span_days} × ${t.days_in_window} = ${fmt(t.hours_in_window)} jam.`
    );
    if (t.done_cutoff) {
      lines.push("Tugas sudah selesai, jadi hanya hari sampai hari ini yang dihitung.");
    } else if (t.hours_outside_window > 0.005) {
      lines.push(`Sisa ${fmt(t.hours_outside_window)} jam jatuh di luar periode ini.`);
    }
  }
  if (t.category === "cuti") {
    lines.push("Jam cuti tetap dihitung sebagai kapasitas terpakai.");
  }
  return lines;
}

function Summary({ s }) {
  const extra = s.capacity_extra_weekend_days > 0
    ? ` (termasuk ${fmt(s.capacity_extra_weekend_days)} hari akhir pekan yang dihitung sebagai hari kerja)`
    : "";
  return (
    <div className="rounded-xl bg-ink/[0.04] px-4 py-3 text-[13px] text-ink">
      <div>
        <strong>{s.total_hours} jam</strong> terpakai dari <strong>{s.capacity_hours} jam</strong> kapasitas
        {s.percent != null && ` (${s.percent}%)`}
      </div>
      <div className="mt-1 text-[12px] text-ink-soft">
        Kapasitas: {fmt(s.capacity_hours_per_day)} jam/hari × {fmt(s.capacity_days)} hari
        {extra} = {s.capacity_hours} jam.
      </div>
      <div className="mt-1 text-[12px] text-ink-soft">
        Jam terpakai = tugas {fmt(s.task_hours)} + aktivitas {fmt(s.activity_hours)} jam. Jam tiap tugas dibagi
        rata ke semua hari dari start sampai deadline, lalu yang dihitung hanya hari yang masuk periode ini.
      </div>
    </div>
  );
}

export default function WorkloadDetailModal({ member, data, onClose }) {
  const s = data?.summary;
  const totalText = s ? fmt(s.exact_total_hours) : "";
  return (
    <Modal
      title={`Rincian kontribusi: ${member.name}`}
      onClose={onClose}
      width={720}
      footer={
        <Button variant="ghost" onClick={onClose}>
          Tutup
        </Button>
      }
    >
      {!data ? (
        <EmptyState>Memuat...</EmptyState>
      ) : (
        <div className="space-y-5">
          <div className="text-[12.5px] text-ink-soft">
            Periode: {data.range.start} — {data.range.end}
          </div>

          <Summary s={s} />

          <div>
            <div className="mb-2 text-[13px] font-semibold text-ink">Tasks</div>
            {data.tasks.length === 0 && <EmptyState>Tidak ada tugas</EmptyState>}
            <div className="divide-y divide-line">
              {data.tasks.map((t) => (
                <div key={t.id} className="py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="break-words text-[13.5px] font-medium text-ink">{t.title}</span>
                        {t.category === "cuti" && <CategoryBadge category={t.category} />}
                        {(t.status || "").toLowerCase() === "done" && (
                          <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-[11px] font-medium text-ink-soft">
                            Selesai
                          </span>
                        )}
                      </div>
                      <div className="text-[12px] text-ink-faint">
                        {t.span_start} → {t.span_due}
                      </div>
                    </div>
                    <div className="shrink-0 text-[13.5px] font-medium text-ink">{fmt(t.hours_in_window)} jam</div>
                  </div>
                  <div className="mt-1 space-y-0.5 break-words text-[12px] text-ink-soft">
                    {taskExplanation(t).map((line, i) => (
                      <div key={i}>{line}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-[13px] font-semibold text-ink">Activities</div>
            {data.activities.length === 0 && <EmptyState>Tidak ada aktivitas</EmptyState>}
            <div className="divide-y divide-line">
              {data.activities.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 py-2 text-[13.5px]">
                  <div className="min-w-0 break-words text-ink-soft">
                    {a.date} — {a.title}
                  </div>
                  <div className="shrink-0 font-medium text-ink">{fmt(a.hours)} jam</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-line px-4 py-3 text-[13.5px]">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-ink">Total jam terpakai</span>
              <span className="font-semibold text-ink">{totalText} jam</span>
            </div>
            <div className="mt-0.5 text-[12px] text-ink-soft">
              Tugas {fmt(s.task_hours)} + aktivitas {fmt(s.activity_hours)}
              {totalText === String(s.total_hours)
                ? ` — sama dengan ${s.total_hours} jam pada kartu.`
                : ` — ${s.total_hours} jam pada kartu (dibulatkan 1 desimal).`}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
