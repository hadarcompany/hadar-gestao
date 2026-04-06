import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface MonthlyProLabore {
  month: number;
  year: number;
  label: string;
  receivedRevenue: number;
  totalExpenses: number;
  grossProfit: number;
  cashReserve: number;
  distributable: number;
  felipe: number;
  alexandre: number;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));

  const results: MonthlyProLabore[] = [];

  for (let month = 1; month <= 12; month++) {
    // Revenue received
    const receivables = await prisma.receivable.findMany({
      where: { month, year, status: "PAID" },
    });
    const receivedRevenue = receivables.reduce((sum, r) => sum + r.amount, 0);

    // Expenses
    const fixedExpenses = await prisma.fixedExpense.findMany({
      where: { month, year },
    });
    const totalFixed = fixedExpenses.reduce((sum, e) => sum + e.amount, 0);

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const variableExpenses = await prisma.variableExpense.findMany({
      where: { date: { gte: startDate, lte: endDate } },
    });
    const totalVariable = variableExpenses.reduce((sum, e) => sum + e.amount, 0);

    const investments = await prisma.investment.findMany({
      where: { date: { gte: startDate, lte: endDate } },
    });
    const totalInvestments = investments.reduce((sum, e) => sum + e.amount, 0);

    const totalExpenses = totalFixed + totalVariable + totalInvestments;
    const grossProfit = receivedRevenue - totalExpenses;
    const cashReserve = grossProfit > 0 ? grossProfit * 0.10 : 0;
    const distributable = grossProfit > 0 ? grossProfit - cashReserve : 0;
    const felipe = distributable * 0.60;
    const alexandre = distributable * 0.40;

    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    results.push({
      month,
      year,
      label: `${monthNames[month - 1]}/${year}`,
      receivedRevenue,
      totalExpenses,
      grossProfit,
      cashReserve,
      distributable,
      felipe,
      alexandre,
    });
  }

  // Current month data for the cards
  const currentMonth = new Date().getMonth() + 1;
  const current = results.find((r) => r.month === currentMonth) || results[0];

  return NextResponse.json({ current, history: results.filter((r) => r.receivedRevenue > 0 || r.totalExpenses > 0) });
}
