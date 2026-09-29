import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import {
  ChevronRight,
  Lock,
  Pencil,
  Play,
  Plus,
  Save,
  Search,
  Table2,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { api } from "../lib/api";
import Card from "../components/ui/Card";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import { Input, Textarea } from "../components/ui/Field";
import SaveQueryModal from "../components/SaveQueryModal";
import SqlResultTable from "../components/SqlResultTable";

const DEFAULT_SQL = "SELECT * FROM tasks LIMIT 20;";

export default function SqlPage({ onDataChanged }) {
  const editorRef = useRef(null);
  const [sql, setSql] = useState(DEFAULT_SQL);
  const [hasSelection, setHasSelection] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const [saved, setSaved] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [filterQ, setFilterQ] = useState("");
  const [saveModal, setSaveModal] = useState(null); // { mode: "new" | "rename", query? }

  const [schema, setSchema] = useState({ tables: [], allow_write: false });
  const [openTables, setOpenTables] = useState({});

  const loadSaved = useCallback(() => {
    api.getSavedQueries().then(setSaved).catch(console.error);
  }, []);
  const loadSchema = useCallback(() => {
    api.getSqlSchema().then(setSchema).catch(console.error);
  }, []);

  useEffect(() => {
    loadSaved();
    loadSchema();
  }, [loadSaved, loadSchema]);

  const activeQuery = useMemo(() => saved.find((q) => q.id === activeId) || null, [saved, activeId]);
  const dirty = activeQuery ? sql.trim() !== activeQuery.sql.trim() : false;

  const visibleSaved = useMemo(() => {
    const q = filterQ.trim().toLowerCase();
    if (!q) return saved;
    return saved.filter((s) => s.name.toLowerCase().includes(q) || s.sql.toLowerCase().includes(q));
  }, [saved, filterQ]);

  const confirmDiscard = () => !dirty || window.confirm("Perubahan pada query ini belum disimpan. Lanjutkan?");

  // Runs the highlighted text when there is a selection, like most SQL
  // clients, so one statement can be tried out of a longer script.
  const currentStatement = () => {
    const el = editorRef.current;
    if (el && el.selectionStart !== el.selectionEnd) {
      const selected = sql.slice(el.selectionStart, el.selectionEnd);
      if (selected.trim()) return selected;
    }
    return sql;
  };

  const run = async () => {
    const statement = currentStatement();
    if (!statement.trim() || running) return;
    setRunning(true);
    setError("");
    try {
      const res = await api.executeSql(statement);
      setResult(res);
      // Only possible when the server allows writes: keep the rest of the
      // app (team list, tasks, schema browser) in step with the change.
      if (res.rows_affected !== undefined) {
        loadSchema();
        onDataChanged?.();
      }
    } catch (e) {
      setResult(null);
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  const onEditorKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      run();
    }
  };

  const syncSelection = (e) => setHasSelection(e.target.selectionStart !== e.target.selectionEnd);

  const newQuery = () => {
    if (!confirmDiscard()) return;
    setActiveId(null);
    setSql("");
    setResult(null);
    setError("");
    editorRef.current?.focus();
  };

  const openSaved = (query) => {
    if (query.id === activeId) return;
    if (!confirmDiscard()) return;
    setActiveId(query.id);
    setSql(query.sql);
    setResult(null);
    setError("");
  };

  const handleSaveClick = async () => {
    if (!sql.trim()) return;
    if (!activeQuery) return setSaveModal({ mode: "new" });
    try {
      await api.updateSavedQuery(activeQuery.id, { sql });
      loadSaved();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleModalSave = async (name) => {
    if (saveModal.mode === "rename") {
      await api.updateSavedQuery(saveModal.query.id, { name });
    } else {
      const created = await api.createSavedQuery({ name, sql });
      setActiveId(created.id);
    }
    setSaveModal(null);
    loadSaved();
  };

  const handleDelete = async (query) => {
    if (!window.confirm(`Hapus query "${query.name}"?`)) return;
    try {
      await api.deleteSavedQuery(query.id);
      if (query.id === activeId) setActiveId(null);
      loadSaved();
    } catch (e) {
      alert(e.message);
    }
  };

  const insertTableQuery = (table) => {
    if (!confirmDiscard()) return;
    setActiveId(null);
    setSql(`SELECT * FROM ${table} LIMIT 100;`);
  };

  return (
    <div>
      <PageHeader
        title="SQL Client"
        subtitle="Jalankan query ke database aplikasi dan simpan query yang sering dipakai."
        action={
          schema.allow_write ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-status-padat/15 px-3 py-1.5 text-[12.5px] font-medium text-status-padat">
              <TriangleAlert size={14} /> Mode tulis aktif
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/[0.05] px-3 py-1.5 text-[12.5px] font-medium text-ink-soft">
              <Lock size={14} /> Read-only
            </span>
          )
        }
      />

      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Side column: below the editor on phones, left on desktop */}
        <div className="order-2 space-y-5 lg:order-1">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-ink">Query Tersimpan</h2>
              <span className="text-[12px] text-ink-faint">{saved.length}</span>
            </div>
            <div className="relative mb-3">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              <Input
                placeholder="Cari query..."
                value={filterQ}
                onChange={(e) => setFilterQ(e.target.value)}
                className="pl-8"
              />
            </div>

            {saved.length === 0 && <EmptyState>Belum ada query tersimpan</EmptyState>}
            {saved.length > 0 && visibleSaved.length === 0 && <EmptyState>Tidak ada yang cocok</EmptyState>}

            <ul className="max-h-[360px] space-y-1 overflow-y-auto">
              {visibleSaved.map((q) => (
                <li
                  key={q.id}
                  className={clsx(
                    "group flex items-center gap-1 rounded-xl pr-1 transition-colors",
                    q.id === activeId ? "bg-accent-soft" : "hover:bg-ink/[0.04]"
                  )}
                >
                  <button onClick={() => openSaved(q)} className="min-w-0 flex-1 px-3 py-2 text-left">
                    <div
                      className={clsx(
                        "truncate text-[13.5px] font-medium",
                        q.id === activeId ? "text-accent" : "text-ink"
                      )}
                    >
                      {q.name}
                    </div>
                    <div className="truncate font-mono text-[11.5px] text-ink-faint">
                      {q.sql.replace(/\s+/g, " ")}
                    </div>
                  </button>
                  <button
                    onClick={() => setSaveModal({ mode: "rename", query: q })}
                    aria-label={`Ubah nama ${q.name}`}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-faint hover:bg-ink/5 hover:text-ink"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(q)}
                    aria-label={`Hapus ${q.name}`}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-faint hover:bg-status-overload/10 hover:text-status-overload"
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-4">
            <h2 className="mb-3 text-[14px] font-semibold text-ink">Skema Database</h2>
            <ul className="space-y-0.5">
              {schema.tables.map((t) => {
                const open = !!openTables[t.name];
                return (
                  <li key={t.name}>
                    <button
                      onClick={() => setOpenTables((o) => ({ ...o, [t.name]: !open }))}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] font-medium text-ink hover:bg-ink/[0.04]"
                    >
                      <ChevronRight size={14} className={clsx("shrink-0 text-ink-faint transition-transform", open && "rotate-90")} />
                      <Table2 size={14} className="shrink-0 text-ink-soft" />
                      <span className="truncate">{t.name}</span>
                    </button>
                    {open && (
                      <div className="mb-1 ml-6 border-l border-line pl-3">
                        {t.columns.map((c) => (
                          <div key={c.name} className="flex items-baseline justify-between gap-2 py-0.5 font-mono text-[12px]">
                            <span className={clsx("truncate", c.pk ? "font-semibold text-ink" : "text-ink-soft")}>
                              {c.name}
                            </span>
                            <span className="shrink-0 text-[11px] text-ink-faint">{c.type || "-"}</span>
                          </div>
                        ))}
                        <button
                          onClick={() => insertTableQuery(t.name)}
                          className="mt-1 text-[12px] font-medium text-accent hover:underline"
                        >
                          SELECT * FROM {t.name}
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        {/* Main column */}
        <div className="order-1 min-w-0 space-y-5 lg:order-2">
          <Card className="p-4 sm:p-5">
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0 text-[13px] text-ink-soft">
                {activeQuery ? (
                  <>
                    <span className="font-medium text-ink">{activeQuery.name}</span>
                    {dirty && <span className="ml-2 text-status-padat">• belum disimpan</span>}
                  </>
                ) : (
                  "Query baru"
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={newQuery}>
                <Plus size={14} /> Baru
              </Button>
            </div>

            <Textarea
              ref={editorRef}
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              onKeyDown={onEditorKeyDown}
              onSelect={syncSelection}
              onBlur={syncSelection}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              rows={8}
              placeholder="SELECT * FROM tasks WHERE status = 'todo';"
              className="block min-h-[160px] resize-y font-mono text-[13px] leading-relaxed"
            />

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button variant="primary" onClick={run} disabled={!sql.trim() || running}>
                <Play size={15} /> {running ? "Menjalankan..." : hasSelection ? "Jalankan seleksi" : "Jalankan"}
              </Button>
              <Button
                variant="subtle"
                onClick={handleSaveClick}
                disabled={!sql.trim() || (!!activeQuery && !dirty)}
              >
                <Save size={15} /> Simpan
              </Button>
              {activeQuery && (
                <Button variant="ghost" onClick={() => setSaveModal({ mode: "new" })} disabled={!sql.trim()}>
                  Simpan sebagai baru
                </Button>
              )}
              <span className="ml-auto hidden text-[12px] text-ink-faint sm:block">Ctrl/⌘ + Enter untuk menjalankan</span>
            </div>
          </Card>

          {error && (
            <div className="rounded-xl border border-status-overload/30 bg-status-overload/[0.06] px-4 py-3 font-mono text-[12.5px] text-status-overload">
              {error}
            </div>
          )}

          {result && (
            <Card className="p-4 sm:p-5">
              {result.rows_affected !== undefined ? (
                <p className="text-[13.5px] text-ink">
                  Berhasil. {result.rows_affected} baris terpengaruh
                  <span className="text-ink-faint"> · {result.elapsed_ms} ms</span>
                </p>
              ) : (
                <>
                  <div className="mb-3 text-[12.5px] text-ink-soft">
                    {result.row_count} baris · {result.elapsed_ms} ms
                    {result.truncated && (
                      <span className="ml-2 text-status-padat">
                        Hanya {result.row_count} baris pertama yang ditampilkan. Tambahkan LIMIT / WHERE untuk mempersempit.
                      </span>
                    )}
                  </div>
                  {result.row_count === 0 ? (
                    <EmptyState>Query berhasil, tapi tidak ada baris yang dikembalikan</EmptyState>
                  ) : (
                    <SqlResultTable columns={result.columns} rows={result.rows} />
                  )}
                </>
              )}
            </Card>
          )}
        </div>
      </div>

      {saveModal && (
        <SaveQueryModal
          title={saveModal.mode === "rename" ? "Ubah Nama Query" : "Simpan Query"}
          initialName={saveModal.mode === "rename" ? saveModal.query.name : ""}
          onClose={() => setSaveModal(null)}
          onSave={handleModalSave}
        />
      )}
    </div>
  );
}
