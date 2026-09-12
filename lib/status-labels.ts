import { STATUS_OPTIONS, PRIORITY_OPTIONS } from "@/lib/task-templates";

export function statusLabel(status: string): string {
  return STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status;
}

export function statusColor(status: string): string {
  return STATUS_OPTIONS.find((s) => s.value === status)?.color ?? "bg-gray-100 text-gray-600";
}

export function priorityLabel(priority: string): string {
  return PRIORITY_OPTIONS.find((p) => p.value === priority)?.label ?? priority;
}

export function priorityColor(priority: string): string {
  return PRIORITY_OPTIONS.find((p) => p.value === priority)?.color ?? "text-gray-500";
}

export const DATE_BUCKET_LABEL: Record<string, string> = {
  OVERDUE: "Atrasada",
  TODAY: "Hoje",
  UPCOMING: "Próxima",
  NO_DATE: "Sem data",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};
