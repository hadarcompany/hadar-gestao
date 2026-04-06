import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.permissions !== undefined) data.permissions = body.permissions;
  if (body.role !== undefined) data.role = body.role;

  const user = await prisma.user.update({
    where: { id: params.id },
    data,
    select: { id: true, name: true, email: true, role: true, permissions: true },
  });

  // Sync role/permissions to Supabase Auth metadata
  try {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const admin = createSupabaseAdminClient();
    const { data: authUsers } = await admin.auth.admin.listUsers();
    const authUser = authUsers?.users.find((u) => u.email === user.email);
    if (authUser) {
      await admin.auth.admin.updateUserById(authUser.id, {
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
