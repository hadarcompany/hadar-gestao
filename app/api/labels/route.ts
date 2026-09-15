import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";

const HEX = /^#[0-9a-f]{6}$/i;

export async function GET() {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const labels = await prisma.taskLabel.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
  return NextResponse.json(labels);
}

export async function POST(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 40) : "";
  if (!name) return NextResponse.json({ error: "Dê um nome à etiqueta" }, { status: 400 });

  const last = await prisma.taskLabel.findFirst({ orderBy: { position: "desc" }, select: { position: true } });
  const label = await prisma.taskLabel.create({
    data: { name, color: HEX.test(body.color) ? body.color : "#579bfc", position: (last?.position ?? 0) + 1 },
  });
  return NextResponse.json(label, { status: 201 });
}
