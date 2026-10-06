import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { api } from "../lib/api";
import Card from "../components/ui/Card";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import { Field, Input } from "../components/ui/Field";
import { StatusPill } from "../components/ui/Badge";

// Keep these limits and messages in step with backend/settings.py.
const MAX_PERCENT = 1000;
const REFERENCE_CAPACITY_HOURS = 8; // only used for the "setara ... jam" hints

const FIELDS = [
  { key: "low_max", label: "Low: di bawah", name: "Batas atas Low", hint: "Beban di bawah angka ini berstatus Low." },
  { key: "normal_max", label: "Normal: sampai", name: "Batas atas Normal", hint: "Dari batas Low sampai angka ini (termasuk) berstatus Normal." },
  { key: "overload_from", label: "Overload: mulai dari", name: "Overload mulai dari", hint: "Beban sama dengan atau di atas angka ini berstatus Overload. Antara Normal dan angka ini adalah Padat." },
];

const fmt = (n) => Number(Number(n).toFixed(2)).toString();
const fmtHours = (percent) => fmt((percent / 100) * REFERENCE_CAPACITY_HOURS).replace(".", ",");

function parse(form) {
  return Object.fromEntries(
    FIELDS.map(({ key }) => [key, form[key].trim() === "" ? NaN : Number(form[key])])
  );
}

function validate(values) {
  const errors = {};
  for (const { key, name } of FIELDS) {
    const v = values[key];
    if (!Number.isFinite(v)) errors[key] = `${name} harus berupa angka.`;
    else if (v <= 0) errors[key] = `${name} harus lebih besar dari 0.`;
    else if (v > MAX_PERCENT) errors[key] = `${name} maksimal ${MAX_PERCENT}%.`;
  }
  if (Object.keys(errors).length === 0) {
    if (!(values.low_max < values.normal_max)) errors.normal_max = "Batas atas Normal harus lebih besar dari batas atas Low.";
    if (!(values.normal_max < values.overload_from)) errors.overload_from = "Overload harus mulai di atas batas atas Normal.";
  }
  return errors;
}

function bandsFor(v) {
  return [
    { status: "idle", rule: "tanpa beban (0 jam)" },
    { status: "low", rule: `di bawah ${fmt(v.low_max)}%` },
    { status: "normal", rule: `${fmt(v.low_max)}% sampai ${fmt(v.normal_max)}%` },
    { status: "padat", rule: `di atas ${fmt(v.normal_max)}% sampai di bawah ${fmt(v.overload_from)}%` },
    { status: "overload", rule: `${fmt(v.overload_from)}% atau lebih` },
  ];
}

const BAR_COLOR = {
  low: "bg-status-low",
  normal: "bg-status-normal",
  padat: "bg-status-padat",
  overload: "bg-status-overload",
};

function BandBar({ values }) {
  // A visual aid only; the list next to it states the same ranges in words.
  const scale = Math.max(values.overload_from * 1.3, 100);
  const parts = [
    ["low", values.low_max],
    ["normal", values.normal_max - values.low_max],
    ["padat", values.overload_from - values.normal_max],
    ["overload", scale - values.overload_from],
  ];
  return (
    <div aria-hidden="true" className="flex h-2.5 w-full overflow-hidden rounded-full bg-ink/[0.06]">
      {parts.map(([status, size]) => (
        <div key={status} className={BAR_COLOR[status]} style={{ width: `${(size / scale) * 100}%` }} />
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const [saved, setSaved] = useState(null); // { values, defaults, is_default }
  const [form, setForm] = useState(null); // strings, so a half-typed "11" is allowed
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState("");
  const [notice, setNotice] = useState("");

  const adopt = (payload) => {
    setSaved(payload);
    setForm(Object.fromEntries(FIELDS.map(({ key }) => [key, String(payload.values[key])])));
  };

  useEffect(() => {
    api.getThresholds().then(adopt).catch((e) => setLoadError(e.message));
  }, []);

  const values = useMemo(() => (form ? parse(form) : null), [form]);
  const errors = useMemo(() => (values ? validate(values) : {}), [values]);
  const valid = Object.keys(errors).length === 0;
  const dirty = !!saved && !!values && FIELDS.some(({ key }) => values[key] !== saved.values[key]);

  const edit = (key, text) => {
    setForm((f) => ({ ...f, [key]: text }));
    setNotice("");
    setServerError("");
  };

  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setServerError("");
    try {
      adopt(await api.updateThresholds(values));
      setNotice("Tersimpan. Dashboard, Analisis Beban, saran overload, dan peringatan burnout langsung memakai batas ini.");
    } catch (e) {
      setServerError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (busy) return;
    setBusy(true);
    setServerError("");
    try {
      adopt(await api.resetThresholds());
      setNotice("Dikembalikan ke nilai bawaan.");
    } catch (e) {
      setServerError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Pengaturan"
        subtitle="Atur ambang batas status beban kerja tanpa mengubah kode."
      />

      <Card className="min-w-0 p-5">
        <div className="text-[15px] font-semibold text-ink">Ambang beban kerja</div>
        <p className="mt-1 text-[13px] text-ink-soft">
          Persentase = jam terpakai ÷ kapasitas. Batas yang sama dipakai di dashboard, Analisis Beban, saran overload,
          dan peringatan burnout (hari kerja dihitung overload bila statusnya Overload).
        </p>

        {loadError && <p className="mt-4 text-[13px] text-status-overload">Gagal memuat pengaturan: {loadError}</p>}
        {!form && !loadError && <EmptyState>Memuat...</EmptyState>}

        {form && (
          <div className="mt-5 space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {FIELDS.map(({ key, label, hint }) => (
                <Field key={key} label={label}>
                  <div className="relative">
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0"
                      max={MAX_PERCENT}
                      value={form[key]}
                      onChange={(e) => edit(key, e.target.value)}
                      aria-invalid={!!errors[key]}
                      className="pr-9"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-ink-faint">%</span>
                  </div>
                  {errors[key] ? (
                    <p className="mt-1.5 text-[12px] text-status-overload">{errors[key]}</p>
                  ) : (
                    <p className="mt-1.5 text-[12px] text-ink-faint">
                      {Number.isFinite(values[key]) ? `≈ ${fmtHours(values[key])} jam dari ${REFERENCE_CAPACITY_HOURS} jam/hari. ` : ""}
                      {hint}
                    </p>
                  )}
                </Field>
              ))}
            </div>

            <div>
              <div className="mb-2 text-[13px] font-semibold text-ink">Hasilnya</div>
              {valid ? (
                <>
                  <BandBar values={values} />
                  <ul className="mt-3 space-y-2">
                    {bandsFor(values).map((b) => (
                      <li key={b.status} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="w-24 shrink-0">
                          <StatusPill status={b.status} />
                        </span>
                        <span className="text-[13px] text-ink-soft">{b.rule}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-[13px] text-ink-faint">Perbaiki isian di atas untuk melihat pratinjau.</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" onClick={save} disabled={!valid || !dirty || busy}>
                <Save size={15} /> Simpan
              </Button>
              <Button variant="ghost" onClick={reset} disabled={busy || (saved.is_default && !dirty)}>
                <RotateCcw size={15} /> Kembalikan ke bawaan
              </Button>
              {!saved.is_default && !dirty && (
                <span className="text-[12px] text-ink-faint">
                  Bawaan: {fmt(saved.defaults.low_max)}% / {fmt(saved.defaults.normal_max)}% / {fmt(saved.defaults.overload_from)}%
                </span>
              )}
            </div>

            {notice && <p className="text-[13px] text-ok" role="status">{notice}</p>}
            {serverError && <p className="text-[13px] text-status-overload" role="alert">{serverError}</p>}

            <p className="border-t border-line pt-4 text-[12px] text-ink-faint">
              Pengaturan ini berlaku untuk semua pengguna aplikasi dan tersimpan di database.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
