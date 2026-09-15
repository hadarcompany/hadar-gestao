import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email e senha são obrigatórios" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  // Busca o usuário no Prisma para obter role/permissions
  const prismaUser = await prisma.user.findUnique({ where: { email } });

  // Busca o usuário no Supabase Auth
  const { data: authList } = await admin.auth.admin.listUsers();
  const authUser = authList?.users.find((u) => u.email === email);

  const supabase = await createSupabaseServerClient();

  // Se o usuário existe no Supabase Auth, tenta login direto
  if (authUser) {
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!signInError && data.session) {
      // Sempre sincroniza role/permissions do Prisma para garantir metadados corretos
      if (prismaUser) {
        await admin.auth.admin.updateUserById(authUser.id, {
          user_metadata: { name: prismaUser.name },
          app_metadata: {
            prisma_id: prismaUser.id,
            role: prismaUser.role,
            permissions: prismaUser.permissions,
          },
        });

        // Re-login para obter sessão com metadados atualizados
        await supabase.auth.signOut();
        const { error: reLoginError } = await supabase.auth.signInWithPassword({ email, password });
        if (reLoginError) {
          return NextResponse.json({ error: "Erro ao atualizar sessão" }, { status: 500 });
        }
      }
      return NextResponse.json({ ok: true });
    }
  }

  // Supabase Auth falhou ou usuário não existe — tenta via Prisma/bcrypt
  if (!prismaUser) {
    return NextResponse.json({ error: "Email ou senha incorretos" }, { status: 401 });
  }

  const isValid = await bcrypt.compare(password, prismaUser.password);
  if (!isValid) {
    return NextResponse.json({ error: "Email ou senha incorretos" }, { status: 401 });
  }

  // Cria ou atualiza o usuário no Supabase Auth com metadados corretos
  if (authUser) {
    await admin.auth.admin.updateUserById(authUser.id, {
      password,
      user_metadata: { name: prismaUser.name },
      app_metadata: {
        prisma_id: prismaUser.id,
        role: prismaUser.role,
        permissions: prismaUser.permissions,
      },
    });
  } else {
    await admin.auth.admin.createUser({
      email: prismaUser.email,
      password,
      email_confirm: true,
      user_metadata: { name: prismaUser.name },
      app_metadata: {
        prisma_id: prismaUser.id,
        role: prismaUser.role,
        permissions: prismaUser.permissions,
      },
    });
  }

  // Login com os metadados já definidos
  const { error: finalError } = await supabase.auth.signInWithPassword({ email, password });

  if (finalError) {
    return NextResponse.json({ error: "Erro interno ao autenticar" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
