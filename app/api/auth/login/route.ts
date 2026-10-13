import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { validMutationOrigin } from "@/lib/api-policy";
import { allowLoginAttempt, parseLogin } from "@/lib/login-security";

export async function POST(req: NextRequest) {
  if (!validMutationOrigin(req)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  const credentials = parseLogin(await req.json().catch(() => null));
  if (!credentials) return NextResponse.json({ error: "Informe e-mail e senha válidos." }, { status: 400 });
  if (!allowLoginAttempt(credentials.email)) {
    return NextResponse.json({ error: "Muitas tentativas. Tente novamente mais tarde." }, { status: 429, headers: { "Retry-After": "900" } });
  }
  const supabase = await createSupabaseServerClient();
  // Auth is the only password authority. Never reset its password from a legacy hash.
  const { data, error } = await supabase.auth.signInWithPassword(credentials);
  if (error || !data.user || !data.session) return NextResponse.json({ error: "Email ou senha incorretos" }, { status: 401 });
  const account = await prisma.user.findFirst({
    where: { email: { equals: data.user.email ?? credentials.email, mode: "insensitive" } }, select: { id: true },
  });
  if (!account) {
    await supabase.auth.signOut();
    return NextResponse.json({ error: "Email ou senha incorretos" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
