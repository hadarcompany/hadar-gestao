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
