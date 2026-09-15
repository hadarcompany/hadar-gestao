import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { dateKeyToUTCDate, dateKeyToUTCEndOfDay, getCurrentWeekRange, getTodayKey, toDateKey } from "@/lib/dates";
import { TASK_INCLUDE } from "@/lib/task-transfer";
import { applyMedia, loadMediaIndex } from "@/lib/media";

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

  const media = await loadMediaIndex();
  return NextResponse.json({
    range: { from: fromKey, to: toKey },
    stats: { pending, inProgress, overdue, completedInRange },
    nextDeliveries: applyMedia(nextDeliveries.map((t) => ({ ...t, dueDateKey: toDateKey(t.dueDate) })), media),
    upcomingRenewals: applyMedia(upcomingRenewals, media, "client"),
  });
}
