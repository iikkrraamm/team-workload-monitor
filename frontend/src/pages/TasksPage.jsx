import { useEffect, useState } from "react";
import { Plus, Search, LayoutGrid, List } from "lucide-react";
import { api } from "../lib/api";
import { formatDateInput } from "../lib/dateUtils";
import Card from "../components/ui/Card";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import { Input } from "../components/ui/Field";
import MultiSelect from "../components/ui/MultiSelect";
import SegmentedControl from "../components/ui/SegmentedControl";
import KanbanColumn from "../components/KanbanColumn";
import TaskModal from "../components/TaskModal";
import TaskListView from "../components/TaskListView";

const VIEW_STORAGE_KEY = "tasks-view-mode";
const LIST_PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 300;

const VIEW_OPTIONS = [
  {
    value: "kanban",
    label: (
      <span className="flex items-center gap-1.5">
        <LayoutGrid size={14} /> Kanban
      </span>
    ),
  },
  {
    value: "list",
    label: (
      <span className="flex items-center gap-1.5">
        <List size={14} /> List
      </span>
    ),
  },
];

const COLUMNS = [
  { key: "todo", label: "Belum Dikerjakan" },
  { key: "in_progress", label: "Dikerjakan" },
  { key: "done", label: "Selesai" },
];

const STATUS_FILTER_OPTIONS = COLUMNS.map((c) => ({ value: c.key, label: c.label }));

const PRIORITY_OPTIONS = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "Tinggi" },
  { value: "medium", label: "Sedang" },
  { value: "low", label: "Rendah" },
];

const CATEGORY_OPTIONS = [
  { value: "kerja", label: "Kerja" },
  { value: "meeting", label: "Meeting/Diskusi" },
  { value: "cuti", label: "Cuti/Libur" },
  { value: "lainnya", label: "Lainnya" },
];

// When a multi-select filter has exactly one value picked, that value is a
// sensible default for new tasks; with none or several picked it isn't.
const onlyValue = (arr) => (arr.length === 1 ? arr[0] : undefined);

export default function TasksPage({ members, refreshSignal }) {
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem(VIEW_STORAGE_KEY) === "list" ? "list" : "kanban";
    } catch {
      return "kanban";
    }
  });

  // Status filter exists only in the List view; in Kanban the status is the column.
  const [filterStatus, setFilterStatus] = useState([]);
  const [filterAssignee, setFilterAssignee] = useState([]);
  const [filterPriority, setFilterPriority] = useState([]);
  const [filterCategory, setFilterCategory] = useState([]);
  const [filterProject, setFilterProject] = useState([]);
  const [filterQ, setFilterQ] = useState("");
  const [filterDueBefore, setFilterDueBefore] = useState("");
  const [filterDueAfter, setFilterDueAfter] = useState("");

  // Debounced so fast typing in the search box doesn't fire a server
  // request per keystroke — both views now hit the server on every filter
  // change, so this matters more than it did with client-side filtering.
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(filterQ), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [filterQ]);

  // List data (server-paginated and incrementally appended).
  const [listTasks, setListTasks] = useState([]);
  const [listTotal, setListTotal] = useState(0);
  const [listPage, setListPage] = useState(1);
  const [listLoading, setListLoading] = useState(true);
  const [listLoadingMore, setListLoadingMore] = useState(false);

  const [allProjects, setAllProjects] = useState([]);
  const [formTask, setFormTask] = useState(null);
  const [quickTitle, setQuickTitle] = useState("");
  // Bumped after any create/update/delete to trigger a refetch of whichever
  // view is currently active (see the two data-loading effects below).
  const [reloadTick, setReloadTick] = useState(0);
  const bump = () => setReloadTick((n) => n + 1);
  const kanbanReloadKey = `${refreshSignal}:${reloadTick}`;

  const filterParams = () => {
    const f = {};
    if (filterAssignee.length) f.assignee_id = filterAssignee;
    if (filterPriority.length) f.priority = filterPriority;
    if (filterCategory.length) f.category = filterCategory;
    if (filterProject.length) f.project = filterProject;
    if (debouncedQ) f.q = debouncedQ;
    if (filterDueBefore) f.due_before = filterDueBefore;
    if (filterDueAfter) f.due_after = filterDueAfter;
    return f;
  };
  // The List adds the status filter on top of the shared ones.
  const listParams = () => ({
    ...filterParams(),
    ...(filterStatus.length ? { status: filterStatus } : {}),
    sort: "kanban",
  });
  const listFilterKey = JSON.stringify(listParams());

  // Fetch List data only while that view is active — Kanban's three columns
  // fetch independently inside KanbanColumn itself.

  useEffect(() => {
    if (viewMode !== "list") return undefined;
    let cancelled = false;
    setListLoading(true);
    setListLoadingMore(false);
    setListTasks([]);
    setListPage(1);
    api
      .getTasksPage(listParams(), 1, LIST_PAGE_SIZE)
      .then((data) => {
        if (cancelled) return;
        setListTasks(data.items);
        setListTotal(data.total);
        setListLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(err);
          setListLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, listFilterKey, refreshSignal, reloadTick]);

  const loadMoreListTasks = () => {
    if (listLoading || listLoadingMore || listTasks.length >= listTotal) return;
    setListLoadingMore(true);
    api
      .getTasksPage(listParams(), listPage + 1, LIST_PAGE_SIZE)
      .then((data) => {
        setListTasks((prev) => [...prev, ...data.items]);
        setListTotal(data.total);
        setListPage((page) => page + 1);
        setListLoadingMore(false);
      })
      .catch((err) => {
        console.error(err);
        setListLoadingMore(false);
      });
  };

  // Project suggestions must come from ALL tasks, not the filtered/paginated
  // list — otherwise filtering by one project would hide every other
  // suggestion, or a later page would be needed to discover them.
  useEffect(() => {
    api
      .getTasks({})
      .then((all) => setAllProjects([...new Set(all.map((t) => t.project).filter(Boolean))].sort()))
      .catch(console.error);
  }, [refreshSignal, reloadTick]);

  const memberById = Object.fromEntries(members.map((m) => [m.id, m]));
  const memberOptions = members.map((m) => ({ value: m.id, label: m.name }));
  const projectOptions = allProjects.map((p) => ({ value: p, label: p }));
  const buildDefaultDraft = () => ({
    title: "",
    description: "",
    assignee_id: onlyValue(filterAssignee) || members[0]?.id || "",
    priority: onlyValue(filterPriority) || "medium",
    category: onlyValue(filterCategory) || "kerja",
    project: onlyValue(filterProject) || "",
    estimated_hours: 4,
    status: (viewMode === "list" && onlyValue(filterStatus)) || "todo",
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
      priority: onlyValue(filterPriority) || "medium",
      category: onlyValue(filterCategory) || "kerja",
      project: onlyValue(filterProject),
      assignee_id: onlyValue(filterAssignee),
      estimated_hours: 3,
      status: viewMode === "list" ? onlyValue(filterStatus) : undefined,
    });
    setQuickTitle("");
    bump();
  };

  const handleSave = async (form) => {
    if (form.id) await api.updateTask(form.id, form);
    else await api.createTask(form);
    setFormTask(null);
    bump();
  };

  const handleDelete = async (id) => {
    await api.deleteTask(id);
    setFormTask(null);
    bump();
  };

  const changeView = (mode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, mode);
    } catch {
      // Private browsing / storage disabled — the toggle still works for
      // this session, it just won't be remembered next time.
    }
  };

  const moveTask = async (task, newStatus) => {
    await api.updateTask(task.id, { status: newStatus });
    bump();
  };

  // Inline edits from the list view (status/priority dropdowns).
  const quickUpdate = async (taskId, patch) => {
    await api.updateTask(taskId, patch);
    bump();
  };

  const resetFilters = () => {
    setFilterStatus([]);
    setFilterAssignee([]);
    setFilterPriority([]);
    setFilterCategory([]);
    setFilterProject([]);
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
          <div className="flex items-center gap-2.5">
            <SegmentedControl options={VIEW_OPTIONS} value={viewMode} onChange={changeView} />
            <Button variant="primary" onClick={openNew}>
              <Plus size={16} /> Tugas Baru
            </Button>
          </div>
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

        <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap sm:items-center">
          {viewMode === "list" && (
            <MultiSelect
              options={STATUS_FILTER_OPTIONS}
              selected={filterStatus}
              onChange={setFilterStatus}
              placeholder="Semua status"
              noun="status"
              className="w-full sm:w-44"
            />
          )}
          <MultiSelect
            options={memberOptions}
            selected={filterAssignee}
            onChange={setFilterAssignee}
            placeholder="Semua anggota"
            noun="anggota"
            className="w-full sm:w-44"
          />
          <MultiSelect
            options={PRIORITY_OPTIONS}
            selected={filterPriority}
            onChange={setFilterPriority}
            placeholder="Semua prioritas"
            noun="prioritas"
            className="w-full sm:w-44"
          />
          <MultiSelect
            options={CATEGORY_OPTIONS}
            selected={filterCategory}
            onChange={setFilterCategory}
            placeholder="Semua kategori"
            noun="kategori"
            className="w-full sm:w-44"
          />
          <MultiSelect
            options={projectOptions}
            selected={filterProject}
            onChange={setFilterProject}
            placeholder="Semua project"
            noun="project"
            searchPlaceholder="Cari project"
            allowCustom
            className="w-full sm:w-44"
          />
          <div className="relative col-span-2 sm:col-span-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <Input
              placeholder="Cari judul/deskripsi..."
              value={filterQ}
              onChange={(e) => setFilterQ(e.target.value)}
              className="w-full pl-8 sm:w-48"
            />
          </div>
          <label className="flex flex-col gap-1 text-[12.5px] text-ink-soft sm:flex-row sm:items-center sm:gap-1.5">
            Due setelah
            <Input type="date" value={filterDueAfter} onChange={(e) => setFilterDueAfter(e.target.value)} className="w-full sm:w-auto" />
          </label>
          <label className="flex flex-col gap-1 text-[12.5px] text-ink-soft sm:flex-row sm:items-center sm:gap-1.5">
            Due sebelum
            <Input type="date" value={filterDueBefore} onChange={(e) => setFilterDueBefore(e.target.value)} className="w-full sm:w-auto" />
          </label>
          <Button variant="ghost" onClick={resetFilters} className="col-span-2 sm:col-span-1">
            Reset
          </Button>
        </div>
      </Card>

      {viewMode === "kanban" ? (
        <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 snap-x snap-mandatory md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
          {COLUMNS.map((col) => (
            <div key={col.key} className="w-[85vw] shrink-0 snap-start md:w-auto md:shrink">
              <KanbanColumn
                statusKey={col.key}
                label={col.label}
                filters={filterParams()}
                reloadTick={kanbanReloadKey}
                columns={COLUMNS}
                memberById={memberById}
                onOpen={(t) => setFormTask(t)}
                onMove={moveTask}
                onCopy={openCopy}
              />
            </div>
          ))}
        </div>
      ) : (
        <TaskListView
          tasks={listTasks}
          memberById={memberById}
          loading={listLoading}
          loadingMore={listLoadingMore}
          total={listTotal}
          onLoadMore={loadMoreListTasks}
          onOpen={(t) => setFormTask(t)}
          onCopy={openCopy}
          onQuickUpdate={quickUpdate}
        />
      )}

      {formTask && (
        <TaskModal
          initial={formTask}
          members={members}
          existingProjects={allProjects}
          onClose={() => setFormTask(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
