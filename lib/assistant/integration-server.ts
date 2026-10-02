import { prisma } from "@/lib/prisma";
import { DEFAULT_ASSISTANT_MODEL, type AssistantIntegrationStatus } from "./integration";
import { decryptAssistantKey } from "./integration-crypto";
import { AssistantError } from "./types";

type IntegrationRecord = { enabled: boolean; apiKeyEncrypted: string | null; workspaceId?: string | null; model: string; updatedAt: Date } | null;
export type AssistantRuntimeConfig = { apiKey: string; model: string; workspaceId?: string };

export function assistantIntegrationStatus(record: IntegrationRecord): AssistantIntegrationStatus {
  const enabled = record?.enabled !== false;
  const source = record?.apiKeyEncrypted ? "app" : process.env.ANTHROPIC_API_KEY?.trim() ? "server" : "none";
  return {
    configured: enabled && source !== "none", enabled,
    source: enabled ? source : "none",
    model: record?.model || process.env.ANTHROPIC_MODEL || DEFAULT_ASSISTANT_MODEL,
    updatedAt: record?.updatedAt.toISOString() || null,
    workspaceId: record?.apiKeyEncrypted ? record.workspaceId || null : record?.workspaceId || process.env.ANTHROPIC_WORKSPACE_ID?.trim() || null,
  };
}

export function assistantRuntimeConfig(record: IntegrationRecord): AssistantRuntimeConfig {
  const status = assistantIntegrationStatus(record);
  if (!status.configured) throw new AssistantError("Configure a chave do Claude em Configurações > Integrações para usar o Assistente.", 503);
  return { apiKey: record?.apiKeyEncrypted ? decryptAssistantKey(record.apiKeyEncrypted) : process.env.ANTHROPIC_API_KEY!.trim(), model: status.model, ...(status.workspaceId ? { workspaceId: status.workspaceId } : {}) };
}

export async function getAssistantIntegrationStatus() {
  return assistantIntegrationStatus(await prisma.assistantIntegration.findUnique({ where: { id: "primary" } }));
}

export async function getAssistantRuntimeConfig() {
  return assistantRuntimeConfig(await prisma.assistantIntegration.findUnique({ where: { id: "primary" } }));
}
