import type { AuthUser } from "@/types/auth";
import { AssistantError } from "./types";

export const DEFAULT_ASSISTANT_MODEL = "claude-sonnet-4-6";
export type AssistantIntegrationStatus = {
  configured: boolean; enabled: boolean; model: string;
  source: "app" | "server" | "none"; updatedAt: string | null;
  workspaceId: string | null;
};

export function requireAssistantIntegrationAdmin(auth: AuthUser | null) {
  if (!auth) throw new AssistantError("Não autenticado.", 401);
  if (auth.role !== "ADMIN") throw new AssistantError("Somente administradores podem configurar integrações.", 403);
  return auth;
}

export function parseAssistantIntegrationInput(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new AssistantError("Configuração inválida.");
  const body = raw as Record<string, unknown>;
  if (Object.keys(body).some((key) => key !== "apiKey" && key !== "model" && key !== "workspaceId")) throw new AssistantError("Campo de configuração inválido.");
  if (body.apiKey !== undefined && typeof body.apiKey !== "string") throw new AssistantError("Chave API inválida.");
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : undefined;
  if (apiKey && !/^sk-ant-[a-zA-Z0-9_-]{20,500}$/.test(apiKey)) throw new AssistantError("Informe uma chave API válida da Anthropic.");
  if (body.model !== undefined && (typeof body.model !== "string" || !/^claude-[a-zA-Z0-9.-]{1,100}$/.test(body.model.trim()))) throw new AssistantError("Modelo do Claude inválido.");
  if (body.workspaceId !== undefined && (typeof body.workspaceId !== "string" || (body.workspaceId.trim() && !/^wrkspc_[a-zA-Z0-9]{10,100}$/.test(body.workspaceId.trim())))) throw new AssistantError("Informe um ID de workspace válido da Anthropic, começando com wrkspc_.");
  return { apiKey: apiKey || undefined, model: typeof body.model === "string" ? body.model.trim() : undefined, ...(body.workspaceId !== undefined ? { workspaceId: (body.workspaceId as string).trim() || null } : {}) };
}
