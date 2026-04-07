import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";

async function syncItems(calendarId: string, type: string, newCount: number) {
  const existing = await prisma.contentCalendarItem.findMany({
    where: { calendarId, type },
    orderBy: { index: "asc" },
  });

  const oldCount = existing.length;

  if (newCount > oldCount) {
    await prisma.contentCalendarItem.createMany({
      data: Array.from({ length: newCount - oldCount }, (_, i) => ({
        calendarId,
        type,
        index: oldCount + i + 1,
      })),
    });
  } else if (newCount < oldCount) {
    const toDelete = existing.slice(newCount).map((i) => i.id);
    await prisma.contentCalendarItem.deleteMany({
      where: { id: { in: toDelete } },
    });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;
  const { weekStart, reels, carroseis, criativosTrafico } = await req.json();

  await prisma.contentCalendar.update({
    where: { id },
    data: {
      ...(weekStart ? { weekStart: new Date(weekStart) } : {}),
      ...(reels !== undefined ? { reels: Number(reels) } : {}),
      ...(carroseis !== undefined ? { carroseis: Number(carroseis) } : {}),
      ...(criativosTrafico !== undefined ? { criativosTrafico: Number(criativosTrafico) } : {}),
    },
  });

  if (reels !== undefined) await syncItems(id, "REEL", Number(reels));
  if (carroseis !== undefined) await syncItems(id, "CARROSSEL", Number(carroseis));
  if (criativosTrafico !== undefined) await syncItems(id, "CRIATIVO", Number(criativosTrafico));

  const updated = await prisma.contentCalendar.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true } },
      items: {
        include: { task: { select: { id: true, title: true, status: true } } },
        orderBy: [{ type: "asc" }, { index: "asc" }],
      },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.contentCalendar.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
