import clsx from "clsx";

export default function SegmentedControl({ options, value, onChange, className }) {
  return (
    <div
      className={clsx(
        "inline-flex items-center gap-0.5 rounded-full bg-ink/[0.05] p-1",
        className
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={clsx(
            "rounded-full px-3.5 h-8 text-[13px] font-medium transition-all",
            value === opt.value
              ? "bg-surface text-ink shadow-sm dark:bg-ink/[0.14] dark:shadow-none"
              : "text-ink-soft hover:text-ink"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
