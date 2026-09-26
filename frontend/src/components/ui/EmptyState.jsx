export default function EmptyState({ children }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-[13px] text-ink-faint">
      {children}
    </div>
  );
}
