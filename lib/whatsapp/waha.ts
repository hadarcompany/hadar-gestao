const baseUrl = () => process.env.WAHA_API_BASE_URL?.replace(/\/$/, "") ?? "";
const apiKey = () => process.env.WAHA_API_KEY ?? "";

export const whatsappSessionName = () => process.env.WAHA_SESSION_NAME?.trim() || "hadar";
export const whatsappConfigured = () => Boolean(baseUrl() && apiKey());

async function request(path: string, init: RequestInit = {}) {
  if (!whatsappConfigured()) throw new Error("WAHA_NOT_CONFIGURED");
  return fetch(`${baseUrl()}${path}`, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
    headers: {
      "X-Api-Key": apiKey(),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
}

export async function getWhatsAppSession() {
  const name = whatsappSessionName();
  const response = await request(`/api/sessions/${encodeURIComponent(name)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`WAHA_${response.status}`);
  return response.json() as Promise<{ name: string; status: string; me?: { id?: string; pushName?: string } | null }>;
}

export async function startWhatsAppSession() {
  const name = whatsappSessionName();
  let session = await getWhatsAppSession();
  if (!session) {
    const created = await request("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ name, start: false, config: { ignore: { status: true, groups: true, channels: true } } }),
    });
    if (!created.ok && created.status !== 422) throw new Error(`WAHA_CREATE_${created.status}`);
  }
  const started = await request(`/api/sessions/${encodeURIComponent(name)}/start`, { method: "POST", body: "{}" });
  if (!started.ok && started.status !== 422) throw new Error(`WAHA_START_${started.status}`);
  session = await getWhatsAppSession();
  return session;
}

export async function getWhatsAppQr() {
  return request(`/api/${encodeURIComponent(whatsappSessionName())}/auth/qr?format=image`);
}

export async function sendWhatsAppText(chatId: string, text: string) {
  const response = await request("/api/sendText", {
    method: "POST",
    body: JSON.stringify({ session: whatsappSessionName(), chatId, text }),
  });
  if (!response.ok) throw new Error(`WAHA_SEND_${response.status}`);
  return response.json() as Promise<Record<string, unknown>>;
}

export function wahaMessageId(payload: Record<string, unknown>): string | null {
  const id = payload.id;
  if (typeof id === "string") return id;
  if (id && typeof id === "object") {
    const record = id as Record<string, unknown>;
    return typeof record._serialized === "string" ? record._serialized : typeof record.id === "string" ? record.id : null;
  }
  return null;
}

export function normalizeWhatsAppPhone(value: string): string {
  return value.split("@")[0]?.replace(/\D/g, "") ?? "";
}
