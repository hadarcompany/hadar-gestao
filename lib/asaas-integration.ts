import { timingSafeEqual } from "node:crypto";
import { decryptIntegrationSecret } from "./integrations/crypto";

export class AsaasApiError extends Error {
  constructor(message: string, public status: number, public details?: unknown) { super(message); this.name = "AsaasApiError"; }
}
export type AsaasEnvironment = "production" | "sandbox";
export const ASAAS_KEY_CONTEXT = "hadar/asaas/api-key/v1";
export const ASAAS_WEBHOOK_CONTEXT = "hadar/asaas/webhook/v1";
export type AsaasIntegrationRecord = { enabled: boolean; environment: string; apiKeyEncrypted: string | null; webhookTokenEncrypted: string | null; updatedAt: Date } | null;
export type AsaasIntegrationStatus = { configured: boolean; enabled: boolean; environment: AsaasEnvironment; baseUrl: string; source: "app" | "server" | "none"; webhookConfigured: boolean; updatedAt: string | null };

export function asaasIntegrationStatus(record: AsaasIntegrationRecord): AsaasIntegrationStatus {
  const enabled = record?.enabled !== false;
  const environment = (record?.environment ?? process.env.ASAAS_ENVIRONMENT) === "production" ? "production" : "sandbox";
  const source = record?.apiKeyEncrypted ? "app" : process.env.ASAAS_API_KEY?.trim() ? "server" : "none";
  return { configured: enabled && source !== "none", enabled, environment, baseUrl: environment === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3", source: enabled ? source : "none", webhookConfigured: enabled && Boolean(record?.webhookTokenEncrypted || process.env.ASAAS_WEBHOOK_TOKEN?.trim()), updatedAt: record?.updatedAt.toISOString() ?? null };
}

export function asaasRuntimeConfig(record: AsaasIntegrationRecord) {
  const status = asaasIntegrationStatus(record);
  if (!status.configured) throw new AsaasApiError("Configure o Asaas em Configurações > Integrações.", 503);
  try {
    const apiKey = record?.apiKeyEncrypted ? decryptIntegrationSecret(record.apiKeyEncrypted, ASAAS_KEY_CONTEXT) : process.env.ASAAS_API_KEY!.trim();
    return { apiKey, environment: status.environment, baseUrl: status.baseUrl };
  } catch { throw new AsaasApiError("Não foi possível ler a chave do Asaas. Cadastre-a novamente em Integrações.", 503); }
}

export function asaasWebhookToken(record: AsaasIntegrationRecord) {
  if (record?.enabled === false) return null;
  try { return record?.webhookTokenEncrypted ? decryptIntegrationSecret(record.webhookTokenEncrypted, ASAAS_WEBHOOK_CONTEXT) : process.env.ASAAS_WEBHOOK_TOKEN?.trim() || null; }
  catch { return null; }
}

export function validAsaasWebhookToken(expected: string | null, received: string | null) {
  if (!expected || !received) return false;
  const a = Buffer.from(expected), b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function parseAsaasIntegrationInput(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new AsaasApiError("Configuração inválida.", 400);
  const body = raw as Record<string, unknown>;
  if (Object.keys(body).some(key => !["apiKey", "environment", "webhookToken"].includes(key))) throw new AsaasApiError("Campo de configuração inválido.", 400);
  const secret = (key: string) => {
    if (body[key] === undefined) return undefined;
    if (typeof body[key] !== "string") throw new AsaasApiError("Credencial inválida.", 400);
    const value = (body[key] as string).trim();
    if (value && /\s/.test(value)) throw new AsaasApiError("A credencial não pode conter espaços ou quebras de linha.", 400);
    return value || undefined;
  };
  const apiKey = secret("apiKey"), webhookToken = secret("webhookToken");
  if (apiKey && !/^\$aact_(prod|hmlg)_[A-Za-z0-9_$.-]{20,1024}$/.test(apiKey)) throw new AsaasApiError("Cole uma chave API válida do Asaas.", 400);
  if (body.environment !== undefined && !["production", "sandbox"].includes(String(body.environment))) throw new AsaasApiError("Ambiente inválido.", 400);
  const environment = body.environment as AsaasEnvironment | undefined;
  if (apiKey && environment && apiKey.startsWith(environment === "production" ? "$aact_hmlg_" : "$aact_prod_")) throw new AsaasApiError("A chave não corresponde ao ambiente selecionado.", 400);
  if (webhookToken && (webhookToken.length < 32 || webhookToken.length > 255 || webhookToken.startsWith("$aact_") || webhookToken === apiKey)) throw new AsaasApiError("Use um token de webhook próprio, de 32 a 255 caracteres.", 400);
  return { apiKey, environment, webhookToken };
}
