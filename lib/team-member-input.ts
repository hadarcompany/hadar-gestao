import { MODULE_KEYS, type ModuleKey, type PermissionLevel } from "./permissions";

export type NewTeamMember = { name: string; email: string; password: string; permissions: Record<ModuleKey, PermissionLevel> };

export function parseTeamMember(body: unknown): NewTeamMember {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Informe os dados do novo usuário.");
  const input = body as Record<string, unknown>;
  const name = typeof input.name === "string" ? input.name.trim().normalize("NFC") : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (!name || name.length > 120 || /[\u0000-\u001f\u007f]/.test(name)) throw new Error("Informe um nome de até 120 caracteres.");
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Informe um e-mail válido.");
  if (typeof input.password !== "string" || input.password.length < 12 || new TextEncoder().encode(input.password).length > 72) throw new Error("Use uma senha de pelo menos 12 caracteres. Senhas muito longas precisam ser reduzidas.");
  if (input.role !== undefined && input.role !== "MEMBER") throw new Error("O novo usuário deve ser cadastrado como membro da equipe.");
  const levels = input.permissions;
  if (!levels || typeof levels !== "object" || Array.isArray(levels) || Object.entries(levels).some(([key, value]) => !MODULE_KEYS.includes(key as ModuleKey) || !["none", "view", "edit"].includes(value as string))) throw new Error("Selecione permissões válidas para os módulos.");
  const permissions = Object.fromEntries(MODULE_KEYS.map(key => [key, (levels as Record<string, PermissionLevel>)[key] ?? "none"])) as Record<ModuleKey, PermissionLevel>;
  return { name, email, password: input.password, permissions };
}
