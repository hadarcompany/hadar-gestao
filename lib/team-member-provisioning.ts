import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findSupabaseAuthUserByEmail } from "./supabase/admin";
import type { NewTeamMember } from "./team-member-input";

export class TeamMemberError extends Error {
  constructor(message: string, public status = 503) { super(message); }
}

const fields = { id: true, name: true, email: true, role: true, permissions: true } as const;
const conflict = () => new TeamMemberError("Este e-mail já possui uma conta. Atualize a lista de usuários; contas existentes não são alteradas por este cadastro.", 409);
const unavailable = () => new TeamMemberError("Não foi possível concluir o cadastro. Atualize a lista antes de tentar novamente. Se o usuário não aparecer e o erro continuar, entre em contato com a Hadar.");

/** Auth and application records must both exist before the user can access the app. */
export async function provisionTeamMember(input: NewTeamMember, db: PrismaClient, supabase: SupabaseClient) {
  try {
    const existing = await db.user.findFirst({ where: { email: { equals: input.email, mode: "insensitive" } }, select: { id: true } });
    if (existing || await findSupabaseAuthUserByEmail(input.email, supabase)) throw conflict();
  } catch (error) { if (error instanceof TeamMemberError) throw error; throw unavailable(); }

  const id = randomUUID();
  const password = await bcrypt.hash(input.password, 10);
  let identity;
  try {
    identity = await supabase.auth.admin.createUser({
      email: input.email, password: input.password, email_confirm: true,
      user_metadata: { name: input.name },
      app_metadata: { prisma_id: id, role: "MEMBER", permissions: input.permissions },
    });
  } catch { throw unavailable(); }
  if (identity.error) {
    if (["email_exists", "user_already_exists"].includes(identity.error.code ?? "")) throw conflict();
    if (identity.error.code === "weak_password") throw new TeamMemberError("A senha não atende aos requisitos. Escolha uma senha mais forte.", 400);
    throw unavailable();
  }
  if (!identity.data.user?.id) throw unavailable();
  const authId = identity.data.user.id;
  try {
    return await db.user.create({ data: { id, name: input.name, email: input.email, password, role: "MEMBER", permissions: input.permissions }, select: fields });
  } catch (error) {
    // A lost DB acknowledgement can follow a successful commit. Never delete that login.
    let committed;
    try { committed = await db.user.findUnique({ where: { id }, select: fields }); }
    catch { throw unavailable(); }
    if (committed) return committed;
    // Compensate only the brand-new identity returned by this request, never an existing account.
    try {
      const cleanup = await supabase.auth.admin.deleteUser(authId);
      if (cleanup.error) throw unavailable();
    } catch { throw unavailable(); }
    if ((error as { code?: string })?.code === "P2002") throw conflict();
    throw unavailable();
  }
}
