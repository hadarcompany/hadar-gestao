import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "month";

  const now = new Date();
  let startDate: Date;

  switch (period) {
    case "week":
      startDate = new Date(now); startDate.setDate(now.getDate() - 7); break;
    case "quarter":
      startDate = new Date(now); startDate.setMonth(now.getMonth() - 3); break;
    case "year":
      startDate = new Date(now); startDate.setFullYear(now.getFullYear() - 1); break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
  }

  const [pending, inProgress, overdue, completedThisPeriod, allTasks, upcomingRenewals] = await Promise.all([
    prisma.task.count({ where: { status: "PENDING" } }),
    prisma.task.count({ where: { status: "IN_PROGRESS" } }),
    prisma.task.count({
      where: {
        dueDate: { lt: now },
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
    }),
    prisma.task.count({
      where: { status: "COMPLETED", updatedAt: { gte: startDate } },
    }),
    prisma.task.findMany({
      where: { status: "COMPLETED", updatedAt: { gte: startDate } },
      select: { updatedAt: true },
    }),
    prisma.client.findMany({
      where: {
        renewalDate: {
          gte: now,
          lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
      },
      select: { id: true, name: true, renewalDate: true },
      orderBy: { renewalDate: "asc" },
    }),
  ]);

  const nextDeliveries = await prisma.task.findMany({
    where: {
      status: { notIn: ["COMPLETED", "CANCELLED"] },
      dueDate: { gte: now },
    },
    include: {
      client: { select: { name: true } },
      assignees: { include: { user: { select: { name: true } } } },
    },
    orderBy: { dueDate: "asc" },
    take: 5,
  });

  // Group completed tasks by week
  const weeklyData: Record<string, number> = {};
  allTasks.forEach((t) => {
    const d = new Date(t.updatedAt);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const key = weekStart.toISOString().split("T")[0];
    weeklyData[key] = (weeklyData[key] || 0) + 1;
  });

  const chartData = Object.entries(weeklyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, count]) => ({
      week: new Date(week).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      concluidas: count,
    }));

  return NextResponse.json({
    stats: { pending, inProgress, overdue, completedThisPeriod },
    chartData,
    nextDeliveries,
    upcomingRenewals,
  });
}
