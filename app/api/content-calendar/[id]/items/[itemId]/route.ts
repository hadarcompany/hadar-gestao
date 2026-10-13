import { guardApiRequest } from "@/lib/api-guard";
import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params: routeParams }: { params: Promise<{ id: string; itemId: string }> }
) {
  const params = await routeParams;
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await guardApiRequest(auth, req, "/api/content-calendar/[id]/items/[itemId]");
  if (denied) return denied;

  const { itemId } = params;
  const existing = await prisma.contentCalendarItem.findFirst({ where: { id: itemId, calendarId: params.id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.published !== undefined) data.published = body.published;
  if ("taskId" in body) data.taskId = body.taskId ?? null;

  const item = await prisma.contentCalendarItem.update({
    where: { id: itemId },
    data,
    include: {
      task: { select: { id: true, title: true, status: true } },
    },
  });

  return NextResponse.json(item);
}
