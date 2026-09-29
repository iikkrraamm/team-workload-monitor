import { useState } from "react";
import { Download } from "lucide-react";
import { api } from "../lib/api";
import { downloadBlob } from "../lib/download";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import SegmentedControl from "./ui/SegmentedControl";
import { Field, Input, Select } from "./ui/Field";

const PRESETS = [
  { key: "comma", label: "Koma ( , )", value: "," },
  { key: "semicolon", label: "Titik koma ( ; )", value: ";" },
  { key: "tab", label: "Tab", value: "\t" },
  { key: "pipe", label: "Pipe ( | )", value: "|" },
  { key: "custom", label: "Lainnya...", value: null },
];
const MAX_DELIMITER_LENGTH = 10;
const PREFS_KEY = "sql-export-prefs";
const DEFAULT_PREFS = { format: "xlsx", delimiterKey: "comma", custom: "", header: true, formulaSafe: true };

function loadPrefs() {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* private mode / storage disabled: preferences just won't persist */
  }
}

export default function ExportResultModal({ sql, columns, name, truncated, onClose, onDone }) {
  const [prefs, setPrefs] = useState(loadPrefs);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (patch) => setPrefs((p) => ({ ...p, ...patch }));

  const isText = prefs.format === "text";
  const preset = PRESETS.find((p) => p.key === prefs.delimiterKey) || PRESETS[0];
  const delimiter = preset.value ?? prefs.custom;
  const delimiterError =
    isText && (delimiter === "" || /["\r\n]/.test(delimiter))
      ? delimiter === ""
        ? "Isi delimiter terlebih dahulu"
        : "Delimiter tidak boleh berisi tanda kutip atau baris baru"
      : "";

  const submit = async () => {
    if (busy || delimiterError) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.exportSql({
        sql,
        name,
        format: prefs.format,
        delimiter,
        header: prefs.header,
        formula_safe: prefs.formulaSafe,
      });
      savePrefs(prefs);
      downloadBlob(result.blob, result.filename);
      onDone(result);
      onClose();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const shownColumns = columns.slice(0, 4);

  return (
    <Modal
      title="Ekspor Hasil"
      onClose={onClose}
      width={460}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" onClick={submit} disabled={busy || !!delimiterError}>
            <Download size={15} /> {busy ? "Menyiapkan..." : "Unduh"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <SegmentedControl
          value={prefs.format}
          onChange={(format) => set({ format })}
          options={[
            { value: "xlsx", label: "Excel (.xlsx)" },
            { value: "text", label: "Teks (CSV/TSV)" },
          ]}
        />

        {!isText && (
          <p className="text-[13px] text-ink-soft">
            Angka tetap tersimpan sebagai angka, NULL menjadi sel kosong, dan baris judul dibuat tebal serta dibekukan.
          </p>
        )}

        {isText && (
          <>
            <Field label="Delimiter (pemisah kolom)">
              <Select value={prefs.delimiterKey} onChange={(e) => set({ delimiterKey: e.target.value })}>
                {PRESETS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>

            {preset.key === "custom" && (
              <Field label="Delimiter kustom">
                <Input
                  autoFocus
                  maxLength={MAX_DELIMITER_LENGTH}
                  placeholder="mis. ~ atau ||"
                  value={prefs.custom}
                  onChange={(e) => set({ custom: e.target.value })}
                  className="font-mono"
                />
                <p className="mt-1 text-[12px] text-ink-faint">
                  Maksimal {MAX_DELIMITER_LENGTH} karakter, boleh lebih dari satu.
                </p>
              </Field>
            )}
            {delimiterError && <p className="text-[13px] text-status-overload">{delimiterError}</p>}

            {!delimiterError && (
              <div className="rounded-lg bg-ink/[0.04] px-3 py-2 font-mono text-[12.5px] text-ink">
                {shownColumns.map((col, i) => (
                  <span key={i}>
                    {i > 0 && <span className="font-bold text-accent">{delimiter === "\t" ? "⇥" : delimiter}</span>}
                    {col}
                  </span>
                ))}
                {columns.length > shownColumns.length && <span className="text-ink-faint"> ...</span>}
              </div>
            )}

            <div className="space-y-2.5">
              <label className="flex items-center gap-2.5 text-[13.5px] text-ink">
                <input
                  type="checkbox"
                  checked={prefs.header}
                  onChange={(e) => set({ header: e.target.checked })}
                  className="h-4 w-4 accent-accent"
                />
                Sertakan baris judul kolom
              </label>
              <label className="flex items-start gap-2.5 text-[13.5px] text-ink">
                <input
                  type="checkbox"
                  checked={prefs.formulaSafe}
                  onChange={(e) => set({ formulaSafe: e.target.checked })}
                  className="mt-0.5 h-4 w-4 accent-accent"
                />
                <span>
                  Amankan dari formula
                  <span className="block text-[12px] text-ink-faint">
                    Teks yang diawali = + - @ diberi tanda ' di depan supaya tidak dijalankan sebagai formula saat
                    dibuka di Excel/Sheets.
                  </span>
                </span>
              </label>
            </div>
          </>
        )}

        {truncated && (
          <p className="text-[12.5px] text-ink-soft">
            Tabel hanya menampilkan 1000 baris pertama. Ekspor menjalankan ulang query dan mencakup hingga 100.000 baris.
          </p>
        )}
        {error && <p className="text-[13px] text-status-overload">{error}</p>}
      </div>
    </Modal>
  );
}
