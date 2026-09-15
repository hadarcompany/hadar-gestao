import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { withMedia } from "@/lib/media";
import { TASK_TEMPLATES, generateChecklist } from "@/lib/task-templates";
import { TASK_INCLUDE } from "@/lib/task-transfer";
import { areaForType } from "@/lib/areas";

export async function GET(_req: NextRequest, { params: routeParams }: { params: Promise<{ id: string }> }) {
  const params = await routeParams;
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    include: TASK_INCLUDE,
  });

  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(await withMedia(task));
}

export async function PATCH(req: NextRequest, { params: routeParams }: { params: Promise<{ id: string }> }) {
  const params = await routeParams;
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  // assigneeIds/transferNote são tratados por /api/tasks/[id]/transfer (histórico + chat +
  // notificação centralizados); aqui apenas edições diretas do formulário/lista são aplicadas.
  const { assigneeIds, transferNote, ...data } = body;
  void transferNote;

  if (data.startDate !== undefined) data.startDate = data.startDate ? new Date(data.startDate) : null;
  if (data.dueDate !== undefined) data.dueDate = data.dueDate ? new Date(data.dueDate) : null;
  if (data.publishDate !== undefined) data.publishDate = data.publishDate ? new Date(data.publishDate) : null;
  if (data.area !== undefined) data.area = data.area || null;
  if (data.projectId !== undefined) data.projectId = data.projectId || null;
  if (data.estimatedTime !== undefined) data.estimatedTime = data.estimatedTime === "" || data.estimatedTime === null ? null : parseFloat(data.estimatedTime);
  if (data.actualTime !== undefined) data.actualTime = data.actualTime === "" || data.actualTime === null ? null : parseFloat(data.actualTime);

  const updateData: Record<string, unknown> = { ...data };

  if (data.status !== undefined) {
    updateData.completedAt = data.status === "COMPLETED" ? new Date() : null;
  }

  if (assigneeIds) {
    await prisma.taskAssignee.deleteMany({ where: { taskId: params.id } });
    updateData.assignees = {
      create: assigneeIds.map((userId: string) => ({ userId })),
    };
  }

  const task = await prisma.task.update({
    where: { id: params.id },
    data: updateData,
    include: TASK_INCLUDE,
  });

  // AUTOMAÇÃO: Calendário Editorial concluído → criar sub-tarefas de produção
  if (
    task.type === "calendario_editorial" &&
    data.status === "COMPLETED" &&
    task.status === "COMPLETED"
  ) {
    await createEditorialSubTasks(task, auth.id);
  }

  return NextResponse.json(await withMedia(task));
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
      // Prazos são datas de calendário em meia-noite UTC; usar métodos locais
      // deslocaria o dia conforme o fuso do servidor.
      const dueDate = new Date(baseDate);
      dueDate.setUTCDate(dueDate.getUTCDate() + dayOffset);
      while (dueDate.getUTCDay() === 0 || dueDate.getUTCDay() === 6) {
        dueDate.setUTCDate(dueDate.getUTCDate() + 1);
      }
      dayOffset += 2;

      const clientName = task.clientId ? "" : "";
      await prisma.task.create({
        data: {
          title: `${template.label} ${i + 1}${clientName}`,
          type: sub.type,
          area: areaForType(sub.type),
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

export async function DELETE(_req: NextRequest, { params: routeParams }: { params: Promise<{ id: string }> }) {
  const params = await routeParams;
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.task.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
