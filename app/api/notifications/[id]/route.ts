import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params: routeParams }: { params: Promise<{ id: string }> }) {
  const params = await routeParams;
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.notification.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== auth.id) {
    return NextResponse.json({ error: "Notificação não encontrada" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const notification = await prisma.notification.update({
    where: { id: params.id },
    data: { read: body.read !== undefined ? !!body.read : true },
  });

  return NextResponse.json(notification);
}
