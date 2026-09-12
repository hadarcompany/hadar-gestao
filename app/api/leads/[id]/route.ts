import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";

const OWNER_SELECT = { select: { id: true, name: true, image: true } };
const CLOSED_STAGES = ["FECHADO", "PERDIDO"];

export async function PATCH(req: NextRequest, { params: routeParams }: { params: Promise<{ id: string }> }) {
  const params = await routeParams;
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const current = await prisma.lead.findUnique({ where: { id: params.id }, select: { stage: true } });
  if (!current) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};

  for (const field of ["name", "company", "email", "phone", "origin", "product", "notes", "lostReason", "ownerId"]) {
    if (body[field] !== undefined) data[field] = body[field] || null;
  }
  if (body.value !== undefined) data.value = body.value === "" || body.value === null ? null : Number(body.value);

  // Mudar de etapa reinicia o relógio do funil e define/limpa a data de encerramento.
  if (body.stage !== undefined && body.stage !== current.stage) {
    data.stage = body.stage;
    data.stageChangedAt = new Date();
    data.closedAt = CLOSED_STAGES.includes(body.stage) ? new Date() : null;
    if (body.stage !== "PERDIDO" && body.lostReason === undefined) data.lostReason = null;
  }

  const lead = await prisma.lead.update({
    where: { id: params.id },
    data,
    include: { owner: OWNER_SELECT },
  });

  return NextResponse.json(lead);
}

export async function DELETE(_req: NextRequest, { params: routeParams }: { params: Promise<{ id: string }> }) {
  const params = await routeParams;
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.lead.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
