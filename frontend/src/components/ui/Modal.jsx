import { X } from "lucide-react";

export default function Modal({ title, onClose, children, footer, width = 480 }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/60 p-4 backdrop-blur-sm animate-[fadeIn_.15s_ease-out]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full flex-col rounded-2xl bg-surface shadow-popover"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-ink-soft hover:bg-ink/5"
            aria-label="Tutup"
          >
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
