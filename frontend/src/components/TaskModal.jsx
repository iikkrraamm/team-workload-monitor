import { useState } from "react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import { Field, Input, Select, Textarea } from "./ui/Field";

const FALLBACK_DEFAULTS = {
  title: "",
  description: "",
  assignee_id: "",
  priority: "medium",
  category: "kerja",
  project: "",
  estimated_hours: 4,
  status: "todo",
  start_date: new Date().toISOString().slice(0, 10),
  due_date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
};

export default function TaskModal({ initial, members, existingProjects = [], onClose, onSave, onDelete }) {
  const [form, setForm] = useState(initial || FALLBACK_DEFAULTS);
  const isEdit = Boolean(initial?.id);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal
      title={isEdit ? "Edit Tugas" : "Tugas Baru"}
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
          <Button variant="primary" onClick={() => onSave(form)}>
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
            placeholder="Judul tugas"
          />
        </Field>

        <Field label="Deskripsi">
          <Textarea rows={2} value={form.description} onChange={(e) => update("description", e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Penanggung Jawab">
            <Select value={form.assignee_id || ""} onChange={(e) => update("assignee_id", e.target.value)}>
              <option value="">Belum ditentukan</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Prioritas">
            <Select value={form.priority} onChange={(e) => update("priority", e.target.value)}>
              <option value="low">Rendah</option>
              <option value="medium">Sedang</option>
              <option value="high">Tinggi</option>
              <option value="urgent">Urgent</option>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Kategori">
            <Select value={form.category || "kerja"} onChange={(e) => update("category", e.target.value)}>
              <option value="kerja">Kerja (ada hasil — coding, dokumen, dll)</option>
              <option value="meeting">Meeting/Diskusi</option>
              <option value="cuti">Cuti/Libur</option>
              <option value="lainnya">Lainnya</option>
            </Select>
          </Field>
          <Field label="Project">
            <Input
              list="project-suggestions"
              value={form.project || ""}
              onChange={(e) => update("project", e.target.value)}
              placeholder="mis. Smart Chatbot"
            />
            <datalist id="project-suggestions">
              {existingProjects.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Estimasi Jam">
            <Input
              type="number"
              min="0.5"
              step="0.5"
              value={form.estimated_hours}
              onChange={(e) => update("estimated_hours", parseFloat(e.target.value))}
            />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => update("status", e.target.value)}>
              <option value="todo">Belum Dikerjakan</option>
              <option value="in_progress">Dikerjakan</option>
              <option value="done">Selesai</option>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Mulai">
            <Input type="date" value={form.start_date} onChange={(e) => update("start_date", e.target.value)} />
          </Field>
          <Field label="Deadline">
            <Input type="date" value={form.due_date} onChange={(e) => update("due_date", e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
