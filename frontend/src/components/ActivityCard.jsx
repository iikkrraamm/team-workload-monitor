import { Copy } from "lucide-react";
import Avatar from "./ui/Avatar";

export default function ActivityCard({ activity, member, onOpen, onCopy }) {
  return (
    <div
      onClick={onOpen}
      className="cursor-pointer rounded-xl border border-line/70 bg-surface p-3.5 transition-shadow hover:shadow-soft"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="break-words text-[14px] font-medium leading-snug text-ink">
            {activity.title}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[12px] text-ink-soft">
            <Avatar name={member?.name || "?"} color={member?.color} size={22} />
            <span className="truncate">{member?.name || "Unknown"}</span>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-[12px] font-semibold text-accent">
          {activity.hours} jam
        </span>
      </div>

      <div className="mt-3 flex justify-end border-t border-line pt-2.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCopy(activity);
          }}
          className="flex items-center gap-1 rounded-full bg-ink/[0.04] px-2.5 py-1 text-[11.5px] font-medium text-ink-soft hover:bg-ink/[0.08]"
          title="Salin aktivitas ini"
        >
          <Copy size={12} /> Salin
        </button>
      </div>
    </div>
  );
}
