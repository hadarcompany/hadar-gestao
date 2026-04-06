import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");

  const where: Record<string, unknown> = {};
  if (clientId) where.clientId = clientId;

  const accesses = await prisma.access.findMany({
    where,
    include: { client: { select: { id: true, name: true } } },
    orderBy: { platform: "asc" },
  });

  const isAdmin = auth.role === "ADMIN";
  const data = accesses.map((a) => ({
    ...a,
    password: isAdmin ? a.password : "••••••••",
  }));

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
