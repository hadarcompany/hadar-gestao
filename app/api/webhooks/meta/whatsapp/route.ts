import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { storeWhatsAppMessage, updateWhatsAppMessageStatus } from "@/lib/whatsapp/store";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp/phones";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");
  const expected = process.env.META_WHATSAPP_VERIFY_TOKEN?.trim();
  if (mode === "subscribe" && expected && token === expected && challenge) return new NextResponse(challenge, { status: 200 });
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

function validSignature(raw: string, signature: string | null) {
  const secret = process.env.META_APP_SECRET?.trim();
  if (!secret) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
  return Boolean(signature && signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected)));
}

type CloudMessage = {
  from?: string; id?: string; timestamp?: string; type?: string;
  text?: { body?: string }; image?: { caption?: string }; video?: { caption?: string };
  document?: { caption?: string; filename?: string }; button?: { text?: string };
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
};

function messageBody(message: CloudMessage) {
  if (message.text?.body) return message.text.body;
  if (message.image) return message.image.caption?.trim() || "[imagem]";
  if (message.video) return message.video.caption?.trim() || "[vídeo]";
  if (message.document) return message.document.caption?.trim() || message.document.filename || "[documento]";
  if (message.type === "audio") return "[áudio]";
  if (message.type === "sticker") return "[figurinha]";
  return message.button?.text || message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || `[${message.type || "mídia"}]`;
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"))) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  const body = JSON.parse(raw) as {
    object?: string;
    entry?: { changes?: { value?: {
      contacts?: { wa_id?: string; profile?: { name?: string } }[];
      messages?: CloudMessage[];
      statuses?: { id?: string; status?: string }[];
    } }[] }[];
  };
  if (body.object !== "whatsapp_business_account") return NextResponse.json({ accepted: true, ignored: true });
  for (const entry of body.entry ?? []) for (const change of entry.changes ?? []) {
    const value = change.value;
    const contactNames = new Map((value?.contacts ?? []).map((contact) => [contact.wa_id, contact.profile?.name ?? null]));
    for (const message of value?.messages ?? []) {
      const phone = normalizeWhatsAppPhone(message.from ?? "");
      if (!phone) continue;
      await storeWhatsAppMessage({
        chatId: phone,
        phone,
        name: contactNames.get(message.from) ?? null,
        body: messageBody(message),
        sentAt: new Date(Number(message.timestamp || 0) * 1000 || Date.now()),
        externalId: message.id ?? null,
        fromMe: false,
      });
    }
    for (const status of value?.statuses ?? []) if (status.id && status.status) await updateWhatsAppMessageStatus(status.id, status.status);
  }
  return NextResponse.json({ accepted: true });
}
