import { X } from "lucide-react";

export default function MobileMoreSheet({ items, page, setPage, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/30 dark:bg-black/60 backdrop-blur-sm md:hidden"
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-2xl bg-surface pb-[calc(1rem+env(safe-area-inset-bottom,0px))] shadow-popover"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-[15px] font-semibold text-ink">Lainnya</h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-ink-soft hover:bg-ink/5"
            aria-label="Tutup"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-2 py-2">
          {items.map((item) => {
            const Icon = item.icon;
            const active = page === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setPage(item.id);
                  onClose();
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-[14.5px] font-medium ${
                  active ? "bg-accent-soft text-accent" : "text-ink hover:bg-ink/[0.04]"
                }`}
              >
                <Icon size={19} strokeWidth={2} />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
