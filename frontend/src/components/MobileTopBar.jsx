export default function MobileTopBar() {
  return (
    <header className="flex items-center gap-2.5 border-b border-line/70 bg-white/80 px-4 py-3 backdrop-blur-xl md:hidden">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-[11px] font-bold text-white">
        WM
      </div>
      <span className="text-[15px] font-semibold text-ink">Workload Monitor</span>
    </header>
  );
}
