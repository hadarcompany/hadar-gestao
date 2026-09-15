import { TASK_INCLUDE } from "@/lib/task-transfer";

export const PROJECT_INCLUDE = {
  client: { select: { id: true, name: true } },
  tasks: { include: TASK_INCLUDE, orderBy: { dueDate: "asc" } },
} as const;

export const PROJECT_STATUS_VALUES = ["PLANEJADO", "EM_ANDAMENTO", "PAUSADO", "CONCLUIDO"];
