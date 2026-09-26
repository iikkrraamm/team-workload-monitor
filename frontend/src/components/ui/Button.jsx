import clsx from "clsx";

const VARIANTS = {
  primary:
    "bg-accent text-white hover:bg-accent-hover active:bg-accent shadow-sm shadow-accent/20",
  ghost:
    "bg-transparent text-ink hover:bg-ink/5 active:bg-ink/10",
  subtle:
    "bg-ink/[0.04] text-ink hover:bg-ink/[0.07]",
  danger:
    "bg-transparent text-status-overload hover:bg-status-overload/10",
};

const SIZES = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-10 px-4 text-[14px] gap-2",
};

export default function Button({
  variant = "ghost",
  size = "md",
  className,
  children,
  ...props
}) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center rounded-full font-medium transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
