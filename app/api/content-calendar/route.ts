import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";

function buildItems(reels: number, carroseis: number, criativosTrafico: number) {
  const items: { type: string; index: number }[] = [];
  for (let i = 1; i <= reels; i++) items.push({ type: "REEL", index: i });
  for (let i = 1; i <= carroseis; i++) items.push({ type: "CARROSSEL", index: i });
  for (let i = 1; i <= criativosTrafico; i++) items.push({ type: "CRIATIVO", index: i });
  return items;
}

export async function GET(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");

  const where: Record<string, unknown> = {};
  if (clientId) where.clientId = clientId;

  const calendars = await prisma.contentCalendar.findMany({
    where,
    include: {
      client: { select: { id: true, name: true } },
      items: {
        include: {
          task: { select: { id: true, title: true, status: true } },
        },
        orderBy: [{ type: "asc" }, { index: "asc" }],
      },
    },
    orderBy: { weekStart: "asc" },
  });

  return NextResponse.json(calendars);
}

export async function POST(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId, weekStart, reels, carroseis, criativosTrafico } = await req.json();

  const calendar = await prisma.contentCalendar.create({
    data: {
      clientId,
      weekStart: new Date(weekStart),
      reels: Number(reels) || 0,
      carroseis: Number(carroseis) || 0,
      criativosTrafico: Number(criativosTrafico) || 0,
      items: {
        create: buildItems(
          Number(reels) || 0,
          Number(carroseis) || 0,
          Number(criativosTrafico) || 0
        ),
      },
    },
    include: {
      client: { select: { id: true, name: true } },
      items: {
        include: { task: { select: { id: true, title: true, status: true } } },
        orderBy: [{ type: "asc" }, { index: "asc" }],
      },
    },
  });

  return NextResponse.json(calendar);
}
