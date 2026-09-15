import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { withMedia } from "@/lib/media";
import { PROJECT_INCLUDE, PROJECT_STATUS_VALUES } from "@/lib/projects-server";

export async function PATCH(req: NextRequest, { params: routeParams }: { params: Promise<{ id: string }> }) {
  const params = await routeParams;
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "Dê um nome ao projeto" }, { status: 400 });
    data.name = name;
  }
  if (body.description !== undefined) data.description = body.description || null;
  if (body.clientId !== undefined) data.clientId = body.clientId || null;
  if (body.color !== undefined) data.color = body.color || null;
  if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  if (body.status !== undefined && PROJECT_STATUS_VALUES.includes(body.status)) data.status = body.status;

  const project = await prisma.project.update({
    where: { id: params.id },
    data,
    include: PROJECT_INCLUDE,
  });

  return NextResponse.json(await withMedia(project));
}

/** Exclui só o projeto: as tarefas continuam existindo, apenas sem projeto. */
export async function DELETE(_req: NextRequest, { params: routeParams }: { params: Promise<{ id: string }> }) {
  const params = await routeParams;
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.project.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
