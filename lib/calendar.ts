import { prisma } from "@/lib/prisma";
import { addDaysToKey, dateKeyToUTCDate, dateKeyToUTCEndOfDay, getMondayOfWeek } from "@/lib/dates";
import { DELIVERY_TYPES, type DeliveryTypeValue } from "@/lib/delivery-types";

export interface WeekWindow {
  start: string;
  end: string;
}

export function buildWeekWindows(anchorWeekStart: string, count: number): WeekWindow[] {
  const monday = getMondayOfWeek(anchorWeekStart);
  return Array.from({ length: count }, (_, i) => {
    const start = addDaysToKey(monday, i * 7);
    return { start, end: addDaysToKey(start, 6) };
  });
}

export interface DemandComparison {
  deliveryType: DeliveryTypeValue;
  label: string;
  configured: boolean;
  contracted: number;
  programmed: number;
  completed: number;
  missingToProgram: number;
  programmedPendingCompletion: number;
  extra: number;
  unflaggedExcess: number;
}

/** Resolve, para uma janela de semana, a demanda vigente de um cliente por tipo
 * (considerando a vigência: a linha ativa durante aquela semana, não necessariamente a atual). */
async function getEffectiveDemand(clientId: string, week: WeekWindow): Promise<Record<string, number>> {
  const weekStartDate = dateKeyToUTCDate(week.start);
  const weekEndDate = dateKeyToUTCEndOfDay(week.end);

  const rows = await prisma.clientWeeklyDemand.findMany({
    where: {
      clientId,
      effectiveFrom: { lte: weekEndDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: weekStartDate } }],
    },
  });

  const byType: Record<string, number> = {};
  for (const row of rows) byType[row.deliveryType] = row.quantity;
  return byType;
}

export async function getCalendarWeeks(params: { clientId: string | null; anchorWeekStart: string; count: number }) {
  const { clientId, anchorWeekStart, count } = params;
  const windows = buildWeekWindows(anchorWeekStart, count);
  const overallStart = dateKeyToUTCDate(windows[0].start);
  const overallEnd = dateKeyToUTCEndOfDay(windows[windows.length - 1].end);

  const tasks = await prisma.task.findMany({
    where: {
      publishDate: { gte: overallStart, lte: overallEnd },
      ...(clientId ? { clientId } : {}),
    },
    include: {
      client: { select: { id: true, name: true } },
      assignees: { include: { user: { select: { id: true, name: true } } } },
    },
    orderBy: { publishDate: "asc" },
  });

  const weeks = await Promise.all(
    windows.map(async (win) => {
      const weekTasks = tasks.filter((t) => {
        if (!t.publishDate) return false;
        const key = getMondayOfWeek(t.publishDate.toISOString().slice(0, 10));
        return key === win.start;
      });

      let comparison: DemandComparison[] | null = null;
      if (clientId) {
        const demand = await getEffectiveDemand(clientId, win);
        const hasAnyDemand = Object.keys(demand).length > 0;
        comparison = hasAnyDemand
          ? DELIVERY_TYPES.map((dt) => {
              const contracted = demand[dt.value] ?? 0;
              const configured = demand[dt.value] !== undefined;
              const ofType = weekTasks.filter((t) => t.type === dt.value);
              const nonExtra = ofType.filter((t) => !t.isExtra);
              const extraTasks = ofType.filter((t) => t.isExtra);
              const programmed = nonExtra.length;
              const completed = nonExtra.filter((t) => t.status === "COMPLETED").length;
              return {
                deliveryType: dt.value,
                label: dt.label,
                configured,
                contracted,
                programmed,
                completed,
                missingToProgram: configured ? Math.max(0, contracted - programmed) : 0,
                programmedPendingCompletion: Math.max(0, programmed - completed),
                extra: extraTasks.length,
                unflaggedExcess: configured ? Math.max(0, programmed - contracted) : 0,
              };
            })
          : null;
      }

      return { ...win, tasks: weekTasks, comparison, demandConfigured: comparison !== null };
    })
  );

  return weeks;
}
