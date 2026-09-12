import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import bcrypt from "bcryptjs";

export async function PATCH(req: NextRequest, { params: routeParams }: { params: Promise<{ id: string }> }) {
  const params = await routeParams;
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
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
  if (body.image !== undefined) data.image = body.image;

  let plainPassword: string | undefined;
  if (body.password) {
    plainPassword = body.password;
    data.password = await bcrypt.hash(body.password, 10);
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data,
    select: { id: true, name: true, email: true, role: true, image: true, permissions: true },
  });

  // Sincroniza com Supabase Auth (metadados e, se alterada, a senha)
  try {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const supabaseAdmin = createSupabaseAdminClient();
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
    const authUser = authUsers?.users.find((u) => u.email === user.email);
    if (authUser) {
      await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
        ...(plainPassword ? { password: plainPassword } : {}),
        user_metadata: { name: user.name, image: user.image },
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

  return NextResponse.json(user);
}
