import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";

const HEX = /^#[0-9a-f]{6}$/i;

/** Só nome e cor mudam: o id da área é o código gravado nas tarefas. */
export async function PATCH(req: NextRequest, { params: routeParams }: { params: Promise<{ id: string }> }) {
  const params = await routeParams;
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const data: { name?: string; color?: string } = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 40);
  if (typeof body.color === "string" && HEX.test(body.color)) data.color = body.color;
  if (!data.name && !data.color) return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });

  const area = await prisma.taskArea.update({ where: { id: params.id }, data });
  return NextResponse.json(area);
}
