import type { TaskData } from "@/lib/types";

export const PROJECT_STATUSES = [
  { value: "PLANEJADO", label: "Planejado", color: "bg-gray-100 text-gray-600" },
  { value: "EM_ANDAMENTO", label: "Em andamento", color: "bg-blue-500/10 text-blue-600" },
  { value: "PAUSADO", label: "Pausado", color: "bg-amber-500/10 text-amber-600" },
  { value: "CONCLUIDO", label: "Concluído", color: "bg-emerald-500/10 text-emerald-600" },
] as const;

export const PROJECT_COLORS = ["#3b82f6", "#f59e0b", "#8b5cf6", "#10b981", "#ef4444", "#ec4899", "#64748b"];

export interface ProjectData {
  id: string;
  name: string;
  description: string | null;
  kind: "GERAL" | "ONBOARDING";
  status: string;
  color: string | null;
  dueDate: string | null;
  clientId: string | null;
  client: { id: string; name: string; logoUrl?: string | null } | null;
  createdAt: string;
  tasks: TaskData[];
}

export function projectStatusInfo(status: string) {
  return PROJECT_STATUSES.find((s) => s.value === status) ?? PROJECT_STATUSES[1];
}

/** Progresso ignora tarefas canceladas: elas não contam nem como feitas nem como pendentes. */
export function projectProgress(tasks: { status: string }[]) {
  const counted = tasks.filter((t) => t.status !== "CANCELLED");
  const done = counted.filter((t) => t.status === "COMPLETED").length;
  return { done, total: counted.length, pct: counted.length ? Math.round((done / counted.length) * 100) : 0 };
}
