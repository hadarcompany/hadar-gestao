import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { itemId } = params;
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
