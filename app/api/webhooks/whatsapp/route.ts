import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeWhatsAppPhone, wahaMessageId } from "@/lib/whatsapp/waha";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function validToken(req: NextRequest) {
  const expected = process.env.WAHA_WEBHOOK_TOKEN ?? "";
  const received = req.headers.get("x-hadar-webhook-token") ?? new URL(req.url).searchParams.get("token") ?? "";
  if (!expected || expected.length !== received.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

function eventDate(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return new Date();
  return new Date(number < 10_000_000_000 ? number * 1000 : number);
}

export async function POST(req: NextRequest) {
  if (!validToken(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const envelope = await req.json().catch(() => null) as { event?: string; payload?: Record<string, unknown> } | null;
  if (!envelope?.payload || !["message", "message.any"].includes(envelope.event ?? "")) return NextResponse.json({ accepted: true, ignored: true });

  const payload = envelope.payload;
  const fromMe = payload.fromMe === true;
  const chatId = String((fromMe ? payload.to : payload.from) ?? payload.from ?? "");
  if (!chatId || chatId.includes("@g.us") || chatId.includes("status@broadcast")) {
    return NextResponse.json({ accepted: true, ignored: true });
  }
  const phone = normalizeWhatsAppPhone(chatId);
  if (!phone) return NextResponse.json({ accepted: true, ignored: true });

  const rawData = payload._data && typeof payload._data === "object" ? payload._data as Record<string, unknown> : {};
  const name = String(payload.notifyName ?? rawData.notifyName ?? "").trim() || null;
  const body = String(payload.body ?? payload.caption ?? "").trim() || "[mídia]";
  const sentAt = eventDate(payload.timestamp);
  const externalId = wahaMessageId(payload);

  const leads = await prisma.lead.findMany({ where: { phone: { not: null } }, select: { id: true, phone: true } });
  let lead = leads.find((item) => normalizeWhatsAppPhone(item.phone ?? "").endsWith(phone.slice(-8)));
  if (!lead && !fromMe) {
    lead = await prisma.lead.create({
      data: { name: name ?? `WhatsApp ${phone.slice(-4)}`, phone: `+${phone}`, origin: "WhatsApp", stage: "NOVO" },
      select: { id: true, phone: true },
    });
  }

  const conversation = await prisma.whatsAppConversation.upsert({
    where: { chatId },
    create: {
      chatId, phone: `+${phone}`, name, leadId: lead?.id ?? null, lastMessage: body, lastMessageAt: sentAt,
      unreadCount: fromMe ? 0 : 1,
    },
    update: {
      ...(name ? { name } : {}), ...(lead?.id ? { leadId: lead.id } : {}), lastMessage: body, lastMessageAt: sentAt,
      ...(fromMe ? {} : { unreadCount: { increment: 1 } }),
    },
  });

  try {
    await prisma.whatsAppMessage.create({
      data: { externalId, conversationId: conversation.id, direction: fromMe ? "OUTBOUND" : "INBOUND", body, status: "RECEIVED", sentAt },
    });
  } catch (error) {
    // Webhooks podem ser reenviados. O externalId único torna a ingestão idempotente.
    if (!(error instanceof Error) || !error.message.includes("Unique constraint")) throw error;
  }
  return NextResponse.json({ accepted: true });
}
