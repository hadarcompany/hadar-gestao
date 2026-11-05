import type { AuthUser } from "@/types/auth";
import { canView, MODULE_KEYS, type ModuleKey } from "./permissions";

type PageUser = Pick<AuthUser, "role" | "permissions">;
const pageModules = [
  ["/dashboard", "dashboard"], ["/meu-trabalho", "meu-trabalho"],
  ["/tarefas", "tarefas"], ["/calendario", "calendario"],
  ["/clientes", "clientes"], ["/servicos", "servicos"], ["/nps", "nps"],
  ["/minha-semana", "minha-semana"], ["/metas", "metas"],
  ["/pipeline", "pipeline"], ["/whatsapp", "pipeline"],
  ["/meta-ads", "meta-ads"], ["/publicacoes", "publicacoes"],
  ["/financeiro", "financeiro"],
] as const;
const within = (path: string, root: string) => path === root || path.startsWith(root + "/");
const view = (user: PageUser, module: typeof pageModules[number][1]) => MODULE_KEYS.includes(module as ModuleKey) && canView(user as AuthUser, module as ModuleKey);

export function homeForUser(user: PageUser): string {
  return pageModules.find(([, module]) => view(user, module))?.[0] ?? "/configuracoes";
}

/** UX routing only; every API still checks the current DB permissions itself. */
export function canVisitPage(user: PageUser, pathname: string): boolean {
  if (within(pathname, "/configuracoes")) return true;
  if (within(pathname, "/equipe")) return user.role === "ADMIN";
  if (within(pathname, "/projetos") || within(pathname, "/onboarding")) return view(user, "tarefas") || view(user, "clientes");
  if (within(pathname, "/tarefas-concluidas")) return view(user, "tarefas") || view(user, "meu-trabalho") || view(user, "calendario");
  const page = pageModules.find(([path]) => within(pathname, path));
  return page ? view(user, page[1]) : true;
}
