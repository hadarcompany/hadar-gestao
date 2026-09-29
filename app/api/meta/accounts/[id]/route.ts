import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { isAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(auth)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const clientId = typeof body.clientId === "string" && body.clientId ? body.clientId : null;
  if (clientId && !await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } })) {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }
  const account = await prisma.metaAdAccount.update({
    where: { id },
    data: { clientId },
    include: { client: { select: { id: true, name: true } } },
  }).catch(() => null);
  if (!account) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
  return NextResponse.json(account);
}
