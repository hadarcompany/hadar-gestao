import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { dateKeyToUTCDate, getTodayKey } from "@/lib/dates";
import { canView } from "@/lib/permissions";
import type { AuthUser } from "@/types/auth";

async function ensureOverdueTaskNotifications(userId: string) {
  const tasks = await prisma.task.findMany({
    where: {
      dueDate: { lt: dateKeyToUTCDate(getTodayKey()) },
      status: { notIn: ["COMPLETED", "CANCELLED"] },
      OR: [{ assignees: { some: { userId } } }, { createdById: userId }],
    },
    select: { id: true, title: true, clientId: true, dueDate: true },
    take: 100,
  });
  if (tasks.length === 0) return;
  await prisma.notification.createMany({
    data: tasks.map((task) => ({
      userId,
      type: "TASK_OVERDUE" as const,
      title: `Tarefa atrasada: ${task.title}`,
      body: `O prazo venceu em ${task.dueDate!.toLocaleDateString("pt-BR", { timeZone: "UTC" })}.`,
      taskId: task.id,
      clientId: task.clientId,
      dedupeKey: `task-overdue:${task.id}:${userId}`,
    })),
    skipDuplicates: true,
  });
}

async function ensureOverduePaymentNotifications(auth: AuthUser) {
  if (!canView(auth, "financeiro")) return;
  const today = dateKeyToUTCDate(getTodayKey());
  await prisma.receivable.updateMany({
    where: { asaasPaymentId: { not: null }, status: "PENDING", dueDate: { lt: today } },
    data: { status: "OVERDUE" },
  });
  const charges = await prisma.receivable.findMany({
    where: { asaasPaymentId: { not: null }, status: "OVERDUE" },
    select: { id: true, asaasPaymentId: true, amount: true, dueDate: true, clientId: true, client: { select: { name: true } } },
    take: 100,
  });
  if (charges.length === 0) return;
  await prisma.notification.createMany({
    data: charges.map((charge) => ({
      userId: auth.id,
      type: "PAYMENT_OVERDUE" as const,
      title: `Cobrança vencida: ${charge.client.name}`,
      body: `${charge.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} venceu em ${charge.dueDate.toLocaleDateString("pt-BR", { timeZone: "UTC" })}.`,
      clientId: charge.clientId,
      dedupeKey: `asaas:PAYMENT_OVERDUE:${charge.asaasPaymentId || charge.id}:${auth.id}`,
    })),
    skipDuplicates: true,
  });
}

export async function GET(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unreadOnly") === "true";

  await ensureOverdueTaskNotifications(auth.id);
  await ensureOverduePaymentNotifications(auth);

  const notifications = await prisma.notification.findMany({
    where: { userId: auth.id, ...(unreadOnly ? { read: false } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const unreadCount = await prisma.notification.count({ where: { userId: auth.id, read: false } });

  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (body.markAllRead) {
    await prisma.notification.updateMany({ where: { userId: auth.id, read: false }, data: { read: true } });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
}
