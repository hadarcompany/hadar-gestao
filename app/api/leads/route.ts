import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { withMedia } from "@/lib/media";
import { canEdit, canView } from "@/lib/permissions";

const OWNER_SELECT = { select: { id: true, name: true } };

export async function GET(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const financialVisible = canView(auth, "financeiro");

  const { searchParams } = new URL(req.url);
  const stage = searchParams.get("stage");
  const ownerId = searchParams.get("ownerId");

  const where: Record<string, unknown> = {};
  if (stage) where.stage = stage;
  if (ownerId) where.ownerId = ownerId;

  const leads = await prisma.lead.findMany({
    where,
    include: { owner: OWNER_SELECT },
    orderBy: [{ stageChangedAt: "desc" }],
  });

  return NextResponse.json(await withMedia(financialVisible ? leads : leads.map((lead) => ({ ...lead, value: null }))));
}

export async function POST(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const canManageFinance = canEdit(auth, "financeiro");

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Nome do lead é obrigatório" }, { status: 400 });

  const stage = body.stage || "NOVO";
  const closed = stage === "FECHADO" || stage === "PERDIDO";

  const lead = await prisma.lead.create({
    data: {
      name,
      company: body.company || null,
      email: body.email || null,
      phone: body.phone || null,
      origin: body.origin || null,
      product: body.product || null,
      stage,
      value: canManageFinance && body.value !== "" && body.value != null ? Number(body.value) : null,
      notes: body.notes || null,
      lostReason: body.lostReason || null,
      ownerId: body.ownerId || auth.id,
      closedAt: closed ? new Date() : null,
    },
    include: { owner: OWNER_SELECT },
  });

  return NextResponse.json(await withMedia(lead), { status: 201 });
}
