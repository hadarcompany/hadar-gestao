import { guardApiRequest } from "@/lib/api-guard";
import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { withMedia } from "@/lib/media";
import { isAdmin, MODULE_KEYS } from "@/lib/permissions";
import { createSupabaseAdminClient, findSupabaseAuthUserByEmail } from "@/lib/supabase/admin";
import bcrypt from "bcryptjs";

export async function PATCH(req: NextRequest, { params: routeParams }: { params: Promise<{ id: string }> }) {
  const params = await routeParams;
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await guardApiRequest(auth, req, "/api/users/[id]");
  if (denied) return denied;

  const body = await req.json();
  if (body.role !== undefined && !["ADMIN", "MEMBER"].includes(body.role)) return NextResponse.json({ error: "Cargo inválido." }, { status: 400 });
  if (body.permissions !== undefined && (body.permissions === null || typeof body.permissions !== "object" || Array.isArray(body.permissions) || Object.entries(body.permissions).some(([key, level]) => !MODULE_KEYS.includes(key as typeof MODULE_KEYS[number]) || !["none", "view", "edit"].includes(String(level))))) {
    return NextResponse.json({ error: "Permissões inválidas." }, { status: 400 });
  }
  if (body.password !== undefined && (typeof body.password !== "string" || body.password.length < 12 || body.password.length > 1024)) return NextResponse.json({ error: "Use uma senha de pelo menos 12 caracteres." }, { status: 400 });
  if (body.image !== undefined && body.image !== null && (typeof body.image !== "string" || !/^data:image\/(png|jpeg|gif|webp);base64,/.test(body.image) || body.image.length > 3 * 1024 * 1024)) return NextResponse.json({ error: "Imagem inválida ou muito grande." }, { status: 400 });
  const isSelf = auth.id === params.id;
  const admin = isAdmin(auth);

  const wantsPrivilegeChange = body.role !== undefined || body.permissions !== undefined;

  if (wantsPrivilegeChange) {
    // Só administradores alteram cargo/permissões — e nunca as próprias, para não haver auto-promoção.
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (isSelf) {
      return NextResponse.json({ error: "Você não pode alterar seu próprio cargo ou permissões" }, { status: 403 });
    }
  } else if (!admin && !isSelf) {
    // Sem mudança de privilégio: só o próprio usuário (dados pessoais) ou um admin podem editar.
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data: Record<string, unknown> = {};
  if (body.permissions !== undefined) data.permissions = body.permissions;
  if (body.role !== undefined) data.role = body.role;
  if (body.name !== undefined) data.name = body.name;
  // Só aceita imagem nova (data URL) ou remoção: o link devolvido pela API nunca volta para o banco.
  if (body.image === null || (typeof body.image === "string" && body.image.startsWith("data:image/"))) data.image = body.image;

  let plainPassword: string | undefined;
  if (body.password) {
    plainPassword = body.password;
    const target = await prisma.user.findUnique({ where: { id: params.id }, select: { email: true } });
    if (!target) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    try {
      const authUser = await findSupabaseAuthUserByEmail(target.email);
      if (!authUser) return NextResponse.json({ error: "Conta de autenticação não encontrada." }, { status: 409 });
      const { error } = await createSupabaseAdminClient().auth.admin.updateUserById(authUser.id, { password: plainPassword });
      if (error) return NextResponse.json({ error: "Não foi possível alterar a senha." }, { status: 503 });
    } catch { return NextResponse.json({ error: "Não foi possível alterar a senha." }, { status: 503 }); }
    data.password = await bcrypt.hash(body.password, 10);
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data,
    select: { id: true, name: true, email: true, role: true, permissions: true },
  });

  // Sincroniza com Supabase Auth (metadados e, se alterada, a senha)
  try {
    const supabaseAdmin = createSupabaseAdminClient();
    const authUser = await findSupabaseAuthUserByEmail(user.email);
    if (authUser) {
      await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
        user_metadata: { name: user.name },
        app_metadata: {
          prisma_id: user.id,
          role: user.role,
          permissions: user.permissions,
        },
      });
    }
  } catch (e) {
    console.error("Falha ao sincronizar metadata Supabase:", e);
  }

  return NextResponse.json(await withMedia(user, "user"));
}
