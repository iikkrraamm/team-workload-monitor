import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import clsx from "clsx";

/**
 * Multi-select dropdown.
 *
 * options:     [{ value, label }]
 * selected:    string[] of selected values
 * allowCustom: lets the user type a value that isn't in `options` and add it
 * noun:        used for the summary when several are picked ("3 anggota")
 */
export default function MultiSelect({
  options,
  selected,
  onChange,
  placeholder,
  noun = "dipilih",
  searchPlaceholder = "Cari...",
  allowCustom = false,
  className,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  // Selected values that aren't in `options` (custom ones) still need to show.
  const allOptions = useMemo(() => {
    const known = new Set(options.map((o) => o.value));
    const extra = selected.filter((v) => !known.has(v)).map((v) => ({ value: v, label: v }));
    return [...options, ...extra];
  }, [options, selected]);

  const labelOf = (value) => allOptions.find((o) => o.value === value)?.label ?? value;

  const term = search.trim().toLowerCase();
  const visible = term
    ? allOptions.filter((o) => o.label.toLowerCase().includes(term))
    : allOptions;
  const canAddCustom =
    allowCustom && term && !allOptions.some((o) => o.label.toLowerCase() === term);

  const toggle = (value) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  const addCustom = () => {
    const value = search.trim();
    if (!value) return;
    if (!selected.includes(value)) onChange([...selected, value]);
    setSearch("");
  };

  const summary =
    selected.length === 0
      ? placeholder
      : selected.length === 1
      ? labelOf(selected[0])
      : `${selected.length} ${noun}`;

  return (
    <div ref={rootRef} className={clsx("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          "flex h-10 w-full items-center justify-between gap-2 rounded-lg border bg-surface px-3 text-[14px] outline-none transition-shadow",
          open ? "border-accent ring-2 ring-accent/20" : "border-line",
          selected.length === 0 ? "text-ink-faint" : "text-ink"
        )}
      >
        <span className="truncate">{summary}</span>
        <span className="flex shrink-0 items-center gap-1">
          {selected.length > 0 && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Hapus pilihan"
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.stopPropagation();
                  onChange([]);
                }
              }}
              className="flex h-5 w-5 items-center justify-center rounded-full text-ink-faint hover:bg-ink/10 hover:text-ink"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown size={14} className="text-ink-soft" />
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-[max(100%,240px)] max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-surface p-1.5 shadow-popover">
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                // One match: pick it. No match: add what was typed as a new
                // value. Several matches is ambiguous, so do nothing.
                if (visible.length === 1) toggle(visible[0].value);
                else if (visible.length === 0 && canAddCustom) addCustom();
              }
            }}
            placeholder={allowCustom ? `${searchPlaceholder} atau ketik baru` : searchPlaceholder}
            className="mb-1 h-9 w-full rounded-lg border border-line px-3 text-[13.5px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <div className="max-h-60 overflow-y-auto">
            {visible.map((o) => {
              const checked = selected.includes(o.value);
              return (
                <button
                  type="button"
                  key={o.value}
                  onClick={() => toggle(o.value)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] text-ink hover:bg-ink/[0.04]"
                >
                  <span
                    className={clsx(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      checked ? "border-accent bg-accent-solid text-white" : "border-ink-faint"
                    )}
                  >
                    {checked && <Check size={11} strokeWidth={3} />}
                  </span>
                  <span className="truncate">{o.label}</span>
                </button>
              );
            })}
            {canAddCustom && (
              <button
                type="button"
                onClick={addCustom}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13.5px] text-accent hover:bg-accent-soft"
              >
                Tambah "{search.trim()}"
              </button>
            )}
            {visible.length === 0 && !canAddCustom && (
              <div className="px-2.5 py-3 text-center text-[12.5px] text-ink-faint">
                Tidak ada pilihan
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
