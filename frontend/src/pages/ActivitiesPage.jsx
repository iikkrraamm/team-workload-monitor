import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { api } from "../lib/api";
import Card from "../components/ui/Card";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import Button from "../components/ui/Button";
import { Input, Select } from "../components/ui/Field";

export default function ActivitiesPage({ members }) {
  const [activities, setActivities] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [memberId, setMemberId] = useState(members[0]?.id || "");
  const [title, setTitle] = useState("");
  const [hours, setHours] = useState(1);

  const load = useCallback(() => {
    api.getActivities({ date, member_id: memberId }).then(setActivities).catch(console.error);
  }, [date, memberId]);

  useEffect(() => {
    load();
  }, [load, members]);

  const add = async () => {
    if (!memberId) return alert("Pilih anggota terlebih dahulu");
    await api.createActivity({ member_id: memberId, title: title || "Meeting", hours, date });
    setTitle("");
    setHours(1);
    load();
  };

  const remove = async (id) => {
    await api.deleteActivity(id);
    load();
  };

  return (
    <div>
      <PageHeader
        title="Non-Task Activity"
        subtitle="Catat meeting, support, email, dan aktivitas non-task lainnya."
      />

      <Card className="mb-5 p-5">
        <div className="flex flex-wrap items-end gap-2.5">
          <Select value={memberId} onChange={(e) => setMemberId(e.target.value)} className="w-auto min-w-[160px]">
            <option value="">Pilih anggota</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
          <Input
            placeholder="Judul (mis. Meeting)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="min-w-[180px] flex-1"
          />
          <Input
            type="number"
            min="0.25"
            step="0.25"
            value={hours}
            onChange={(e) => setHours(parseFloat(e.target.value))}
            className="w-24"
          />
          <Button variant="primary" onClick={add}>
            Tambah
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-3 text-[15px] font-semibold text-ink">Aktivitas pada {date}</div>
        {activities.length === 0 && <EmptyState>Belum ada aktivitas</EmptyState>}
        <div className="divide-y divide-line">
          {activities.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <div className="truncate text-[14px] font-medium text-ink">{a.title}</div>
                <div className="text-[12.5px] text-ink-soft">
                  {a.hours} jam · {members.find((m) => m.id === a.member_id)?.name || "Unknown"}
                </div>
              </div>
              <button
                onClick={() => remove(a.id)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-faint hover:bg-status-overload/10 hover:text-status-overload"
                aria-label="Hapus aktivitas"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
