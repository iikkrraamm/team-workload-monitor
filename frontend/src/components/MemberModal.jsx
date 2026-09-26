import { useState } from "react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import { Field, Input } from "./ui/Field";

export default function MemberModal({ member, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(
    member || { name: "", role: "", capacity_hours_per_day: 8, color: "#0071E3" }
  );
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal
      title={member ? "Edit Anggota" : "Anggota Baru"}
      onClose={onClose}
      footer={
        <>
          {member && (
            <Button variant="danger" onClick={() => onDelete(member.id)} className="mr-auto">
              Hapus
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" onClick={() => onSave(form)}>
            Simpan
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Nama">
          <Input value={form.name} onChange={(e) => update("name", e.target.value)} />
        </Field>
        <Field label="Peran">
          <Input
            value={form.role}
            onChange={(e) => update("role", e.target.value)}
            placeholder="mis. Backend Developer"
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Kapasitas Jam/Hari">
            <Input
              type="number"
              min="1"
              max="16"
              value={form.capacity_hours_per_day}
              onChange={(e) => update("capacity_hours_per_day", parseFloat(e.target.value))}
            />
          </Field>
          <Field label="Warna">
            <input
              type="color"
              value={form.color}
              onChange={(e) => update("color", e.target.value)}
              className="h-10 w-full cursor-pointer rounded-lg border border-line bg-white p-1"
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
