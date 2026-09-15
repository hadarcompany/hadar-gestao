import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { withMedia } from "@/lib/media";
import { createClientOnboarding } from "@/lib/onboarding";
import { PROJECT_INCLUDE, PROJECT_STATUS_VALUES } from "@/lib/projects-server";

export async function GET(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind");
  const where = kind ? { kind } : {};

  // Lista leve para selects (criar/editar tarefa).
  if (searchParams.get("summary") === "1") {
    const projects = await prisma.project.findMany({
      where,
      select: { id: true, name: true, kind: true, status: true, clientId: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(projects);
  }

  const projects = await prisma.project.findMany({
    where,
    include: PROJECT_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(await withMedia(projects));
}

export async function POST(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  if (body.kind === "ONBOARDING") {
    const client = body.clientId
      ? await prisma.client.findUnique({ where: { id: body.clientId }, select: { id: true, name: true } })
      : null;
    if (!client) return NextResponse.json({ error: "Selecione o cliente do onboarding" }, { status: 400 });
    const id = await createClientOnboarding(client, auth.id);
    const project = await prisma.project.findUnique({ where: { id }, include: PROJECT_INCLUDE });
    return NextResponse.json(await withMedia(project), { status: 201 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Dê um nome ao projeto" }, { status: 400 });

  const project = await prisma.project.create({
    data: {
      name,
      kind: "GERAL",
      description: body.description || null,
      clientId: body.clientId || null,
      status: PROJECT_STATUS_VALUES.includes(body.status) ? body.status : "EM_ANDAMENTO",
      color: body.color || null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      createdById: auth.id,
    },
    include: PROJECT_INCLUDE,
  });

  return NextResponse.json(await withMedia(project), { status: 201 });
}
