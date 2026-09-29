const baseUrl = () => process.env.WAHA_API_BASE_URL?.replace(/\/$/, "") ?? "";
const apiKey = () => process.env.WAHA_API_KEY ?? "";

export const whatsappSessionName = () => process.env.WAHA_SESSION_NAME?.trim() || "hadar";
export const whatsappConfigured = () => Boolean(baseUrl() && apiKey());

async function request(path: string, init: RequestInit = {}, timeoutMs = 15_000) {
  if (!whatsappConfigured()) throw new Error("WAHA_NOT_CONFIGURED");
  return fetch(`${baseUrl()}${path}`, {
    ...init,
    cache: "no-store",
    signal: init.signal ?? AbortSignal.timeout(timeoutMs),
    headers: {
      "X-Api-Key": apiKey(),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
}

async function wahaError(prefix: string, response: Response) {
  const body = await response.text().catch(() => "");
  const compact = body.replace(/\s+/g, " ").trim().slice(0, 240);
  return new Error(`${prefix}_${response.status}${compact ? `: ${compact}` : ""}`);
}

const sessionConfig = {
  ignore: { status: true, groups: true, channels: true },
  noweb: { store: { enabled: true, fullSync: false } },
};

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
  if (["WORKING", "STARTING", "SCAN_QR_CODE", "SCAN_QR"].includes(session?.status ?? "")) return session;

  // Primeiro tenta recuperar o processo do engine sem apagar a sessão.
  if (session?.status === "FAILED") {
    const restarted = await request(`/api/sessions/${encodeURIComponent(name)}/restart`, { method: "POST", body: "{}" }, 35_000);
    if (restarted.ok) {
      await new Promise((resolve) => setTimeout(resolve, 750));
      session = await getWhatsAppSession();
      if (session && session.status !== "FAILED") return session;
    }

    // Se o engine continuar quebrado, remove apenas a sessão do WAHA. As
    // conversas importadas continuam preservadas no banco da aplicação.
    const removed = await request(`/api/sessions/${encodeURIComponent(name)}`, { method: "DELETE" }, 35_000);
    if (!removed.ok && removed.status !== 404) {
      const legacyRemoved = await request("/api/sessions/logout", {
        method: "POST",
        body: JSON.stringify({ name }),
      }, 35_000);
      if (!legacyRemoved.ok && ![404, 422].includes(legacyRemoved.status)) throw await wahaError("WAHA_RESET", legacyRemoved);
    }
    session = null;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (!session) {
    // O endpoint atômico evita a corrida entre criar a sessão e iniciar o
    // engine, especialmente logo depois de recuperar uma sessão FAILED.
    const upserted = await request("/api/sessions/start", {
      method: "POST",
      body: JSON.stringify({ name, config: sessionConfig }),
    }, 35_000);
    if (upserted.ok || upserted.status === 422) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return getWhatsAppSession();
    }
    if (upserted.status !== 404) throw await wahaError("WAHA_UPSERT_START", upserted);

    const created = await request("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ name, start: false, config: sessionConfig }),
    }, 35_000);
    if (!created.ok && created.status !== 422) throw await wahaError("WAHA_CREATE", created);
  }

  const started = await request(`/api/sessions/${encodeURIComponent(name)}/start`, { method: "POST", body: "{}" }, 35_000);
  if (!started.ok && started.status !== 422) throw await wahaError("WAHA_START", started);
  session = await getWhatsAppSession();
  return session;
}

export async function getWhatsAppQr() {
  const session = encodeURIComponent(whatsappSessionName());
  const qr = await request(`/api/${session}/auth/qr`, {}, 35_000);
  if (qr.ok) return qr;
  // Algumas versões do WAHA Core/NOWEB expõem o pareamento pela captura da
  // sessão enquanto o QR ainda está sendo inicializado.
  if ([404, 422, 500].includes(qr.status)) return request(`/api/screenshot?session=${session}`, {}, 35_000);
  return qr;
}

export async function sendWhatsAppText(chatId: string, text: string) {
  const response = await request("/api/sendText", {
    method: "POST",
    body: JSON.stringify({ session: whatsappSessionName(), chatId, text }),
  });
  if (!response.ok) throw new Error(`WAHA_SEND_${response.status}`);
  return response.json() as Promise<Record<string, unknown>>;
}

export async function logoutWhatsAppSession() {
  const response = await request(`/api/sessions/${encodeURIComponent(whatsappSessionName())}/logout`, { method: "POST", body: "{}" });
  if (!response.ok && response.status !== 404 && response.status !== 422) throw new Error(`WAHA_LOGOUT_${response.status}`);
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
