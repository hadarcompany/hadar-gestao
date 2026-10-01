export const TASK_COLUMN_OPTIONS = [
  { key: "status", label: "Status" },
  { key: "priority", label: "Prioridade" },
  { key: "labels", label: "Etiquetas" },
  { key: "client", label: "Cliente" },
  { key: "assignee", label: "Responsável" },
  { key: "dueDate", label: "Prazo" },
  { key: "publishDate", label: "Publicação" },
] as const;

export type TaskColumnKey = (typeof TASK_COLUMN_OPTIONS)[number]["key"];

export const DEFAULT_TASK_COLUMNS: TaskColumnKey[] = TASK_COLUMN_OPTIONS.map(({ key }) => key);

export function isTaskColumnKey(value: unknown): value is TaskColumnKey {
  return TASK_COLUMN_OPTIONS.some(({ key }) => key === value);
}
