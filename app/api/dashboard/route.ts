import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { dateKeyToUTCDate, dateKeyToUTCEndOfDay, getCurrentWeekRange, getTodayKey, toDateKey } from "@/lib/dates";
import { TASK_INCLUDE } from "@/lib/task-transfer";
import { applyMedia, loadMediaIndex } from "@/lib/media";
import { canView } from "@/lib/permissions";

/**
 * period = intervalo [from, to] em chaves YYYY-MM-DD. Se ausente, usa a semana
 * atual (segunda a domingo). "Previstas" usa dueDate; "concluídas no período"
 * usa completedAt (não updatedAt, que muda em qualquer edição do registro).
 */
export async function GET(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const defaultRange = getCurrentWeekRange();
  const fromKey = fromParam || defaultRange.start;
  const toKey = toParam || defaultRange.end;

  const rangeStart = dateKeyToUTCDate(fromKey);
  const rangeEnd = dateKeyToUTCEndOfDay(toKey);
  const todayStart = dateKeyToUTCDate(getTodayKey());
  const [currentYear, currentMonth] = getTodayKey().split("-").map(Number);
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
  const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
  const monthStart = dateKeyToUTCDate(`${currentYear}-${String(currentMonth).padStart(2, "0")}-01`);
  const monthEnd = dateKeyToUTCDate(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01`);

  const [pending, inProgress, overdue, completedInRange, upcomingRenewals] = await Promise.all([
    prisma.task.count({ where: { status: "PENDING" } }),
    prisma.task.count({ where: { status: "IN_PROGRESS" } }),
    prisma.task.count({
      where: { dueDate: { lt: todayStart }, status: { notIn: ["COMPLETED", "CANCELLED"] } },
    }),
    prisma.task.count({
      where: { status: "COMPLETED", completedAt: { gte: rangeStart, lte: rangeEnd } },
    }),
    prisma.client.findMany({
      where: { renewalDate: { gte: todayStart, lte: new Date(todayStart.getTime() + 30 * 24 * 60 * 60 * 1000) } },
      select: { id: true, name: true, renewalDate: true },
      orderBy: { renewalDate: "asc" },
    }),
  ]);

  const nextDeliveries = await prisma.task.findMany({
    where: {
      status: { notIn: ["COMPLETED", "CANCELLED"] },
      dueDate: { gte: rangeStart, lte: rangeEnd },
    },
    include: TASK_INCLUDE,
    orderBy: { dueDate: "asc" },
    take: 12,
  });

  let financialSummary = null;
  if (canView(auth, "financeiro")) {
    await prisma.receivable.updateMany({
      where: { asaasPaymentId: { not: null }, status: "PENDING", dueDate: { lt: todayStart } },
      data: { status: "OVERDUE" },
    });

    const [paid, pendingReceivables, overdueReceivables, fixed, variableExpenses, investments] = await Promise.all([
      prisma.receivable.findMany({
        where: {
          asaasPaymentId: { not: null },
          status: "PAID",
          OR: [
            { revenueCompetenceMonth: currentMonth, revenueCompetenceYear: currentYear },
            { revenueCompetenceMonth: null, revenueCompetenceYear: null, paidDate: { gte: monthStart, lt: monthEnd } },
          ],
        },
        select: { amount: true },
      }),
      prisma.receivable.findMany({
        where: { asaasPaymentId: { not: null }, status: "PENDING", month: currentMonth, year: currentYear },
        select: { amount: true },
      }),
      prisma.receivable.findMany({
        where: { asaasPaymentId: { not: null }, status: "OVERDUE" },
        select: { amount: true, dueDate: true, clientId: true, client: { select: { id: true, name: true } } },
        orderBy: { dueDate: "asc" },
      }),
      prisma.fixedExpense.findMany({ where: { month: currentMonth, year: currentYear }, select: { amount: true } }),
      prisma.variableExpense.findMany({ where: { date: { gte: monthStart, lt: monthEnd } }, select: { amount: true } }),
      prisma.investment.findMany({ where: { date: { gte: monthStart, lt: monthEnd } }, select: { amount: true } }),
    ]);

    const received = paid.reduce((sum, item) => sum + item.amount, 0);
    const pendingValue = pendingReceivables.reduce((sum, item) => sum + item.amount, 0);
    const overdueValue = overdueReceivables.reduce((sum, item) => sum + item.amount, 0);
    const expenses = [...fixed, ...variableExpenses, ...investments].reduce((sum, item) => sum + item.amount, 0);
    const overdueByClient = new Map<string, { id: string; name: string; amount: number; dueDate: Date }>();
    overdueReceivables.forEach((item) => {
      const current = overdueByClient.get(item.clientId);
      if (current) current.amount += item.amount;
      else overdueByClient.set(item.clientId, { ...item.client, amount: item.amount, dueDate: item.dueDate });
    });
    financialSummary = {
      month: currentMonth,
      year: currentYear,
      received,
      pending: pendingValue,
      overdue: overdueValue,
      expenses,
      result: received - expenses,
      overdueClients: Array.from(overdueByClient.values()).slice(0, 5),
    };
  }

  const media = await loadMediaIndex();
  return NextResponse.json({
    range: { from: fromKey, to: toKey },
    stats: { pending, inProgress, overdue, completedInRange },
    nextDeliveries: applyMedia(nextDeliveries.map((t) => ({ ...t, dueDateKey: toDateKey(t.dueDate) })), media),
    upcomingRenewals: applyMedia(upcomingRenewals, media, "client"),
    financialSummary: financialSummary ? {
      ...financialSummary,
      overdueClients: applyMedia(financialSummary.overdueClients, media, "client"),
    } : null,
  });
}
