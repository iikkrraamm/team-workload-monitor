import Modal from "./ui/Modal";
import Button from "./ui/Button";
import EmptyState from "./ui/EmptyState";

export default function WorkloadDetailModal({ member, data, onClose }) {
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

          <div>
            <div className="mb-2 text-[13px] font-semibold text-ink">Activities</div>
            {data.activities.length === 0 && <EmptyState>Tidak ada aktivitas</EmptyState>}
            <div className="divide-y divide-line">
              {data.activities.map((a) => (
                <div key={a.id} className="flex items-center justify-between py-2 text-[13.5px]">
                  <div className="text-ink-soft">
                    {a.date} — {a.title}
                  </div>
                  <div className="font-medium text-ink">{a.hours}h</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-[13px] font-semibold text-ink">Tasks</div>
            {data.tasks.length === 0 && <EmptyState>Tidak ada tugas</EmptyState>}
            <div className="divide-y divide-line">
              {data.tasks.map((t) => (
                <div key={t.id} className="py-2.5">
                  <div className="flex items-center justify-between">
                    <div className="text-[13.5px] font-medium text-ink">{t.title}</div>
                    <div className="text-[13.5px] font-medium text-ink">{t.total_in_window}h</div>
                  </div>
                  <div className="text-[12px] text-ink-faint">
                    {t.start_date} → {t.due_date}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
