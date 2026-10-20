import type { AuthUser } from "@/types/auth";
import { canEdit, canView, isAdmin, type ModuleKey } from "./permissions";
import { publicOrigin } from "./public-url";

const TASK_READ: ModuleKey[] = ["tarefas", "meu-trabalho", "calendario"];
const TASK_EDIT: ModuleKey[] = ["tarefas", "meu-trabalho"];
export const CLIENT_LOOKUP: ModuleKey[] = ["tarefas", "meu-trabalho", "calendario", "servicos", "nps", "financeiro", "metas", "meta-ads", "publicacoes"];

export function hasGlobalTaskAccess(auth: AuthUser, write = false) {
  return write ? canEdit(auth, "tarefas") : canView(auth, "tarefas") || canView(auth, "calendario");
}

/** Deny unknown routes; callers must still enforce record ownership. */
export function canAccessApi(auth: AuthUser, route: string, method: string, search = new URLSearchParams()) {
  const read = method === "GET" || method === "HEAD";
  if (route.startsWith("/api/accesses")) return false;
  const module = (key: ModuleKey) => read ? canView(auth, key) : canEdit(auth, key);
  const any = (keys: ModuleKey[]) => keys.some(module);
  if (route.startsWith("/api/tasks")) return any(read ? TASK_READ : TASK_EDIT);
  if (route === "/api/clients") return module("clientes") || (read && any(CLIENT_LOOKUP));
  if (route.endsWith("/logo") && route.startsWith("/api/clients/")) return module("clientes") || (read && any(CLIENT_LOOKUP));
  if (route.startsWith("/api/clients/")) return module("clientes");
  if (route === "/api/projects" && read && search.get("summary") === "1") return any(TASK_READ) || module("clientes");
  if (route.startsWith("/api/projects")) return module("tarefas") || module("clientes");
  if (route.startsWith("/api/areas") || route.startsWith("/api/labels")) return read || isAdmin(auth);
  if (route.startsWith("/api/calendar") || route.startsWith("/api/content-calendar")) return module("calendario");
  if (route.startsWith("/api/weekly-reviews")) return module("minha-semana");
  if (route.startsWith("/api/nps")) return module("nps");
  if (route.startsWith("/api/services")) return module("servicos");
  if (route.startsWith("/api/goals")) return module("metas");
  if (route.startsWith("/api/financeiro") || route.startsWith("/api/asaas")) return module("financeiro");
  if (route.startsWith("/api/leads") || route.startsWith("/api/whatsapp")) return module("pipeline");
  if (route.startsWith("/api/dashboard")) return module("dashboard");
  if (route.startsWith("/api/integrations")) return isAdmin(auth);
  if (route.startsWith("/api/social/")) {
    if (/\/(connect|callback|accounts|selection|setup)/.test(route)) return isAdmin(auth);
    return module("publicacoes");
  }
  if (route.startsWith("/api/meta")) {
    if (/\/(connect|callback)$/.test(route) || !read) return isAdmin(auth);
    return module("meta-ads");
  }
  // Profile/notifications enforce self-only changes in their handlers.
  if (route.startsWith("/api/users") || route.startsWith("/api/notifications") || route.startsWith("/api/images/convert")) return true;
  // Assistant validates every tool's module, inputs and confirmation separately.
  if (route.startsWith("/api/assistant")) return true;
  return false;
}

export function validMutationOrigin(request: Request, configuredUrl = process.env.APP_URL) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  try { return !origin || origin === publicOrigin(request.url, configuredUrl); }
  catch { return false; }
}
