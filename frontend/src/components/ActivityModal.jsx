import { useState } from "react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import { Field, Input, Select } from "./ui/Field";
import { formatDateInput } from "../lib/dateUtils";

export default function ActivityModal({ initial, members, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(
    initial || {
      member_id: members[0]?.id || "",
      title: "",
      hours: 1,
      date: formatDateInput(new Date()),
    }
  );
  const isEdit = Boolean(initial?.id);
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const hours = Number(form.hours);
  const valid =
    Boolean(form.member_id) &&
    form.title.trim() !== "" &&
    Number.isFinite(hours) &&
    hours > 0 &&
    Boolean(form.date);

  return (
    <Modal
      title={isEdit ? "Edit Aktivitas" : "Aktivitas Baru"}
      onClose={onClose}
      footer={
        <>
          {isEdit && (
            <Button variant="danger" onClick={() => onDelete(form.id)} className="mr-auto">
              Hapus
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => onSave({ ...form, title: form.title.trim(), hours })}
          >
            Simpan
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Judul">
          <Input
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="mis. Daily standup, Support client"
            autoFocus
          />
        </Field>

        <Field label="Anggota">
          <Select value={form.member_id} onChange={(e) => update("member_id", e.target.value)}>
            <option value="">Pilih anggota</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Tanggal">
            <Input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} />
          </Field>
          <Field label="Durasi (jam)">
            <Input
              type="number"
              min="0.25"
              step="0.25"
              value={form.hours}
              onChange={(e) => update("hours", e.target.value)}
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
