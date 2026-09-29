import { normalizeWhatsAppPhone } from "@/lib/whatsapp/phones";

const graphVersion = () => process.env.META_GRAPH_API_VERSION?.trim() || "v26.0";
const token = () => process.env.META_WHATSAPP_ACCESS_TOKEN?.trim() || "";
const phoneNumberId = () => process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim() || "";

export function metaCloudConfigured() {
  return Boolean(token() && phoneNumberId() && process.env.META_WHATSAPP_VERIFY_TOKEN?.trim());
}

export function metaCloudState() {
  return {
    configured: metaCloudConfigured(),
    status: metaCloudConfigured() ? "WORKING" : "NOT_CONFIGURED",
    session: "meta-cloud",
    provider: "META_CLOUD" as const,
    me: process.env.META_WHATSAPP_DISPLAY_NAME ? { pushName: process.env.META_WHATSAPP_DISPLAY_NAME } : null,
  };
}

export async function sendMetaCloudText(chatId: string, text: string) {
  if (!metaCloudConfigured()) throw new Error("META_CLOUD_NOT_CONFIGURED");
  const response = await fetch(`https://graph.facebook.com/${graphVersion()}/${phoneNumberId()}/messages`, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: normalizeWhatsAppPhone(chatId), type: "text", text: { body: text, preview_url: false } }),
  });
  const body = await response.json().catch(() => ({})) as { messages?: { id?: string }[]; error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message || `META_WHATSAPP_${response.status}`);
  return { externalId: body.messages?.[0]?.id ?? null, raw: body };
}
