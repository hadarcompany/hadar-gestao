import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.goal.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
