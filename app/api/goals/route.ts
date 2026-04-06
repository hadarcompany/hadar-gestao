import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";

async function calculateCurrentValue(
  type: string,
  month: number,
  year: number,
  period: string,
  customValue: number | null
): Promise<number> {
  let startMonth = month;
  let startYear = year;
  const endMonth = month;
  const endYear = year;

  if (period === "QUARTERLY") {
    startMonth = month - 2;
    if (startMonth < 1) { startMonth += 12; startYear--; }
  }

  switch (type) {
    case "REVENUE": {
      const months: { month: number; year: number }[] = [];
      let cY = startYear, cM = startMonth;
      while (cY < endYear || (cY === endYear && cM <= endMonth)) {
        months.push({ month: cM, year: cY });
        cM++;
        if (cM > 12) { cM = 1; cY++; }
      }
      const receivables = await prisma.receivable.findMany({
        where: { status: "PAID", OR: months.map((m) => ({ month: m.month, year: m.year })) },
      });
      return receivables.reduce((sum, r) => sum + r.amount, 0);
    }

    case "NEW_CLIENTS": {
      const start = new Date(startYear, startMonth - 1, 1);
      const end = new Date(endYear, endMonth, 0, 23, 59, 59);
      return prisma.client.count({
        where: { createdAt: { gte: start, lte: end } },
      });
    }

    case "RETENTION": {
      const activeClients = await prisma.client.count({ where: { status: "ACTIVE" } });
      if (activeClients === 0) return 0;
      const scores = await prisma.clientHealthScore.findMany({
        where: { month: endMonth, year: endYear },
      });
      const healthy = scores.filter((s) => {
        const avg = (s.satisfactionDelivery + s.serviceQuality + s.deadlineCompliance + s.perceivedResult + s.npsScore) / 5;
        return avg >= 2.5;
      }).length;
      return scores.length > 0 ? (healthy / scores.length) * 100 : 0;
    }

    case "TASKS_ON_TIME": {
      const start = new Date(startYear, startMonth - 1, 1);
      const end = new Date(endYear, endMonth, 0, 23, 59, 59);
      const completedTasks = await prisma.task.findMany({
        where: {
          status: "COMPLETED",
          updatedAt: { gte: start, lte: end },
          dueDate: { not: null },
        },
      });
      if (completedTasks.length === 0) return 0;
      const onTime = completedTasks.filter((t) => {
        if (!t.dueDate) return true;
        return t.updatedAt <= t.dueDate;
      }).length;
      return (onTime / completedTasks.length) * 100;
    }

    case "AVG_NPS": {
      const scores = await prisma.clientHealthScore.findMany({
        where: { month: endMonth, year: endYear },
      });
      if (scores.length === 0) return 0;
      const totalNps = scores.reduce((sum, s) => sum + s.npsScore, 0);
      return totalNps / scores.length;
    }

    case "CUSTOM":
      return customValue || 0;

    default:
      return 0;
  }
}

export async function GET(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
  const period = searchParams.get("period") || "MONTHLY";

  const where: Record<string, unknown> = { year };
  if (period === "MONTHLY") {
    where.month = month;
    where.period = "MONTHLY";
  } else {
    where.period = "QUARTERLY";
    where.month = { in: [month, month - 1, month - 2].filter((m) => m >= 1) };
  }

  const goals = await prisma.goal.findMany({
    where,
    orderBy: { createdAt: "asc" },
  });

  const goalsWithValues = await Promise.all(
    goals.map(async (goal) => {
      const currentValue = await calculateCurrentValue(goal.type, goal.month, goal.year, goal.period, goal.customValue);
      const progress = goal.targetValue > 0 ? Math.min((currentValue / goal.targetValue) * 100, 100) : 0;

      let status: string = goal.status;
      if (currentValue >= goal.targetValue) {
        status = "ACHIEVED";
      } else {
        const now = new Date();
        const currentDay = now.getDate();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        if (currentDay > daysInMonth / 2 && progress < 40) {
          status = "BEHIND";
        } else {
          status = "ON_TRACK";
        }
      }

      return {
        ...goal,
        currentValue: Math.round(currentValue * 100) / 100,
        progress: Math.round(progress * 10) / 10,
        status,
      };
    })
  );

  return NextResponse.json(goalsWithValues);
}

export async function POST(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, type, targetValue, period, month, year, customValue } = body;

  const goal = await prisma.goal.create({
    data: {
      title,
      type,
      targetValue: parseFloat(targetValue),
      period: period || "MONTHLY",
      month: parseInt(month),
      year: parseInt(year),
      customValue: customValue ? parseFloat(customValue) : null,
    },
  });

  return NextResponse.json(goal, { status: 201 });
}
