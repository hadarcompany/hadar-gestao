import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";

const HEX = /^#[0-9a-f]{6}$/i;

export async function PATCH(req: NextRequest, { params: routeParams }: { params: Promise<{ id: string }> }) {
  const params = await routeParams;
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const data: { name?: string; color?: string } = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 40);
  if (typeof body.color === "string" && HEX.test(body.color)) data.color = body.color;

  const label = await prisma.taskLabel.update({ where: { id: params.id }, data });
  return NextResponse.json(label);
}

/** Exclui a etiqueta e a retira de todas as tarefas que a usavam. */
export async function DELETE(_req: NextRequest, { params: routeParams }: { params: Promise<{ id: string }> }) {
  const params = await routeParams;
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.$transaction([
    prisma.$executeRaw`UPDATE "tasks" SET "labelIds" = array_remove("labelIds", ${params.id}) WHERE ${params.id} = ANY("labelIds")`,
    prisma.taskLabel.delete({ where: { id: params.id } }),
  ]);
  return NextResponse.json({ ok: true });
}
