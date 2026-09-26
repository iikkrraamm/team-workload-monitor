import React, { useEffect, useState, useCallback } from "react";
import { api } from "./api";
import { Avatar, initials, PriorityBadge, PRIORITY_LABEL, Sidebar, StatusPill } from "./components/shared";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";

/* ============================== DASHBOARD ============================== */

function Dashboard() {
  const [data, setData] = useState(null);
  const [risky, setRisky] = useState([]);

  const load = useCallback(() => {
    api.getDashboard().then(setData).catch(console.error);
    api.getRiskyTasks().then(setRisky).catch(() => setRisky([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!data) return <div className="empty-state">Memuat dashboard...</div>;

  const statusMeta = [
    { key: "idle", label: "Idle" },
    { key: "low", label: "Low" },
    { key: "normal", label: "Normal" },
    { key: "padat", label: "Padat" },
    { key: "overload", label: "Overload" },
  ];
  const memberNames = Object.fromEntries(
    data.member_cards.map(({ member }) => [member.id, member.name])
  );

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Dashboard Tim</h1>
          <p>Ringkasan beban kerja hari ini, {data.reference_date}</p>
        </div>
      </div>

      <div className="grid grid-5" style={{ marginBottom: 20 }}>
        {statusMeta.map((s) => (
          <div className="card summary-card" key={s.key}>
            <span className={`pill status-${s.key}`} style={{ alignSelf: "flex-start" }}>
              <span className="pill-dot" /> {s.label}
            </span>
            <div className="summary-value">{data.status_counts[s.key] ?? 0}</div>
            <div className="summary-label">orang berstatus {s.label.toLowerCase()}</div>
          </div>
        ))}
      </div>

      {data.burnout_alerts.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="section-title">⚠ Peringatan Risiko Burnout</div>
          {data.burnout_alerts.map((a) => (
            <div key={a.member_id} className={`alert-banner alert-${a.risk}`}>
              <div className="alert-icon">{a.risk === "high" ? "🔴" : "🟠"}</div>
                <div className="alert-text">
                <strong>{a.member_name}</strong> - {a.message}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-2">
        <div className="card">
          <div className="section-title">Beban Kerja Hari Ini</div>
          {data.member_cards.map((mc) => (
            <div className="member-row" key={mc.member.id}>
              <Avatar name={mc.member.name} color={mc.member.color} />
              <div className="member-info">
                <div className="member-name">{mc.member.name}</div>
                <div className="member-role">{mc.member.role}</div>
                <div className="member-current-tasks">
                  <strong>Sedang dikerjakan:</strong> {mc.in_progress_tasks.length
                    ? mc.in_progress_tasks.join(", ")
                    : "Tidak ada task aktif hari ini"}
                </div>
                <div className="progress-track">
                  <div
                    className={`progress-fill fill-${mc.today_status}`}
                    style={{ width: `${Math.min(mc.today_percent ?? 0, 100)}%` }}
                  />
                </div>
              </div>
              <div className="member-metric">
                <div className="pct">{mc.today_percent == null ? "—" : `${mc.today_percent}%`}</div>
                <StatusPill status={mc.today_status} />
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="section-title">Status Tugas</div>
          <div className="grid grid-3" style={{ gap: 12 }}>
            <div className="card card-sm summary-card">
              <div className="summary-value">{data.task_status_counts.todo || 0}</div>
              <div className="summary-label">Belum dikerjakan</div>
            </div>
            <div className="card card-sm summary-card">
              <div className="summary-value">{data.task_status_counts.in_progress || 0}</div>
              <div className="summary-label">Dikerjakan</div>
            </div>
            <div className="card card-sm summary-card">
              <div className="summary-value">{data.task_status_counts.done || 0}</div>
              <div className="summary-label">Selesai</div>
            </div>
          </div>
          <div style={{ marginTop: 16, fontSize: 13, color: "var(--text-mid)" }}>
            Total {data.total_tasks} tugas aktif di seluruh tim. Cek halaman "Analisis Beban" untuk
            rekomendasi reschedule / reassign otomatis saat ada anggota yang overload.
          </div>
        </div>
      </div>

      {risky.length > 0 && (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="section-title">Tugas Berisiko (Tidak Cukup Jam)</div>
          {risky.map((t) => (
            <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
              <div>
                <div style={{ fontWeight: 700 }}>{t.title}</div>
                <div style={{ fontSize: 13, color: "var(--text-mid)" }}>{memberNames[t.assignee_id] || "Unassigned"} · Due {t.due_date}</div>
              </div>
              <div>
                <button className="btn btn-ghost" onClick={() => { /* no-op for now */ }}>Lihat</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================== ACTIVITIES ============================== */

function Activities({ members }) {
  const [activities, setActivities] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [memberId, setMemberId] = useState(members[0]?.id || "");
  const [title, setTitle] = useState("");
  const [hours, setHours] = useState(1);

  const load = useCallback(() => {
    api.getActivities({ date, member_id: memberId }).then(setActivities).catch(console.error);
  }, [date, memberId]);

  useEffect(() => { load(); }, [load, members]);

  const add = async () => {
    if (!memberId) return alert('Pilih anggota terlebih dahulu');
    await api.createActivity({ member_id: memberId, title: title || 'Meeting', hours, date });
    setTitle(''); setHours(1); load();
  };

  const remove = async (id) => { await api.deleteActivity(id); load(); };

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Non-Task Activity</h1>
          <p>Catat meeting, support, email, dan aktivitas non-task lainnya.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            <option value="">Pilih anggota</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <input placeholder="Judul (mis. Meeting)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input type="number" min="0.25" step="0.25" value={hours} onChange={(e) => setHours(parseFloat(e.target.value))} style={{ width: 90 }} />
          <button className="btn btn-primary" onClick={add}>Tambah</button>
        </div>
      </div>

      <div className="card">
        <div className="section-title">Aktivitas pada {date}</div>
        {activities.length === 0 && <div className="empty-state">Belum ada aktivitas</div>}
        {activities.map(a => (
          <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 8, borderBottom: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontWeight: 700 }}>{a.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-mid)' }}>{a.hours} jam · {members.find(m => m.id === a.member_id)?.name || 'Unknown'}</div>
            </div>
            <div>
              <button className="btn btn-ghost" onClick={() => remove(a.id)}>Hapus</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================== TASKS (Kanban) ============================== */

const COLUMNS = [
  { key: "todo", label: "Belum Dikerjakan" },
  { key: "in_progress", label: "Dikerjakan" },
  { key: "done", label: "Selesai" },
];

function TaskModal({ task, members, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(
    task || {
      title: "", description: "", assignee_id: members[0]?.id || "",
      priority: "medium", estimated_hours: 4, status: "todo",
      start_date: new Date().toISOString().slice(0, 10),
      due_date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
    }
  );

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{task ? "Edit Tugas" : "Tugas Baru"}</h2>
        <div className="form-row">
          <label>Judul</label>
          <input value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="Judul tugas" />
        </div>
        <div className="form-row">
          <label>Deskripsi</label>
          <textarea rows={2} value={form.description} onChange={(e) => update("description", e.target.value)} />
        </div>
        <div className="form-grid form-row">
          <div>
            <label>Penanggung Jawab</label>
            <select value={form.assignee_id || ""} onChange={(e) => update("assignee_id", e.target.value)}>
              <option value="">Belum ditentukan</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label>Prioritas</label>
            <select value={form.priority} onChange={(e) => update("priority", e.target.value)}>
              <option value="low">Rendah</option>
              <option value="medium">Sedang</option>
              <option value="high">Tinggi</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>
        <div className="form-grid form-row">
          <div>
            <label>Estimasi Jam</label>
            <input type="number" min="0.5" step="0.5" value={form.estimated_hours}
              onChange={(e) => update("estimated_hours", parseFloat(e.target.value))} />
          </div>
          <div>
            <label>Status</label>
            <select value={form.status} onChange={(e) => update("status", e.target.value)}>
              <option value="todo">Belum Dikerjakan</option>
              <option value="in_progress">Dikerjakan</option>
              <option value="done">Selesai</option>
            </select>
          </div>
        </div>
        <div className="form-grid form-row">
          <div>
            <label>Mulai</label>
            <input type="date" value={form.start_date} onChange={(e) => update("start_date", e.target.value)} />
          </div>
          <div>
            <label>Deadline</label>
            <input type="date" value={form.due_date} onChange={(e) => update("due_date", e.target.value)} />
          </div>
        </div>
        <div className="modal-actions">
          {task && (
            <button className="btn btn-ghost btn-danger-ghost" onClick={() => onDelete(task.id)}>Hapus</button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" onClick={() => onSave(form)}>Simpan</button>
        </div>
      </div>
    </div>
  );
}

function Tasks({ members, refreshSignal }) {
  const [tasks, setTasks] = useState([]);
  const [filterAssignee, setFilterAssignee] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterQ, setFilterQ] = useState("");
  const [filterDueBefore, setFilterDueBefore] = useState("");
  const [filterDueAfter, setFilterDueAfter] = useState("");
  const [editing, setEditing] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");

  const load = useCallback(() => {
    const f = {};
    if (filterAssignee) f.assignee_id = filterAssignee;
    if (filterPriority) f.priority = filterPriority;
    if (filterQ) f.q = filterQ;
    if (filterDueBefore) f.due_before = filterDueBefore;
    if (filterDueAfter) f.due_after = filterDueAfter;
    api.getTasks(f).then(setTasks).catch(console.error);
  }, [filterAssignee, filterPriority, filterQ, filterDueBefore, filterDueAfter]);

  useEffect(() => { load(); }, [load, refreshSignal]);

  const memberById = Object.fromEntries(members.map((m) => [m.id, m]));

  const quickAdd = async () => {
    if (!quickTitle.trim()) return;
    await api.createTask({ title: quickTitle.trim(), priority: "medium", estimated_hours: 3 });
    setQuickTitle("");
    load();
  };

  const handleSave = async (form) => {
    if (form.id) await api.updateTask(form.id, form);
    else await api.createTask(form);
    setEditing(null);
    setShowNew(false);
    load();
  };

  const handleDelete = async (id) => {
    await api.deleteTask(id);
    setEditing(null);
    load();
  };

  const moveTask = async (task, newStatus) => {
    await api.updateTask(task.id, { status: newStatus });
    load();
  };

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Tugas Tim</h1>
          <p>Kelola tugas dengan cepat - geser status, atau pakai chat AI untuk input super cepat.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ Tugas Baru</button>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="quick-add">
          <input
            placeholder="Tambah cepat: ketik judul tugas lalu Enter..."
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && quickAdd()}
          />
          <button className="btn btn-primary" onClick={quickAdd}>Tambah</button>
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
          <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)}>
            <option value="">Semua anggota</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
            <option value="">Semua prioritas</option>
            <option value="urgent">Urgent</option>
            <option value="high">Tinggi</option>
            <option value="medium">Sedang</option>
            <option value="low">Rendah</option>
          </select>
          <input placeholder="Cari judul/deskripsi..." value={filterQ} onChange={(e) => setFilterQ(e.target.value)} />
          <label style={{ fontSize: 12, color: "var(--text-mid)" }}>Due setelah</label>
          <input type="date" value={filterDueAfter} onChange={(e) => setFilterDueAfter(e.target.value)} />
          <label style={{ fontSize: 12, color: "var(--text-mid)" }}>Due sebelum</label>
          <input type="date" value={filterDueBefore} onChange={(e) => setFilterDueBefore(e.target.value)} />
          <button className="btn btn-ghost" onClick={load}>Filter</button>
          <button className="btn btn-ghost" onClick={() => { setFilterAssignee(""); setFilterPriority(""); setFilterQ(""); setFilterDueBefore(""); setFilterDueAfter(""); }}>Reset</button>
        </div>
      </div>

      <div className="board">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.key);
          return (
            <div key={col.key}>
              <div className="board-col-header">
                {col.label} <span className="count-chip">{colTasks.length}</span>
              </div>
              {colTasks.map((t) => {
                const assignee = memberById[t.assignee_id];
                return (
                  <div className="task-card new" key={t.id} onClick={() => setEditing(t)}>
                    <div className="task-head">
                      <div className="task-left">
                        <PriorityBadge priority={t.priority} />
                        <div className="task-title">{t.title}</div>
                      </div>
                      <div className="task-right">
                        <div className="due">Due {t.due_date}</div>
                        {assignee ? (
                          <div className="assignee">{initials(assignee.name)} {assignee.name.split(" ")[0]}</div>
                        ) : (
                          <div className="assignee unassigned">Unassigned</div>
                        )}
                      </div>
                    </div>

                    <div className="task-body">
                      {t.deadline ? (
                        <div className="deadline-row">
                          <div className="deadline-window">{t.deadline.window_start} → {t.deadline.due_date}</div>
                          <div className={`avail ${t.deadline.available_hours < 0 ? 'short' : 'ok'}`}>
                            {t.deadline.available_hours < 0 ? (
                              <strong>Kekurangan {Math.abs(t.deadline.available_hours)}h</strong>
                            ) : (
                              <span>{t.deadline.available_hours}h tersedia</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="deadline-row">
                          <div className="deadline-window">Tidak ada deadline</div>
                        </div>
                      )}

                      <div className="task-extras">
                        <div className="est">Estimasi: <strong>{t.estimated_hours}h</strong></div>
                        <div className="workdays">Sisa hari kerja: {t.deadline?.work_days_remaining ?? '-'}</div>
                        <div className="risk">Risk: {t.deadline ? (t.deadline.risk === 'cukup' ? 'Cukup' : t.deadline.risk === 'ketat' ? 'Ketat' : 'Tidak cukup') : '-'}</div>
                      </div>

                      {t.deadline?.counted_as_history && (
                        <div className="history-note">Dihitung sebagai histori (tugas sudah selesai)</div>
                      )}
                    </div>

                    <div className="task-actions">
                      {COLUMNS.filter((c) => c.key !== col.key).map((c) => (
                        <button
                          key={c.key}
                          className="btn btn-ghost small"
                          onClick={(e) => { e.stopPropagation(); moveTask(t, c.key); }}
                        >
                          → {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              {colTasks.length === 0 && <div className="empty-state">Tidak ada tugas</div>}
            </div>
          );
        })}
      </div>

      {(editing || showNew) && (
        <TaskModal
          task={editing}
          members={members}
          onClose={() => { setEditing(null); setShowNew(false); }}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

/* ============================== TEAM ============================== */

function MemberModal({ member, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(member || { name: "", role: "", capacity_hours_per_day: 8, color: "#7C6FF0" });
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{member ? "Edit Anggota" : "Anggota Baru"}</h2>
        <div className="form-row">
          <label>Nama</label>
          <input value={form.name} onChange={(e) => update("name", e.target.value)} />
        </div>
        <div className="form-row">
          <label>Peran</label>
          <input value={form.role} onChange={(e) => update("role", e.target.value)} placeholder="mis. Backend Developer" />
        </div>
        <div className="form-grid form-row">
          <div>
            <label>Kapasitas Jam/Hari</label>
            <input type="number" min="1" max="16" value={form.capacity_hours_per_day}
              onChange={(e) => update("capacity_hours_per_day", parseFloat(e.target.value))} />
          </div>
          <div>
            <label>Warna</label>
            <input type="color" value={form.color} onChange={(e) => update("color", e.target.value)} style={{ padding: 4, height: 42 }} />
          </div>
        </div>
        <div className="modal-actions">
          {member && <button className="btn btn-ghost btn-danger-ghost" onClick={() => onDelete(member.id)}>Hapus</button>}
          <button className="btn btn-ghost" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" onClick={() => onSave(form)}>Simpan</button>
        </div>
      </div>
    </div>
  );
}

function Team({ members, reload }) {
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
      <div className="topbar">
        <div>
          <h1>Anggota Tim</h1>
          <p>Atur kapasitas jam kerja harian tiap anggota untuk perhitungan beban yang akurat.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ Tambah Anggota</button>
      </div>
      <div className="grid grid-3">
        {members.map((m) => (
          <div className="card" key={m.id} style={{ cursor: "pointer" }} onClick={() => setEditing(m)}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar name={m.name} color={m.color} size={48} />
              <div>
                <div className="member-name">{m.name}</div>
                <div className="member-role">{m.role}</div>
              </div>
            </div>
            <div style={{ marginTop: 14, fontSize: 12.5, color: "var(--text-mid)" }}>
              Kapasitas: <strong>{m.capacity_hours_per_day} jam/hari</strong>
            </div>
          </div>
        ))}
      </div>
      {(editing || showNew) && (
        <MemberModal
          member={editing}
          onClose={() => { setEditing(null); setShowNew(false); }}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

/* ============================== WORKLOAD ANALYSIS ============================== */

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftWorkloadDate(value, amount, period) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  if (period === "month") {
    date.setDate(1);
    date.setMonth(date.getMonth() + amount);
    date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
  } else {
    date.setDate(date.getDate() + amount * (period === "week" ? 7 : 1));
  }
  return formatDateInput(date);
}

function Workload({ members }) {
  const [period, setPeriod] = useState("week");
  const [referenceDate, setReferenceDate] = useState(() => formatDateInput(new Date()));
  const [data, setData] = useState(null);
  const [burnout, setBurnout] = useState([]);
  const [detailMember, setDetailMember] = useState(null);
  const [detailData, setDetailData] = useState(null);

  const load = useCallback(() => {
    api.getWorkload(period, referenceDate).then(setData).catch(console.error);
    api.getBurnout().then(setBurnout).catch(console.error);
  }, [period, referenceDate]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!detailMember) return undefined;
    let cancelled = false;
    setDetailData(null);
    api.getWorkloadDetails(detailMember.id, period, referenceDate)
      .then((details) => {
        if (!cancelled) setDetailData(details);
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setDetailData(null);
      });
    return () => { cancelled = true; };
  }, [detailMember, period, referenceDate]);

  const showDetails = (member) => setDetailMember(member);

  const closeDetails = () => { setDetailMember(null); setDetailData(null); };

  const applySuggestion = async (memberEntry, s) => {
    if (s.action === "reassign") {
      await api.updateTask(s.task_id, { assignee_id: s.suggested_assignee_id });
    } else {
      await api.updateTask(s.task_id, { due_date: s.suggested_new_due_date });
    }
    load();
  };

  const chartData = data?.members.map((m) => ({
    name: m.member.name.split(" ")[0],
    percent: m.percent,
    status: m.status,
  })) || [];

  const colorFor = (status) => ({
    idle: "#94a3b8", normal: "#2fb88f", padat: "#f5a25d", overload: "#ef6f6f",
  }[status]);

  return (
    <div>
      <div className="topbar">
        <div>
          <h1>Analisis Beban Kerja</h1>
          <p>Pantau beban harian, mingguan, dan bulanan - lengkap dengan saran otomatis saat overload.</p>
        </div>
      </div>

      <div className="tabs">
        {["day", "week", "month"].map((p) => (
          <button key={p} className={`tab-btn ${period === p ? "active" : ""}`} onClick={() => setPeriod(p)}>
            {p === "day" ? "Harian" : p === "week" ? "Mingguan" : "Bulanan"}
          </button>
        ))}
      </div>

      <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-ghost" onClick={() => setReferenceDate((value) => shiftWorkloadDate(value, -1, period))}>
            Sebelumnya
          </button>
          <input
            aria-label="Tanggal referensi analisis beban"
            type="date"
            value={referenceDate}
            onChange={(event) => setReferenceDate(event.target.value)}
            style={{ width: "auto" }}
          />
          <button className="btn btn-ghost" onClick={() => setReferenceDate((value) => shiftWorkloadDate(value, 1, period))}>
            Berikutnya
          </button>
        </div>
        <div style={{ fontSize: 13, color: "var(--text-mid)" }}>
          Rentang analisis: {data?.members?.[0]?.range ? `${data.members[0].range.start} - ${data.members[0].range.end}` : referenceDate}
        </div>
      </div>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div className="card">
          <div className="section-title">Persentase Beban per Orang</div>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(38,43,61,0.06)" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip formatter={(v) => `${v}%`} />
                <Bar dataKey="percent" radius={[8, 8, 0, 0]}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={colorFor(d.status)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="section-title">Risiko Burnout</div>
          {burnout.map((b) => (
            <div key={b.member_id} className="member-row">
              <div className="member-info">
                <div className="member-name">{b.member_name}</div>
                <div className="member-role">
                  {b.overload_days} dari {b.lookback_days} hari overload · streak {b.current_streak} hari
                </div>
              </div>
              <span className={`pill status-${b.risk === "high" ? "overload" : b.risk === "medium" ? "padat" : "normal"}`}>
                <span className="pill-dot" /> {b.risk === "high" ? "Tinggi" : b.risk === "medium" ? "Sedang" : "Rendah"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        {data?.members.map((m) => {
          return (
            <div className="card" key={m.member.id} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <Avatar name={m.member.name} color={m.member.color} />
                <div style={{ flex: 1 }}>
                  <div className="member-name">{m.member.name}</div>
                  <div className="progress-track">
                    <div className={`progress-fill fill-${m.status}`} style={{ width: `${Math.min(m.percent ?? 0, 100)}%` }} />
                  </div>
                </div>
                <div className="member-metric">
                  <div className="pct">{m.percent == null ? "—" : `${m.percent}%`}</div>
                  <StatusPill status={m.status} />
                </div>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-soft)", marginTop: 8 }}>
                {m.total_hours} jam terpakai dari {m.capacity_hours} jam kapasitas ({m.range.start} - {m.range.end})
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                <button className="btn btn-ghost" onClick={() => showDetails(m.member)}>Lihat rincian kontribusi</button>
                {m.suggestions?.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--overload)" }}>
                      Saran untuk mengurangi beban:
                    </div>
                    {m.suggestions.map((s) => (
                      <div className="suggestion-item" key={s.task_id}>
                        <div>
                          <strong>{s.task_title}</strong> ({PRIORITY_LABEL[s.priority]}) - {s.action === 'reassign' ? 'alihkan ke ' + s.suggested_assignee_name : 'jadwalkan ulang ke ' + s.suggested_new_due_date}
                          <div style={{ color: "var(--text-soft)" }}>{s.reason}</div>
                        </div>
                        <button className="btn btn-primary" onClick={() => applySuggestion(m, s)}>Terapkan</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {detailMember && (
        <div className="modal-backdrop" onClick={closeDetails}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: '720px' }}>
            <h2>Rincian kontribusi: {detailMember.name}</h2>
            <div style={{ maxHeight: 420, overflow: 'auto' }}>
              {detailData ? (
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-mid)', marginBottom: 8 }}>
                    Periode: {detailData.range.start} - {detailData.range.end}
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <strong>Activities</strong>
                    {detailData.activities.length === 0 && <div className="empty-state">Tidak ada aktivitas</div>}
                    {detailData.activities.map(a => (
                      <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 6, borderBottom: '1px solid var(--border)' }}>
                        <div>{a.date} - {a.title}</div>
                        <div>{a.hours}h</div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <strong>Tasks</strong>
                    {detailData.tasks.length === 0 && <div className="empty-state">Tidak ada tugas</div>}
                    {detailData.tasks.map(t => (
                      <div key={t.id} style={{ padding: 6, borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <div style={{ fontWeight: 700 }}>{t.title}</div>
                          <div>{t.total_in_window}h</div>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-mid)' }}>{t.start_date} → {t.due_date}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="empty-state">Memuat...</div>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={closeDetails}>Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================== AI CHAT WIDGET ============================== */

function ChatWidget({ onDataChanged }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "bot", text: "Halo! Aku bisa bantu tambah tugas, update status, hapus tugas, atau cek workload - cukup ketik dengan bahasa sehari-hari." },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const suggestions = [
    "tambah task 'Review kode' untuk Budi prioritas tinggi 3 jam due besok",
    "workload Sari minggu ini",
    "tandai selesai Review kode",
  ];

  const send = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    setMessages((m) => [...m, { role: "user", text: msg }]);
    setInput("");
    setSending(true);
    try {
      const res = await api.sendChat(msg);
      setMessages((m) => [...m, { role: "bot", text: res.reply }]);
      if (res.action && res.action !== "none") onDataChanged();
    } catch (e) {
      setMessages((m) => [...m, { role: "bot", text: "Maaf, terjadi kesalahan. Coba lagi." }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {open && (
        <div className="chat-panel">
          <div className="chat-header">🤖 Asisten Workload</div>
          <div className="chat-body">
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`}>{m.text}</div>
            ))}
            {sending && <div className="chat-msg bot">Mengetik...</div>}
          </div>
          <div className="chat-suggestions">
            {suggestions.map((s) => (
              <span key={s} className="chat-chip" onClick={() => send(s)}>{s}</span>
            ))}
          </div>
          <div className="chat-input-row">
            <input
              placeholder="Ketik perintah..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
            />
            <button className="btn btn-primary" onClick={() => send()}>Kirim</button>
          </div>
        </div>
      )}
        
      <button className="chat-fab" onClick={() => setOpen((o) => !o)}>{open ? "×" : "💬"}</button>
    </>
  );
}

/* ============================== APP ROOT ============================== */

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [members, setMembers] = useState([]);
  const [refreshSignal, setRefreshSignal] = useState(0);

  const loadMembers = useCallback(() => {
    api.getMembers().then(setMembers).catch(console.error);
  }, []);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  const bump = () => setRefreshSignal((n) => n + 1);

  return (
    <div className="app-shell">
      <Sidebar page={page} setPage={setPage} />
      <div className="main-area">
        {page === "dashboard" && <Dashboard key={refreshSignal} />}
        {page === "tasks" && <Tasks members={members} refreshSignal={refreshSignal} />}
        {page === "workload" && <Workload members={members} key={refreshSignal} />}
        {page === "team" && <Team members={members} reload={loadMembers} />}
        {page === "activities" && <Activities members={members} />}
      </div>
      <ChatWidget onDataChanged={() => { bump(); loadMembers(); }} />
    </div>
  );
}
