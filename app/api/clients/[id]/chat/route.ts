import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { withMedia } from "@/lib/media";
import { createNotification, extractMentions } from "@/lib/notifications";

export async function GET(_req: NextRequest, { params: routeParams }: { params: Promise<{ id: string }> }) {
  const params = await routeParams;
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [messages, readState] = await Promise.all([
    prisma.clientChatMessage.findMany({
      where: { clientId: params.id },
      include: {
        author: { select: { id: true, name: true } },
        task: { select: { id: true, title: true, status: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
    prisma.clientChatRead.findUnique({ where: { clientId_userId: { clientId: params.id, userId: auth.id } } }),
  ]);

  return NextResponse.json(await withMedia({ messages, lastReadAt: readState?.lastReadAt ?? null }));
}

export async function POST(req: NextRequest, { params: routeParams }: { params: Promise<{ id: string }> }) {
  const params = await routeParams;
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await prisma.client.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const content: string = (body.content || "").trim();
  if (!content) return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });

  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  const mentionedUserIds = extractMentions(content, users).filter((id) => id !== auth.id);

  const message = await prisma.clientChatMessage.create({
    data: {
      clientId: params.id,
      authorId: auth.id,
      content,
      taskId: body.taskId || null,
      mentionedUserIds,
    },
    include: {
      author: { select: { id: true, name: true } },
      task: { select: { id: true, title: true, status: true } },
    },
  });

  await Promise.all(
    mentionedUserIds.map((userId) =>
      createNotification({
        userId,
        type: "MENTION",
        title: "Você foi mencionado em um chat",
        body: content.slice(0, 140),
        clientId: params.id,
        taskId: body.taskId || null,
      })
    )
  );

  // Autor sempre lê a própria mensagem ao enviar.
  await prisma.clientChatRead.upsert({
    where: { clientId_userId: { clientId: params.id, userId: auth.id } },
    update: { lastReadAt: new Date() },
    create: { clientId: params.id, userId: auth.id },
  });

  return NextResponse.json(await withMedia(message), { status: 201 });
}
