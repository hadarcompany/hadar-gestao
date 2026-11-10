import { addDaysToKey, getMondayOfWeek, getTodayKey, toDateKey } from "./dates";

export const WORK_PERIODS = [
  { key: "OVERDUE", label: "Atrasadas" },
  { key: "TODAY", label: "Hoje" },
  { key: "THIS_WEEK", label: "Esta semana" },
  { key: "NEXT_WEEK", label: "Semana que vem" },
  { key: "LATER", label: "Mais tarde" },
  { key: "NO_DATE", label: "Sem prazo" },
] as const;
export type WorkPeriod = (typeof WORK_PERIODS)[number]["key"];

/** Calendar deadlines use the same UTC date keys as the rest of the app.
 * Weeks run Monday–Sunday; today belongs only to Hoje, never to two groups. */
export function getWorkPeriod(task: { status: string; dueDate: string | Date | null }, today = getTodayKey()): WorkPeriod | null {
  if (task.status === "COMPLETED" || task.status === "CANCELLED") return null;
  const due = toDateKey(task.dueDate);
  if (!due) return "NO_DATE";
  if (due < today) return "OVERDUE";
  if (due === today) return "TODAY";
  const monday = getMondayOfWeek(today);
  if (due <= addDaysToKey(monday, 6)) return "THIS_WEEK";
  if (due <= addDaysToKey(monday, 13)) return "NEXT_WEEK";
  return "LATER";
}

export function groupWorkTasks<T extends { status: string; dueDate: string | Date | null }>(tasks: T[], today = getTodayKey()) {
  return WORK_PERIODS.map(period => ({ ...period, tasks: tasks.filter(task => getWorkPeriod(task, today) === period.key) }));
}
