import { LayoutGrid, KanbanSquare, Activity, Clock3, Users } from "lucide-react";

export const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
  { id: "tasks", label: "Tugas", icon: KanbanSquare },
  { id: "workload", label: "Analisis Beban", shortLabel: "Beban", icon: Activity },
  { id: "activities", label: "Non-Task Activity", shortLabel: "Aktivitas", icon: Clock3 },
  { id: "team", label: "Tim", icon: Users },
];
