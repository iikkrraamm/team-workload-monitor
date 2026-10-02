import clsx from "clsx";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../lib/theme";

// Light / dark switch. "row" is the labelled switch in the sidebar, "icon" the
// compact button in the phone's top bar. Both are the same switch for
// assistive tech: a labelled control whose state is aria-checked.
export default function ThemeToggle({ variant = "row" }) {
  const { isDark, toggleTheme } = useTheme();
  const title = isDark ? "Beralih ke mode terang" : "Beralih ke mode gelap";

  if (variant === "icon") {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label="Mode gelap"
        title={title}
        onClick={toggleTheme}
        className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-ink/[0.06] hover:text-ink"
      >
        {isDark ? <Moon size={18} /> : <Sun size={18} />}
      </button>
    );
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      title={title}
      onClick={toggleTheme}
      className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium text-ink-soft transition-colors hover:bg-ink/[0.04] hover:text-ink"
    >
      <span className="flex items-center gap-3">
        {isDark ? <Moon size={18} strokeWidth={2} /> : <Sun size={18} strokeWidth={2} />}
        Mode gelap
      </span>
      <span
        aria-hidden="true"
        className={clsx(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          isDark ? "bg-accent-solid" : "bg-ink/20"
        )}
      >
        <span
          className={clsx(
            // left-0 is explicit: inside a <button> (text-align: center) an absolutely
            // positioned child with left:auto lands mid-track instead of at the start.
            "absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
            isDark ? "translate-x-[18px]" : "translate-x-0.5"
          )}
        />
      </span>
    </button>
  );
}
