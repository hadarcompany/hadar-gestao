import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { TASK_TEMPLATES, generateChecklist } from "@/lib/task-templates";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: {
      client: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      assignees: { include: { user: { select: { id: true, name: true } } } },
    },
  });

  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(task);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { assigneeIds, ...data } = body;

  if (data.startDate) data.startDate = new Date(data.startDate);
  if (data.dueDate) data.dueDate = new Date(data.dueDate);
  if (data.estimatedTime) data.estimatedTime = parseFloat(data.estimatedTime);
  if (data.actualTime) data.actualTime = parseFloat(data.actualTime);

  const updateData: Record<string, unknown> = { ...data };

  if (assigneeIds) {
    await prisma.taskAssignee.deleteMany({ where: { taskId: params.id } });
    updateData.assignees = {
      create: assigneeIds.map((userId: string) => ({ userId })),
    };
  }

  const task = await prisma.task.update({
    where: { id: params.id },
    data: updateData,
    include: {
      client: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      assignees: { include: { user: { select: { id: true, name: true } } } },
    },
  });

  // AUTOMAÇÃO: Calendário Editorial concluído → criar sub-tarefas de produção
  if (
    task.type === "calendario_editorial" &&
    data.status === "COMPLETED" &&
    task.status === "COMPLETED"
  ) {
    await createEditorialSubTasks(task, auth.id);
  }

  return NextResponse.json(task);
}

async function createEditorialSubTasks(
  task: {
    id: string;
    clientId: string | null;
    extraFields: unknown;
    dueDate: Date | null;
    assignees: Array<{ userId: string }>;
  },
  createdById: string
) {
  const extra = (task.extraFields || {}) as Record<string, number>;
  const qtdReels = extra.qtd_reels || 0;
  const qtdCarrosseis = extra.qtd_carrosseis || 0;
  const qtdPostsAvulsos = extra.qtd_posts_avulsos || 0;
  const qtdCriativosTrafego = extra.qtd_criativos_trafego || 0;

  const baseDate = task.dueDate || new Date();
  const clientId = task.clientId;
  const assigneeIds = task.assignees.map((a) => a.userId);

  interface SubTask {
    type: string;
    templateKey: "reels" | "post_avulso" | "carrossel" | "criativo_trafego";
    count: number;
  }

  const subTasks: SubTask[] = [
    { type: "reels", templateKey: "reels", count: qtdReels },
    { type: "carrossel", templateKey: "carrossel", count: qtdCarrosseis },
    { type: "post_avulso", templateKey: "post_avulso", count: qtdPostsAvulsos },
    { type: "criativo_trafego", templateKey: "criativo_trafego", count: qtdCriativosTrafego },
  ];

  let dayOffset = 1;

  for (const sub of subTasks) {
    const template = TASK_TEMPLATES[sub.templateKey];
    for (let i = 0; i < sub.count; i++) {
      const dueDate = new Date(baseDate);
      dueDate.setDate(dueDate.getDate() + dayOffset);
      while (dueDate.getDay() === 0 || dueDate.getDay() === 6) {
        dueDate.setDate(dueDate.getDate() + 1);
      }
      dayOffset += 2;

      const clientName = task.clientId ? "" : "";
      await prisma.task.create({
        data: {
          title: `${template.label} ${i + 1}${clientName}`,
          type: sub.type,
          status: "PENDING",
          priority: "MEDIUM",
          dueDate,
          checklist: JSON.parse(JSON.stringify(generateChecklist(template.checklist))),
          tags: ["auto-gerada", "calendario-editorial"],
          clientId: clientId || undefined,
          createdById,
          assignees: {
            create: assigneeIds.map((userId) => ({ userId })),
          },
        },
      });
    }
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.task.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
