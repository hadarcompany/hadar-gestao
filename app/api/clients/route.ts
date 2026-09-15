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

  return NextResponse.json(client, { status: 201 });
}
