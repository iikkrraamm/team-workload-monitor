import { LayoutGrid, KanbanSquare, Activity, Clock3, Users, Database, MessageCircle, SlidersHorizontal } from "lucide-react";

// `primary: true` = gets its own icon in the mobile bottom tab bar.
// Mobile bottom bars max out at ~5 slots before labels start colliding
// (iOS/Material guidance agrees on this), so we show the 4 most-used
// pages directly and a 5th "Lainnya" tab that opens a sheet with
// everything else. The desktop sidebar ignores this flag and always
// lists every item — there's no space constraint there.
//
// Adding a new menu item: leave `primary` unset (-> goes in "Lainnya")
// unless it's something people will tap many times a day; promoting an
// item to primary should mean demoting an existing one, to keep the
// mobile tab bar at 4 + More.
export const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutGrid, primary: true },
  { id: "tasks", label: "Tugas", icon: KanbanSquare, primary: true },
  { id: "workload", label: "Analisis Beban", shortLabel: "Beban", icon: Activity, primary: true },
  { id: "activities", label: "Non-Task Activity", shortLabel: "Aktivitas", icon: Clock3, primary: true },
  { id: "team", label: "Tim", icon: Users },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { id: "sql", label: "SQL Client", shortLabel: "SQL", icon: Database },
  { id: "settings", label: "Pengaturan", icon: SlidersHorizontal },
];
