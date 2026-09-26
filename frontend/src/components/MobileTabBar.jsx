import clsx from "clsx";
import { NAV_ITEMS } from "./NavItems";

export default function MobileTabBar({ page, setPage }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line/70 bg-white/85 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = page === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            className="flex flex-1 flex-col items-center gap-1 py-2.5"
          >
            <Icon
              size={21}
              strokeWidth={2}
              className={active ? "text-accent" : "text-ink-faint"}
            />
            <span
              className={clsx(
                "text-[10.5px] font-medium",
                active ? "text-accent" : "text-ink-faint"
              )}
            >
              {item.shortLabel || item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
