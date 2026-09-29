import { useState } from "react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import { Field, Input } from "./ui/Field";

export default function SaveQueryModal({ title, initialName = "", onClose, onSave }) {
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const valid = name.trim() !== "";

  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError("");
    try {
      await onSave(name.trim());
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <Modal
      title={title}
      onClose={onClose}
      width={420}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" onClick={submit} disabled={!valid || saving}>
            Simpan
          </Button>
        </>
      }
    >
      <Field label="Nama query">
        <Input
          autoFocus
          maxLength={120}
          placeholder="mis. Tugas overdue per anggota"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      </Field>
      {error && <p className="mt-3 text-[13px] text-status-overload">{error}</p>}
    </Modal>
  );
}
