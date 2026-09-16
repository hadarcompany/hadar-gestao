import type { TaskData } from "@/lib/types";

export type SortKey = "status" | "priority" | "title" | "client" | "assignee" | "dueDate";
export interface SortState { key: SortKey; dir: "asc" | "desc" }

const PRIORITY_RANK: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const STATUS_RANK: Record<string, number> = { IN_PROGRESS: 0, IN_REVIEW: 1, PENDING: 2, COMPLETED: 3, CANCELLED: 4 };

/** Vazios vão para o fim na ordem crescente. */
const LAST = "￿";

function compare(a: TaskData, b: TaskData, key: SortKey): number {
  switch (key) {
    case "title":
      return a.title.localeCompare(b.title, "pt-BR");
    case "client":
      return (a.client?.name ?? LAST).localeCompare(b.client?.name ?? LAST, "pt-BR");
    case "assignee":
      return (a.assignees[0]?.user.name ?? LAST).localeCompare(b.assignees[0]?.user.name ?? LAST, "pt-BR");
    case "priority":
      return (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
    case "status":
      return (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
    case "dueDate": {
      const av = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
      const bv = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
      return av === bv ? 0 : av - bv;
    }
  }
}

export function sortTasks(tasks: TaskData[], sort: SortState): TaskData[] {
  const factor = sort.dir === "asc" ? 1 : -1;
  // Desempata pelo nome para a ordem não variar entre renders.
  return [...tasks].sort((a, b) => factor * compare(a, b, sort.key) || a.title.localeCompare(b.title, "pt-BR"));
}
