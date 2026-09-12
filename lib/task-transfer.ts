import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

const TASK_INCLUDE = {
  client: { select: { id: true, name: true, logoUrl: true } },
  createdBy: { select: { id: true, name: true } },
  assignees: { include: { user: { select: { id: true, name: true, image: true } } } },
  attachments: {
    select: {
      id: true, fileName: true, mimeType: true, size: true, createdAt: true,
      uploadedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  },
} as const;

/**
 * Ponto único de transferência de responsáveis por uma tarefa. Atualiza os
 * responsáveis, registra o evento no histórico da tarefa, publica um aviso no
 * chat do cliente (se houver cliente vinculado) e notifica os novos
 * responsáveis — sempre em uma única chamada, para nunca duplicar eventos ou
 * notificações independentemente da tela que disparou a transferência.
 */
export async function transferTask(params: {
  taskId: string;
  toUserIds: string[];
  note?: string | null;
  performedById: string;
}) {
  const { taskId, toUserIds, note, performedById } = params;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignees: true },
  });
  if (!task) {
    throw Object.assign(new Error("Tarefa não encontrada"), { code: "NOT_FOUND" });
  }

  const fromUserIds = task.assignees.map((a) => a.userId);
  const uniqueToUserIds = Array.from(new Set(toUserIds));

  await prisma.$transaction([
    prisma.taskAssignee.deleteMany({ where: { taskId } }),
    prisma.taskAssignee.createMany({
      data: uniqueToUserIds.map((userId) => ({ taskId, userId })),
      skipDuplicates: true,
    }),
  ]);

  await prisma.taskTransferEvent.create({
    data: { taskId, fromUserIds, toUserIds: uniqueToUserIds, note: note || null, performedById },
  });

  const [performer, toUsers, fromUsers] = await Promise.all([
    prisma.user.findUnique({ where: { id: performedById }, select: { name: true } }),
    prisma.user.findMany({ where: { id: { in: uniqueToUserIds } }, select: { id: true, name: true } }),
    fromUserIds.length
      ? prisma.user.findMany({ where: { id: { in: fromUserIds } }, select: { name: true } })
      : Promise.resolve([]),
  ]);

  const performerName = performer?.name ?? "Alguém";
  const fromNames = fromUsers.map((u) => u.name).join(", ") || "sem responsável";
  const toNames = toUsers.map((u) => u.name).join(", ") || "sem responsável";
  const summary = `🔄 ${performerName} transferiu a tarefa "${task.title}" de ${fromNames} para ${toNames}.${note ? ` Nota: ${note}` : ""}`;

  if (task.clientId) {
    await prisma.clientChatMessage.create({
      data: {
        clientId: task.clientId,
        isSystem: true,
        content: summary,
        taskId,
      },
    });
  }

  await Promise.all(
    uniqueToUserIds
      .filter((id) => id !== performedById)
      .map((userId) =>
        createNotification({
          userId,
          type: "TRANSFER",
          title: "Tarefa transferida para você",
          body: `${performerName} transferiu "${task.title}" para você.`,
          taskId,
          clientId: task.clientId,
        })
      )
  );

  const full = await prisma.task.findUnique({ where: { id: taskId }, include: TASK_INCLUDE });
  return full!;
}

export function resetChecklistForClone(checklist: unknown): unknown {
  if (!Array.isArray(checklist)) return checklist;
  return checklist.map((item, i) => ({
    id: `item-${i}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text: (item as { text?: string }).text ?? "",
    checked: false,
  }));
}

export { TASK_INCLUDE };
