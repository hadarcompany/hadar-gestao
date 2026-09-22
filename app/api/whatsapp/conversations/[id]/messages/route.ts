import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { canEdit, canView } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppText, wahaMessageId } from "@/lib/whatsapp/waha";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canView(auth, "pipeline")) return NextResponse.json({ error: "Sem acesso ao pipeline." }, { status: 403 });
  const { id } = await params;
  const conversation = await prisma.whatsAppConversation.findUnique({ where: { id }, select: { id: true } });
  if (!conversation) return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
  const messages = await prisma.whatsAppMessage.findMany({ where: { conversationId: id }, orderBy: { sentAt: "asc" }, take: 300 });
  await prisma.whatsAppConversation.update({ where: { id }, data: { unreadCount: 0 } });
  return NextResponse.json(messages);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEdit(auth, "pipeline")) return NextResponse.json({ error: "Sem permissão para enviar mensagens." }, { status: 403 });
  const { id } = await params;
  const conversation = await prisma.whatsAppConversation.findUnique({ where: { id } });
  if (!conversation) return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "Escreva uma mensagem." }, { status: 400 });
  try {
    const sent = await sendWhatsAppText(conversation.chatId, text);
    const sentAt = new Date();
    const message = await prisma.whatsAppMessage.create({
      data: { conversationId: id, externalId: wahaMessageId(sent), direction: "OUTBOUND", body: text, status: "SENT", sentAt },
    });
    await prisma.whatsAppConversation.update({ where: { id }, data: { lastMessage: text, lastMessageAt: sentAt } });
    return NextResponse.json(message, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Não foi possível enviar pelo WhatsApp." }, { status: 502 });
  }
}
