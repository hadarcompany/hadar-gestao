import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { storeWhatsAppMessage } from "@/lib/whatsapp/store";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp/phones";

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
  const id = payload.id;
  const externalId = typeof id === "string" ? id : id && typeof id === "object"
    ? String((id as Record<string, unknown>)._serialized ?? (id as Record<string, unknown>).id ?? "") || null
    : null;
  await storeWhatsAppMessage({ chatId, phone, name, body, sentAt, externalId, fromMe });
  return NextResponse.json({ accepted: true });
}
