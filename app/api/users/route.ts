import { NextRequest } from "next/server";
import { guardApiRequest } from "@/lib/api-guard";
import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { withMedia } from "@/lib/media";
import { isAdmin } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseTeamMember } from "@/lib/team-member-input";
import { provisionTeamMember, TeamMemberError } from "@/lib/team-member-provisioning";

export async function GET(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await guardApiRequest(auth, req, "/api/users");
  if (denied) return denied;

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, permissions: true },
    orderBy: { name: "asc" },
  });

  // Membros não veem o mapa de permissões de outros usuários — apenas o próprio e admins veem tudo.
  const admin = isAdmin(auth);
  const sanitized = users.map((u) => (admin || u.id === auth.id ? u : { ...u, permissions: null }));

  return NextResponse.json(await withMedia(sanitized, "user"));
}

export async function POST(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await guardApiRequest(auth, req, "/api/users");
  if (denied) return denied;
  if (!isAdmin(auth)) return NextResponse.json({ error: "Somente administradores podem cadastrar usuários." }, { status: 403 });
  let input;
  try { input = parseTeamMember(await req.json().catch(() => null)); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
  try {
    const user = await provisionTeamMember(input, prisma, createSupabaseAdminClient());
    return NextResponse.json({ ...user, image: null }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof TeamMemberError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Não foi possível cadastrar o usuário. Atualize a lista e tente novamente." }, { status: 503 });
  }
}
