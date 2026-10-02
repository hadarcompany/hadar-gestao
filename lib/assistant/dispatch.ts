import { NextRequest } from "next/server";
import { canView } from "@/lib/permissions";
import type { AuthUser } from "@/types/auth";
import { RESOURCES, type ActionDefinition } from "./catalog";
import { AssistantError } from "./types";
import { listResult, sanitizeAssistantData } from "./data";

// Chamadas locais aos handlers existentes, sem HTTP externo, URL arbitrária ou SQL gerado por IA.
const LOADERS = {
  "/api/tasks": () => import("@/app/api/tasks/route"),
  "/api/tasks/[id]": () => import("@/app/api/tasks/[id]/route"),
  "/api/tasks/[id]/transfer": () => import("@/app/api/tasks/[id]/transfer/route"),
  "/api/clients": () => import("@/app/api/clients/route"),
  "/api/clients/[id]": () => import("@/app/api/clients/[id]/route"),
  "/api/projects": () => import("@/app/api/projects/route"),
  "/api/projects/[id]": () => import("@/app/api/projects/[id]/route"),
  "/api/leads": () => import("@/app/api/leads/route"),
  "/api/leads/[id]": () => import("@/app/api/leads/[id]/route"),
  "/api/goals": () => import("@/app/api/goals/route"),
  "/api/goals/[id]": () => import("@/app/api/goals/[id]/route"),
  "/api/services": () => import("@/app/api/services/route"),
  "/api/services/[id]": () => import("@/app/api/services/[id]/route"),
  "/api/users": () => import("@/app/api/users/route"),
  "/api/areas": () => import("@/app/api/areas/route"),
  "/api/labels": () => import("@/app/api/labels/route"),
  "/api/calendar": () => import("@/app/api/calendar/route"),
  "/api/financeiro/fixed-expenses": () => import("@/app/api/financeiro/fixed-expenses/route"),
  "/api/financeiro/variable-expenses": () => import("@/app/api/financeiro/variable-expenses/route"),
  "/api/financeiro/credit-cards": () => import("@/app/api/financeiro/credit-cards/route"),
  "/api/financeiro/receivables": () => import("@/app/api/financeiro/receivables/route"),
  "/api/financeiro/summary": () => import("@/app/api/financeiro/summary/route"),
} as const;

async function dispatch(path: string, method: string, body: Record<string, unknown>, query: Record<string, string>, recordId?: string) {
  const loader = LOADERS[path as keyof typeof LOADERS];
  if (!loader) throw new AssistantError("Operação indisponível.");
  type Handler = (req: NextRequest, context: { params: Promise<{ id: string }> }) => Promise<Response>;
  const handlers = await loader() as unknown as Record<string, Handler>;
  const handler = handlers[method];
  if (!handler) throw new AssistantError("Operação indisponível.");
  const url = new URL(path.replace("[id]", recordId || ""), "http://assistant.internal");
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  const request = new NextRequest(url, { method, ...(method === "GET" || method === "DELETE" ? {} : { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }) });
  // getServerAuth dentro dos handlers usa os cookies do contexto da requisição original.
  const response = await handler(request, { params: Promise.resolve({ id: recordId || "" }) });
  const data = await response.json();
  if (!response.ok) throw new AssistantError(typeof data.error === "string" ? data.error : "Não foi possível executar a ação.", response.status);
  return data;
}

export async function queryAssistantData(auth: AuthUser, raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new AssistantError("Consulta inválida.");
  const input = raw as Record<string, unknown>;
  if (Object.keys(input).some((key) => !["recurso", "busca", "filtros", "offset"].includes(key))) throw new AssistantError("Campo de consulta não permitido.");
  const resource = typeof input.recurso === "string" && Object.hasOwn(RESOURCES, input.recurso) ? RESOURCES[input.recurso] : null;
  if (!resource || !canView(auth, resource.module)) throw new AssistantError("Consulta indisponível ou sem permissão.", 403);
  if (input.busca !== undefined && (typeof input.busca !== "string" || input.busca.length > 200)) throw new AssistantError("Busca inválida.");
  const offset = input.offset ?? 0;
  if (typeof offset !== "number" || !Number.isInteger(offset) || offset < 0 || offset > 10000) throw new AssistantError("Página inválida.");
  const query: Record<string, string> = {};
  if (input.filtros !== undefined) {
    if (!input.filtros || typeof input.filtros !== "object" || Array.isArray(input.filtros)) throw new AssistantError("Filtros inválidos.");
    for (const [key, value] of Object.entries(input.filtros)) {
      if (!resource.query.includes(key) || typeof value !== "string" || value.length > 100) throw new AssistantError(`Filtro inválido: ${key}.`);
      if (/Month$|^month$/.test(key) && (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 12)) throw new AssistantError("Mês inválido.");
      if (/Year$|^year$/.test(key) && (!/^\d+$/.test(value) || Number(value) < 2000 || Number(value) > 2200)) throw new AssistantError("Ano inválido.");
      if (key === "count" && (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 6)) throw new AssistantError("Quantidade de semanas inválida.");
      query[key] = value;
    }
  }
  if (input.recurso === "resumo_financeiro") {
    const current = new Date();
    const start = Number(query.startYear || current.getFullYear()) * 12 + Number(query.startMonth || current.getMonth() + 1);
    const end = Number(query.endYear || query.startYear || current.getFullYear()) * 12 + Number(query.endMonth || query.startMonth || current.getMonth() + 1);
    if (end < start || end - start > 23) throw new AssistantError("Consulte um período de até 24 meses.");
  }
  if (resource.path === "/api/projects") query.summary = "1";
  const data = await dispatch(resource.path, "GET", {}, query);
  if (input.recurso === "servicos" && Array.isArray(data.services)) return { ...listResult(data.services, input.busca as string, offset), resumo: sanitizeAssistantData(data.asaasSummary) };
  return listResult(data, input.busca as string, offset);
}

export async function dispatchAssistantAction(action: ActionDefinition, input: Record<string, unknown>) {
  const body = { ...input };
  const recordId = typeof input.id === "string" ? input.id : undefined;
  let path = action.path;
  const query: Record<string, string> = {};
  if (action.idLocation === "path") {
    path += "/[id]";
    if (action.name === "transferir_tarefa") path += "/transfer";
    delete body.id;
  }
  if (action.idLocation === "query") query.id = recordId!;
  return sanitizeAssistantData(await dispatch(path, action.method, body, query, recordId));
}
