import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");

  const where: Record<string, unknown> = {};
  if (clientId) where.clientId = clientId;

  const accesses = await prisma.access.findMany({
    where,
    include: { client: { select: { id: true, name: true } } },
    orderBy: { platform: "asc" },
  });

  // Mask passwords for non-admin
  const isAdmin = session.user.role === "ADMIN";
  const data = accesses.map((a) => ({
    ...a,
    password: isAdmin ? a.password : "••••••••",
  }));

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const access = await prisma.access.create({
    data: {
      platform: body.platform,
      url: body.url || null,
      email: body.email || null,
      password: body.password || null,
      observations: body.observations || null,
      clientId: body.clientId,
    },
    include: { client: { select: { id: true, name: true } } },
  });

  return NextResponse.json(access, { status: 201 });
}
