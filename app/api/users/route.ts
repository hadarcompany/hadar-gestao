import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { withMedia } from "@/lib/media";
import { isAdmin } from "@/lib/permissions";

export async function GET() {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, permissions: true },
    orderBy: { name: "asc" },
  });

  // Membros não veem o mapa de permissões de outros usuários — apenas o próprio e admins veem tudo.
  const admin = isAdmin(auth);
  const sanitized = users.map((u) => (admin || u.id === auth.id ? u : { ...u, permissions: null }));

  return NextResponse.json(await withMedia(sanitized, "user"));
}
