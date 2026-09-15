import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";

export async function DELETE(_req: NextRequest, { params: routeParams }: { params: Promise<{ id: string; updateId: string }> }) {
  const params = await routeParams;
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const update = await prisma.taskUpdate.findUnique({ where: { id: params.updateId } });
  if (!update || update.taskId !== params.id) {
    return NextResponse.json({ error: "Atualização não encontrada" }, { status: 404 });
  }
  if (update.authorId !== auth.id && !isAdmin(auth)) {
    return NextResponse.json({ error: "Só quem escreveu (ou um administrador) pode excluir" }, { status: 403 });
  }

  await prisma.taskUpdate.delete({ where: { id: params.updateId } });
  return NextResponse.json({ ok: true });
}
