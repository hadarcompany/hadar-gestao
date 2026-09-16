import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/permissions";

export async function PATCH(req: NextRequest, { params: routeParams }: { params: Promise<{ id: string }> }) {
  const params = await routeParams;
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.goal.findUnique({ where: { id: params.id }, select: { type: true } });
  if (existing?.type === "REVENUE" && !canEdit(auth, "financeiro")) return NextResponse.json({ error: "Sem acesso a metas financeiras." }, { status: 403 });

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.title) data.title = body.title;
  if (body.targetValue) data.targetValue = parseFloat(body.targetValue);
  if (body.customValue !== undefined) data.customValue = body.customValue ? parseFloat(body.customValue) : null;
  if (body.status) data.status = body.status;

  const goal = await prisma.goal.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json(goal);
}

export async function DELETE(_req: NextRequest, { params: routeParams }: { params: Promise<{ id: string }> }) {
  const params = await routeParams;
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const existing = await prisma.goal.findUnique({ where: { id: params.id }, select: { type: true } });
  if (existing?.type === "REVENUE" && !canEdit(auth, "financeiro")) return NextResponse.json({ error: "Sem acesso a metas financeiras." }, { status: 403 });

  await prisma.goal.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
