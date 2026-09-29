import { getWhatsAppQr, getWhatsAppSession, sendWhatsAppText, startWhatsAppSession, whatsappConfigured, whatsappSessionName, logoutWhatsAppSession } from "@/lib/whatsapp/waha";
import { metaCloudConfigured, metaCloudState, sendMetaCloudText } from "@/lib/whatsapp/meta-cloud";

export type WhatsAppProvider = "WAHA" | "META_CLOUD";
export const whatsappProvider = (): WhatsAppProvider => process.env.WHATSAPP_PROVIDER?.trim().toUpperCase() === "META_CLOUD" ? "META_CLOUD" : "WAHA";

export async function getWhatsAppProviderState() {
  if (whatsappProvider() === "META_CLOUD") return metaCloudState();
  if (!whatsappConfigured()) return { configured: false, status: "NOT_CONFIGURED", session: whatsappSessionName(), provider: "WAHA" as const, me: null };
  const session = await getWhatsAppSession();
  return { configured: true, status: session?.status ?? "NOT_STARTED", session: whatsappSessionName(), provider: "WAHA" as const, me: session?.me ?? null };
}

export function whatsappProviderConfigured() {
  return whatsappProvider() === "META_CLOUD" ? metaCloudConfigured() : whatsappConfigured();
}

export async function startWhatsAppProvider() {
  if (whatsappProvider() === "META_CLOUD") return metaCloudState();
  const session = await startWhatsAppSession();
  return { configured: true, status: session?.status ?? "STARTING", session: whatsappSessionName(), provider: "WAHA" as const, me: session?.me ?? null };
}

export async function getWhatsAppProviderQr() {
  if (whatsappProvider() !== "WAHA") throw new Error("QR_NOT_SUPPORTED");
  return getWhatsAppQr();
}

export async function sendWhatsAppProviderText(chatId: string, text: string) {
  if (whatsappProvider() === "META_CLOUD") return sendMetaCloudText(chatId, text);
  const raw = await sendWhatsAppText(chatId, text);
  return { externalId: wahaMessageId(raw), raw };
}

export async function logoutWhatsAppProvider() {
  if (whatsappProvider() !== "WAHA") throw new Error("LOGOUT_NOT_SUPPORTED");
  await logoutWhatsAppSession();
}

function wahaMessageId(payload: Record<string, unknown>): string | null {
  const id = payload.id;
  if (typeof id === "string") return id;
  if (id && typeof id === "object") {
    const record = id as Record<string, unknown>;
    return typeof record._serialized === "string" ? record._serialized : typeof record.id === "string" ? record.id : null;
  }
  return null;
}
