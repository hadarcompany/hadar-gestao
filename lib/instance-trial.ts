const WEBHOOKS = new Set(["/api/webhooks/asaas", "/api/webhooks/whatsapp", "/api/webhooks/meta/whatsapp"]);
export function trialExpired(expiresAt = process.env.INSTANCE_TRIAL_ENDS_AT, now = Date.now()) {
  if (!expiresAt?.trim()) return false;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(expiresAt)) return true;
  const expiry = Date.parse(expiresAt);
  return !Number.isFinite(expiry) || now >= expiry;
}
export function trialDenial(request: Request, expiresAt = process.env.INSTANCE_TRIAL_ENDS_AT, now = Date.now()) {
  const path = new URL(request.url).pathname;
  // Keep billing/event ingestion and logout working; never erase data at expiry.
  if (!trialExpired(expiresAt, now) || WEBHOOKS.has(path) || path === "/api/auth/logout") return null;
  const message = "O período de testes foi encerrado. Seus dados foram preservados. Entre em contato com a Hadar para prorrogar ou liberar o acesso.";
  return path.startsWith("/api/")
    ? Response.json({ error: "TRIAL_EXPIRED", message }, { status: 402, headers: { "Cache-Control": "no-store" } })
    : new Response(message, { status: 402, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
