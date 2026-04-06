import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clients = await prisma.client.findMany({
    include: {
      _count: { select: { tasks: true } },
      interactions: { orderBy: { date: "desc" }, take: 5, include: { author: { select: { name: true } } } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    },
  });

  return NextResponse.json(client, { status: 201 });
}
