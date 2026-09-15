import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { withMedia } from "@/lib/media";

export async function GET() {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clients = await prisma.client.findMany({
    omit: { logoUrl: true },
    include: {
      _count: { select: { tasks: true } },
      interactions: { orderBy: { date: "desc" }, take: 5, include: { author: { select: { name: true } } } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(await withMedia(clients, "client"));
}

export async function POST(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const client = await prisma.client.create({
    data: {
      name: body.name,
      email: body.email || null,
      phone: body.phone || null,
      driveLink: body.driveLink || null,
      contractLink: body.contractLink || null,
      briefing: body.briefing || null,
      status: body.status || "ACTIVE",
      contractStartDate: body.contractStartDate ? new Date(body.contractStartDate) : null,
      renewalDate: body.renewalDate ? new Date(body.renewalDate) : null,
      classification: body.classification || null,
    },
  });

  // Cliente que já entra ativo ganha o projeto de onboarding; prospecto só quando virar ativo.
  if (client.status !== "PROSPECT") {
    try {
      const { createClientOnboarding } = await import("@/lib/onboarding");
      await createClientOnboarding(client, auth.id);
    } catch (e) {
      console.error("Falha ao gerar o onboarding do cliente:", e);
    }
  }

  return NextResponse.json(client, { status: 201 });
}
