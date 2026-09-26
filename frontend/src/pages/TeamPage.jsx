import { useState } from "react";
import { Plus } from "lucide-react";
import { api } from "../lib/api";
import Card from "../components/ui/Card";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import Avatar from "../components/ui/Avatar";
import MemberModal from "../components/MemberModal";

export default function TeamPage({ members, reload }) {
  const [editing, setEditing] = useState(null);
  const [showNew, setShowNew] = useState(false);

  const handleSave = async (form) => {
    if (form.id) await api.updateMember(form.id, form);
    else await api.createMember(form);
    setEditing(null);
    setShowNew(false);
    reload();
  };

  const handleDelete = async (id) => {
    await api.deleteMember(id);
    setEditing(null);
    reload();
  };

  return (
    <div>
      <PageHeader
        title="Anggota Tim"
        subtitle="Atur kapasitas jam kerja harian tiap anggota untuk perhitungan beban yang akurat."
        action={
          <Button variant="primary" onClick={() => setShowNew(true)}>
            <Plus size={16} /> Tambah Anggota
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((m) => (
          <Card
            key={m.id}
            className="cursor-pointer p-5 transition-shadow hover:shadow-soft"
            onClick={() => setEditing(m)}
          >
            <div className="flex items-center gap-3">
              <Avatar name={m.name} color={m.color} size={48} />
              <div className="min-w-0">
                <div className="truncate text-[14.5px] font-semibold text-ink">{m.name}</div>
                <div className="truncate text-[12.5px] text-ink-soft">{m.role}</div>
              </div>
            </div>
            <div className="mt-4 text-[12.5px] text-ink-soft">
              Kapasitas <strong className="font-semibold text-ink">{m.capacity_hours_per_day} jam/hari</strong>
            </div>
          </Card>
        ))}
      </div>

      {(editing || showNew) && (
        <MemberModal
          member={editing}
          onClose={() => {
            setEditing(null);
            setShowNew(false);
          }}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
