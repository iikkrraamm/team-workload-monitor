import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import clsx from "clsx";
import { NAV_ITEMS } from "./NavItems";
import MobileMoreSheet from "./MobileMoreSheet";

export default function MobileTabBar({ page, setPage, whatsappEnabled }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const availableItems = NAV_ITEMS.filter((item) => item.id !== "whatsapp" || whatsappEnabled);
  const primaryItems = availableItems.filter((item) => item.primary);
  const overflowItems = availableItems.filter((item) => !item.primary);
  // Keep "Lainnya" visually active when you're on one of the pages it
  // contains — otherwise the tab bar would show nothing selected at all
  // while on, say, the Team or SQL Client page.
  const onOverflowPage = overflowItems.some((item) => item.id === page);

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line/70 bg-surface/85 backdrop-blur-xl md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const active = page === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className="flex flex-1 flex-col items-center gap-1 py-2.5"
            >
              <Icon size={21} strokeWidth={2} className={active ? "text-accent" : "text-ink-faint"} />
              <span className={clsx("text-[10.5px] font-medium", active ? "text-accent" : "text-ink-faint")}>
                {item.shortLabel || item.label}
              </span>
            </button>
          );
        })}

        {overflowItems.length > 0 && (
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-1 flex-col items-center gap-1 py-2.5"
          >
            <MoreHorizontal size={21} strokeWidth={2} className={onOverflowPage ? "text-accent" : "text-ink-faint"} />
            <span className={clsx("text-[10.5px] font-medium", onOverflowPage ? "text-accent" : "text-ink-faint")}>
              Lainnya
            </span>
          </button>
        )}
      </nav>

      {moreOpen && (
        <MobileMoreSheet
          items={overflowItems}
          page={page}
          setPage={setPage}
          onClose={() => setMoreOpen(false)}
        />
      )}
    </>
  );
}
