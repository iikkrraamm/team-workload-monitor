import { useCallback, useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { api } from "../lib/api";
import { formatDateInput } from "../lib/dateUtils";
import Card from "../components/ui/Card";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import { Input, Select } from "../components/ui/Field";
import TaskCard from "../components/TaskCard";
import TaskModal from "../components/TaskModal";

const COLUMNS = [
  { key: "todo", label: "Belum Dikerjakan" },
  { key: "in_progress", label: "Dikerjakan" },
  { key: "done", label: "Selesai" },
];

export default function TasksPage({ members, refreshSignal }) {
  const [tasks, setTasks] = useState([]);
  const [filterAssignee, setFilterAssignee] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [filterQ, setFilterQ] = useState("");
  const [filterDueBefore, setFilterDueBefore] = useState("");
  const [filterDueAfter, setFilterDueAfter] = useState("");
  const [formTask, setFormTask] = useState(null);
  const [quickTitle, setQuickTitle] = useState("");

  const load = useCallback(() => {
    const f = {};
    if (filterAssignee) f.assignee_id = filterAssignee;
    if (filterPriority) f.priority = filterPriority;
    if (filterCategory) f.category = filterCategory;
    if (filterProject) f.project = filterProject;
    if (filterQ) f.q = filterQ;
    if (filterDueBefore) f.due_before = filterDueBefore;
    if (filterDueAfter) f.due_after = filterDueAfter;
    api.getTasks(f).then(setTasks).catch(console.error);
  }, [filterAssignee, filterPriority, filterCategory, filterProject, filterQ, filterDueBefore, filterDueAfter]);

  useEffect(() => {
    load();
  }, [load, refreshSignal]);

  const memberById = Object.fromEntries(members.map((m) => [m.id, m]));
  const existingProjects = [...new Set(tasks.map((t) => t.project).filter(Boolean))].sort();

  const buildDefaultDraft = () => ({
    title: "",
    description: "",
    assignee_id: filterAssignee || members[0]?.id || "",
    priority: filterPriority || "medium",
    category: filterCategory || "kerja",
    project: filterProject || "",
    estimated_hours: 4,
    status: "todo",
    start_date: filterDueAfter || formatDateInput(new Date()),
    due_date: filterDueBefore || formatDateInput(new Date(Date.now() + 3 * 86400000)),
  });

  const openNew = () => setFormTask(buildDefaultDraft());

  const openCopy = (task) =>
    setFormTask({
      ...task,
      id: undefined,
      title: `${task.title} (Copy)`,
      status: "todo",
    });

  const quickAdd = async () => {
    if (!quickTitle.trim()) return;
    await api.createTask({
      title: quickTitle.trim(),
      priority: filterPriority || "medium",
      category: filterCategory || "kerja",
      project: filterProject || undefined,
      assignee_id: filterAssignee || undefined,
      estimated_hours: 3,
    });
    setQuickTitle("");
    load();
  };

  const handleSave = async (form) => {
    if (form.id) await api.updateTask(form.id, form);
    else await api.createTask(form);
    setFormTask(null);
    load();
  };

  const handleDelete = async (id) => {
    await api.deleteTask(id);
    setFormTask(null);
    load();
  };

  const moveTask = async (task, newStatus) => {
    await api.updateTask(task.id, { status: newStatus });
    load();
  };

  const resetFilters = () => {
    setFilterAssignee("");
    setFilterPriority("");
    setFilterCategory("");
    setFilterProject("");
    setFilterQ("");
    setFilterDueBefore("");
    setFilterDueAfter("");
  };

  return (
    <div>
      <PageHeader
        title="Tugas Tim"
        subtitle="Kelola tugas dengan cepat — geser status, atau pakai chat AI untuk input super cepat."
        action={
          <Button variant="primary" onClick={openNew}>
            <Plus size={16} /> Tugas Baru
          </Button>
        }
      />

      <Card className="mb-5 p-5">
        <div className="flex gap-2">
          <Input
            placeholder="Tambah cepat: ketik judul tugas lalu Enter..."
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && quickAdd()}
            className="flex-1"
          />
          <Button variant="primary" onClick={quickAdd}>
            Tambah
          </Button>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
          <Select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)} className="w-auto min-w-[150px]">
            <option value="">Semua anggota</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
          <Select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="w-auto min-w-[140px]">
            <option value="">Semua prioritas</option>
            <option value="urgent">Urgent</option>
            <option value="high">Tinggi</option>
            <option value="medium">Sedang</option>
            <option value="low">Rendah</option>
          </Select>
          <Select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-auto min-w-[150px]">
            <option value="">Semua kategori</option>
            <option value="kerja">Kerja</option>
            <option value="meeting">Meeting/Diskusi</option>
            <option value="cuti">Cuti/Libur</option>
            <option value="lainnya">Lainnya</option>
          </Select>
          <Input
            list="project-filter-suggestions"
            placeholder="Filter project..."
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="w-40"
          />
          <datalist id="project-filter-suggestions">
            {existingProjects.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <Input
              placeholder="Cari judul/deskripsi..."
              value={filterQ}
              onChange={(e) => setFilterQ(e.target.value)}
              className="w-48 pl-8"
            />
          </div>
          <label className="flex items-center gap-1.5 text-[12.5px] text-ink-soft">
            Due setelah
            <Input type="date" value={filterDueAfter} onChange={(e) => setFilterDueAfter(e.target.value)} className="w-auto" />
          </label>
          <label className="flex items-center gap-1.5 text-[12.5px] text-ink-soft">
            Due sebelum
            <Input type="date" value={filterDueBefore} onChange={(e) => setFilterDueBefore(e.target.value)} className="w-auto" />
          </label>
          <Button variant="subtle" onClick={load}>
            Filter
          </Button>
          <Button variant="ghost" onClick={resetFilters}>
            Reset
          </Button>
        </div>
      </Card>

      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 snap-x snap-mandatory md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.key);
          return (
            <div key={col.key} className="w-[85vw] shrink-0 snap-start md:w-auto md:shrink">
              <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-ink-soft">
                {col.label}
                <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-[11px] text-ink-soft">
                  {colTasks.length}
                </span>
              </div>
              {colTasks.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  assignee={memberById[t.assignee_id]}
                  columns={COLUMNS}
                  currentStatus={col.key}
                  onOpen={() => setFormTask(t)}
                  onMove={(newStatus) => moveTask(t, newStatus)}
                  onCopy={openCopy}
                />
              ))}
              {colTasks.length === 0 && <EmptyState>Tidak ada tugas</EmptyState>}
            </div>
          );
        })}
      </div>

      {formTask && (
        <TaskModal
          initial={formTask}
          members={members}
          existingProjects={existingProjects}
          onClose={() => setFormTask(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
