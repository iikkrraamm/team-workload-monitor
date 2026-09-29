import { forwardRef } from "react";
import clsx from "clsx";

export const inputClass =
  "rounded-lg border border-line bg-white px-3 h-10 text-[14px] text-ink placeholder:text-ink-faint outline-none transition-shadow focus:border-accent focus:ring-2 focus:ring-accent/20";

// Tailwind resolves conflicting utilities by CSS order, not class order, and
// `w-full` is emitted after `w-20`, `w-48`, `w-auto`... so a hard-coded
// `w-full` in the base style would silently beat any width passed in via
// className. Only default to full width when the caller hasn't chosen one.
const hasWidthClass = (className) => /(^|\s)([a-z0-9]+:)*w-/.test(className || "");
const widthDefault = (className) => (hasWidthClass(className) ? undefined : "w-full");

export function Field({ label, className, children }) {
  return (
    <label className={clsx("flex flex-col gap-1.5", className)}>
      {label && <span className="text-[12.5px] font-medium text-ink-soft">{label}</span>}
      {children}
    </label>
  );
}

export function Input({ className, ...props }) {
  return <input className={clsx(inputClass, widthDefault(className), className)} {...props} />;
}

export function Select({ className, children, ...props }) {
  return (
    <select className={clsx(inputClass, widthDefault(className), "pr-8 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2210%22 height=%226%22 viewBox=%220 0 10 6%22><path d=%22M1 1l4 4 4-4%22 stroke=%22%236E6E73%22 stroke-width=%221.4%22 fill=%22none%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22/></svg>')] bg-[right_0.75rem_center] bg-no-repeat", className)} {...props}>
      {children}
    </select>
  );
}

export const Textarea = forwardRef(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={clsx(
        widthDefault(className),
        "rounded-lg border border-line bg-white px-3 py-2 text-[14px] text-ink placeholder:text-ink-faint outline-none transition-shadow focus:border-accent focus:ring-2 focus:ring-accent/20",
        className
      )}
      {...props}
    />
  );
});
