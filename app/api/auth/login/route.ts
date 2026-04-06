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

  const supabase = await createSupabaseServerClient();

  // Tenta login direto no Supabase Auth primeiro
  const { data, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (!signInError && data.session) {
    return NextResponse.json({ ok: true });
  }

  // Migração transparente: verifica senha antiga via Prisma/bcrypt
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return NextResponse.json({ error: "Email ou senha incorretos" }, { status: 401 });
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return NextResponse.json({ error: "Email ou senha incorretos" }, { status: 401 });
  }

  // Credenciais válidas — cria/atualiza usuário no Supabase Auth
  const admin = createSupabaseAdminClient();

  const { data: existing } = await admin.auth.admin.listUsers();
  const existingUser = existing?.users.find((u) => u.email === email);

  if (existingUser) {
    await admin.auth.admin.updateUserById(existingUser.id, {
      password,
      user_metadata: { name: user.name },
      app_metadata: {
        prisma_id: user.id,
        role: user.role,
        permissions: user.permissions,
      },
    });
  } else {
    await admin.auth.admin.createUser({
      email: user.email,
      password,
      email_confirm: true,
      user_metadata: { name: user.name },
      app_metadata: {
        prisma_id: user.id,
        role: user.role,
        permissions: user.permissions,
      },
    });
  }

  // Agora faz login via Supabase Auth
  const { error: finalError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (finalError) {
    return NextResponse.json({ error: "Erro interno ao autenticar" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
