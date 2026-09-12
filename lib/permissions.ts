import type { AuthUser } from "@/types/auth";

export type PermissionLevel = "none" | "view" | "edit";

export const MODULE_KEYS = [
  "dashboard", "tarefas", "meu-trabalho", "calendario", "clientes",
  "servicos", "nps", "financeiro", "minha-semana", "metas", "acessos", "pipeline",
] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export function isAdmin(auth: Pick<AuthUser, "role">): boolean {
  return auth.role === "ADMIN";
}

export function getPermissionLevel(auth: AuthUser, moduleKey: ModuleKey): PermissionLevel {
  if (isAdmin(auth)) return "edit";
  const level = auth.permissions?.[moduleKey];
  return level === "view" || level === "edit" ? level : "none";
}

export function canView(auth: AuthUser, moduleKey: ModuleKey): boolean {
  return getPermissionLevel(auth, moduleKey) !== "none";
}

export function canEdit(auth: AuthUser, moduleKey: ModuleKey): boolean {
  return getPermissionLevel(auth, moduleKey) === "edit";
}

/** Migra as chaves de permissão antigas ("calendario" + "calendario-clientes") para a
 * chave única do novo calendário unificado, preservando o nível mais permissivo. */
export function migratePermissions(permissions: Record<string, string> | null | undefined): Record<string, string> | null {
  if (!permissions) return permissions ?? null;
  const rank: Record<string, number> = { none: 0, view: 1, edit: 2 };
  const a = permissions["calendario"];
  const b = permissions["calendario-clientes"];
  if (a === undefined && b === undefined) return permissions;
  const merged = (rank[b ?? "none"] ?? 0) > (rank[a ?? "none"] ?? 0) ? b : a;
  const next: Record<string, string> = { ...permissions, calendario: merged ?? "none" };
  delete next["calendario-clientes"];
  return next;
}
