import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { resetChecklistForClone, TASK_INCLUDE } from "@/lib/task-transfer";

/** Clona uma tarefa como registro independente: novo id, começa PENDING,
 * sem histórico de transferência, notificações ou dados de conclusão. */
export async function POST(req: NextRequest, { params: routeParams }: { params: Promise<{ id: string }> }) {
  const params = await routeParams;
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const original = await prisma.task.findUnique({
    where: { id: params.id },
    include: { assignees: true },
  });
  if (!original) return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  const clone = await prisma.task.create({
    data: {
      title: body.title ?? `${original.title} (cópia)`,
      type: original.type,
      description: original.description,
      status: "PENDING",
      priority: original.priority,
      startDate: original.startDate,
      dueDate: original.dueDate,
      publishDate: null,
      isExtra: false,
      checklist: original.checklist ? JSON.parse(JSON.stringify(resetChecklistForClone(original.checklist))) : null,
      extraFields: original.extraFields ?? undefined,
      tags: original.tags,
      clientId: original.clientId,
      createdById: auth.id,
      assignees: {
        create: (Array.isArray(body.assigneeIds) ? body.assigneeIds : original.assignees.map((a) => a.userId)).map(
          (userId: string) => ({ userId })
        ),
      },
    },
    include: TASK_INCLUDE,
  });

  return NextResponse.json(clone, { status: 201 });
}
