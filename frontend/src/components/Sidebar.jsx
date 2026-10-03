import clsx from "clsx";
import { NAV_ITEMS } from "./NavItems";
import ThemeToggle from "./ThemeToggle";

export default function Sidebar({ page, setPage }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line/70 bg-surface/70 backdrop-blur-xl md:flex">
      <div className="flex items-center gap-3 px-6 pt-6 pb-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-solid text-[13px] font-bold text-white">
          WM
        </div>
        <div className="leading-tight">
          <div className="text-[14px] font-semibold text-ink">Workload Monitor</div>
          <div className="text-[12px] text-ink-faint">Team capacity, simplified</div>
        </div>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = page === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={clsx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors",
                active
                  ? "bg-accent-soft text-accent"
                  : "text-ink-soft hover:bg-ink/[0.04] hover:text-ink"
              )}
            >
              <Icon size={18} strokeWidth={2} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="px-3 pb-1">
        <ThemeToggle variant="row" />
      </div>

      <div className="m-3 rounded-xl bg-ink/[0.04] px-3.5 py-3 text-[12px] leading-relaxed text-ink-soft">
        Tip: gunakan chat AI di kanan bawah untuk tambah / update tugas secara cepat.
      </div>
    </aside>
  );
}
