import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@prisma/client";

export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  taskId?: string | null;
  clientId?: string | null;
}) {
  return prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      taskId: params.taskId ?? null,
      clientId: params.clientId ?? null,
    },
  });
}

/** Extrai @menções de um texto de mensagem a partir da lista de membros da equipe.
 * Faz correspondência pelo primeiro nome (case-insensitive), que é o que o seletor de @menção insere. */
export function extractMentions(content: string, users: { id: string; name: string }[]): string[] {
  const matches = content.match(/@([\p{L}0-9._-]+)/gu) ?? [];
  const handles = new Set(matches.map((m) => m.slice(1).toLowerCase()));
  if (handles.size === 0) return [];
  const ids = new Set<string>();
  for (const user of users) {
    const firstName = user.name.split(" ")[0]?.toLowerCase();
    const fullHandle = user.name.replace(/\s+/g, "").toLowerCase();
    if ((firstName && handles.has(firstName)) || handles.has(fullHandle)) {
      ids.add(user.id);
    }
  }
  return Array.from(ids);
}

/**
 * Notifica quem foi @mencionado num texto da tarefa. Com `previousContent` (edição),
 * só avisa quem foi marcado agora — quem já estava no texto não é notificado de novo.
 */
export async function notifyMentions(params: {
  content: string | null | undefined;
  previousContent?: string | null;
  authorId: string;
  task: { id: string; title: string; clientId: string | null };
}) {
  if (!params.content) return [];
  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  const already = new Set(params.previousContent ? extractMentions(params.previousContent, users) : []);
  const ids = extractMentions(params.content, users).filter((id) => id !== params.authorId && !already.has(id));
  if (ids.length === 0) return [];

  const author = users.find((u) => u.id === params.authorId)?.name.split(" ")[0] ?? "Alguém";
  const body = params.content.slice(0, 140);
  await Promise.all(
    ids.map((userId) =>
      createNotification({
        userId,
        type: "MENTION",
        title: `${author} mencionou você em "${params.task.title}"`,
        body,
        taskId: params.task.id,
        clientId: params.task.clientId,
      })
    )
  );
  return ids;
}
