import { TASK_INCLUDE } from "@/lib/task-transfer";
import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { withMedia } from "@/lib/media";

export async function GET(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const clientId = searchParams.get("clientId");
  const priority = searchParams.get("priority");
  const assigneeId = searchParams.get("assigneeId");
  const sort = searchParams.get("sort") || "dueDate";
  const order = searchParams.get("order") || "asc";

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (clientId) where.clientId = clientId;
  if (priority) where.priority = priority;
  if (assigneeId) where.assignees = { some: { userId: assigneeId } };

  const tasks = await prisma.task.findMany({
    where,
    include: TASK_INCLUDE,
    orderBy: { [sort]: order },
  });

  return NextResponse.json(await withMedia(tasks));
}

export async function POST(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    title, type, description, status, priority,
    startDate, dueDate, publishDate, isExtra, estimatedTime, checklist,
    extraFields, tags, clientId, assigneeIds,
  } = body;

  const task = await prisma.task.create({
    data: {
      title,
      type: type || null,
      description: description || null,
      status: status || "PENDING",
      priority: priority || "MEDIUM",
      startDate: startDate ? new Date(startDate) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      publishDate: publishDate ? new Date(publishDate) : null,
      isExtra: !!isExtra,
      estimatedTime: estimatedTime ? parseFloat(estimatedTime) : null,
      checklist: checklist || null,
      extraFields: extraFields || null,
      tags: tags || [],
      clientId: clientId || null,
      createdById: auth.id,
      assignees: {
        create: (assigneeIds || []).map((userId: string) => ({ userId })),
      },
    },
    include: TASK_INCLUDE,
  });

  return NextResponse.json(await withMedia(task), { status: 201 });
}
