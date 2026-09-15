import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { withMedia } from "@/lib/media";
import { createNotification, extractMentions } from "@/lib/notifications";

const AUTHOR = { author: { select: { id: true, name: true } } };

export async function GET(_req: NextRequest, { params: routeParams }: { params: Promise<{ id: string }> }) {
  const params = await routeParams;
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const updates = await prisma.taskUpdate.findMany({
    where: { taskId: params.id },
    include: AUTHOR,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json(await withMedia(updates));
}

/** Publica uma atualização; cada @mencionado recebe notificação que abre a tarefa. */
export async function POST(req: NextRequest, { params: routeParams }: { params: Promise<{ id: string }> }) {
  const params = await routeParams;
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return NextResponse.json({ error: "Escreva a atualização" }, { status: 400 });
  if (content.length > 5000) return NextResponse.json({ error: "Atualização muito longa" }, { status: 400 });

  const task = await prisma.task.findUnique({ where: { id: params.id }, select: { id: true, title: true, clientId: true } });
  if (!task) return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });

  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  const mentionedUserIds = extractMentions(content, users).filter((id) => id !== auth.id);

  const update = await prisma.taskUpdate.create({
    data: { taskId: task.id, authorId: auth.id, content, mentionedUserIds },
    include: AUTHOR,
  });

  const authorName = users.find((u) => u.id === auth.id)?.name.split(" ")[0] ?? "Alguém";
  await Promise.all(
    mentionedUserIds.map((userId) =>
      createNotification({
        userId,
        type: "MENTION",
        title: `${authorName} mencionou você em "${task.title}"`,
        body: content.slice(0, 140),
        taskId: task.id,
        clientId: task.clientId,
      })
    )
  );

  return NextResponse.json(await withMedia(update), { status: 201 });
}
