const STATUS_LABEL = { idle: "Idle", low: "Low", normal: "Normal", padat: "Padat", overload: "Overload" };
export const PRIORITY_LABEL = { urgent: "Urgent", high: "Tinggi", medium: "Sedang", low: "Rendah" };

export function initials(name = "") {
  return name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

export function Avatar({ name, color, size = 40 }) {
  return (
    <div
      className="avatar"
      style={{ background: color, width: size, height: size, fontSize: size * 0.35 }}
    >
      {initials(name)}
    </div>
  );
}

export function StatusPill({ status }) {
  return (
    <span className={`pill status-${status}`}>
      <span className="pill-dot" /> {STATUS_LABEL[status]}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  return <span className={`priority-badge priority-${priority}`}>{PRIORITY_LABEL[priority]}</span>;
}

export function Sidebar({ page, setPage }) {
  const items = [
    { id: "dashboard", label: "Dashboard", icon: "◆" },
    { id: "tasks", label: "Tugas", icon: "▤" },
    { id: "workload", label: "Analisis Beban", icon: "◈" },
    { id: "activities", label: "Non-Task Activity", icon: "✦" },
    { id: "team", label: "Tim", icon: "◎" },
  ];

  return (
    <div className="sidebar">
      <div className="brand">
        <div className="brand-mark">WM</div>
        <div className="brand-text">
          Workload Monitor
          <span>Team capacity, simplified</span>
        </div>
      </div>
      {items.map((item) => (
        <button
          key={item.id}
          className={`nav-item ${page === item.id ? "active" : ""}`}
          onClick={() => setPage(item.id)}
        >
          <span className="nav-icon">{item.icon}</span> {item.label}
        </button>
      ))}
      <div className="sidebar-footer">
        Tip: gunakan chat AI di kanan bawah untuk tambah / update tugas secara cepat.
      </div>
    </div>
  );
}