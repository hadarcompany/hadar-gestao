import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { loadMediaIndex } from "@/lib/media";
import { dateKeyToUTCDate } from "@/lib/dates";
import { canView } from "@/lib/permissions";

function periodDateRange(startMonth: number, startYear: number, endMonth: number, endYear: number) {
  const start = dateKeyToUTCDate(`${startYear}-${String(startMonth).padStart(2, "0")}-01`);
  const nextMonth = endMonth === 12 ? 1 : endMonth + 1;
  const nextYear = endMonth === 12 ? endYear + 1 : endYear;
  const endExclusive = dateKeyToUTCDate(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01`);
  return { start, endExclusive };
}

export async function GET(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canView(auth, "financeiro")) return NextResponse.json({ error: "Sem acesso ao financeiro." }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const startMonth = parseInt(searchParams.get("startMonth") || String(new Date().getMonth() + 1));
  const startYear = parseInt(searchParams.get("startYear") || String(new Date().getFullYear()));
  const endMonth = parseInt(searchParams.get("endMonth") || String(startMonth));
  const endYear = parseInt(searchParams.get("endYear") || String(startYear));

  const activeClients = await prisma.client.count({ where: { status: "ACTIVE" } });

  const months: { month: number; year: number }[] = [];
  let cYear = startYear;
  let cMonth = startMonth;
  while (cYear < endYear || (cYear === endYear && cMonth <= endMonth)) {
    months.push({ month: cMonth, year: cYear });
    cMonth++;
    if (cMonth > 12) { cMonth = 1; cYear++; }
  }

  const dueReceivables = await prisma.receivable.findMany({
    where: {
      asaasPaymentId: { not: null },
      // Cobranças pagas com competência ajustada pertencem ao mês informado
      // na competência; as demais continuam seguindo o vencimento.
      OR: months.flatMap((m) => [
        { status: "PAID", revenueCompetenceMonth: m.month, revenueCompetenceYear: m.year },
        { status: "PAID", revenueCompetenceMonth: null, revenueCompetenceYear: null, month: m.month, year: m.year },
        { status: { not: "PAID" }, month: m.month, year: m.year },
      ]),
    },
    include: { client: { select: { id: true, name: true } } },
  });

  const paymentRange = periodDateRange(startMonth, startYear, endMonth, endYear);
  const paidReceivables = await prisma.receivable.findMany({
    where: {
      asaasPaymentId: { not: null },
      status: "PAID",
      OR: [
        ...months.map((m) => ({ revenueCompetenceMonth: m.month, revenueCompetenceYear: m.year })),
        {
          revenueCompetenceMonth: null,
          revenueCompetenceYear: null,
          paidDate: { gte: paymentRange.start, lt: paymentRange.endExclusive },
        },
      ],
    },
    include: { client: { select: { id: true, name: true } } },
  });

  const expectedRevenue = dueReceivables.reduce((sum, r) => sum + r.amount, 0);
  const receivedRevenue = paidReceivables.reduce((sum, r) => sum + r.amount, 0);

  const media = await loadMediaIndex();
  const clientRevenue = new Map<string, { name: string; logoUrl: string | null; expected: number; received: number }>();
  dueReceivables.forEach((r) => {
    const existing = clientRevenue.get(r.clientId);
    if (existing) {
      existing.expected += r.amount;
    } else {
      clientRevenue.set(r.clientId, {
        name: r.client.name,
        logoUrl: media.logo(r.clientId),
        expected: r.amount,
        received: 0,
      });
    }
  });
  paidReceivables.forEach((r) => {
    const existing = clientRevenue.get(r.clientId);
    if (existing) existing.received += r.amount;
    else clientRevenue.set(r.clientId, {
      name: r.client.name,
      logoUrl: media.logo(r.clientId),
      expected: 0,
      received: r.amount,
    });
  });

  const fixedExpenses = await prisma.fixedExpense.findMany({
    where: { OR: months.map((m) => ({ month: m.month, year: m.year })) },
  });
  const totalFixedExpenses = fixedExpenses.reduce((sum, e) => sum + e.amount, 0);

  const expenseByCategory = new Map<string, number>();
  fixedExpenses.forEach((e) => {
    expenseByCategory.set(e.category, (expenseByCategory.get(e.category) || 0) + e.amount);
  });

  const startDate = new Date(startYear, startMonth - 1, 1);
  const endDate = new Date(endYear, endMonth, 0, 23, 59, 59);

  const variableExpenses = await prisma.variableExpense.findMany({
    where: { date: { gte: startDate, lte: endDate } },
  });
  const totalVariableExpenses = variableExpenses.reduce((sum, e) => sum + e.amount, 0);
  variableExpenses.forEach((e) => {
    expenseByCategory.set(e.category, (expenseByCategory.get(e.category) || 0) + e.amount);
  });

  const investments = await prisma.investment.findMany({
    where: { date: { gte: startDate, lte: endDate } },
  });
  const totalInvestments = investments.reduce((sum, e) => sum + e.amount, 0);
  if (totalInvestments > 0) {
    expenseByCategory.set("INVESTIMENTOS", totalInvestments);
  }

  const totalExpenses = totalFixedExpenses + totalVariableExpenses + totalInvestments;
  const grossProfit = receivedRevenue - totalExpenses;

  const chartData = months.map((m) => {
    const mReceived = paidReceivables
      .filter((r) => {
        const revenueMonth = r.revenueCompetenceMonth || (r.paidDate ? r.paidDate.getUTCMonth() + 1 : null);
        const revenueYear = r.revenueCompetenceYear || r.paidDate?.getUTCFullYear();
        return revenueMonth === m.month && revenueYear === m.year;
      })
      .reduce((sum, r) => sum + r.amount, 0);
    const mFixed = fixedExpenses
      .filter((e) => e.month === m.month && e.year === m.year)
      .reduce((sum, e) => sum + e.amount, 0);
    const mStart = new Date(m.year, m.month - 1, 1);
    const mEnd = new Date(m.year, m.month, 0, 23, 59, 59);
    const mVariable = variableExpenses
      .filter((e) => e.date >= mStart && e.date <= mEnd)
      .reduce((sum, e) => sum + e.amount, 0);
    const mInvest = investments
      .filter((e) => e.date >= mStart && e.date <= mEnd)
      .reduce((sum, e) => sum + e.amount, 0);

    const monthLabel = `${String(m.month).padStart(2, "0")}/${m.year}`;
    return {
      name: monthLabel,
      faturamento: mReceived,
      despesas: mFixed + mVariable + mInvest,
    };
  });

  return NextResponse.json({
    activeClients,
    expectedRevenue,
    receivedRevenue,
    totalExpenses,
    grossProfit,
    clientRevenue: Array.from(clientRevenue.entries()).map(([id, data]) => ({
      clientId: id,
      ...data,
    })),
    expenseByCategory: Array.from(expenseByCategory.entries()).map(([category, amount]) => ({
      category,
      amount,
    })),
    chartData,
  });
}
