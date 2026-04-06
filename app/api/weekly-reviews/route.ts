import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { startOfWeek } from "date-fns";

export async function GET(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const weekParam = searchParams.get("week");
  const userId = searchParams.get("userId");

  const where: Record<string, unknown> = {};
  if (weekParam) where.weekStart = new Date(weekParam);
  if (userId) where.userId = userId;

  const reviews = await prisma.weeklyReview.findMany({
    where,
    include: { user: { select: { id: true, name: true } } },
    orderBy: { weekStart: "desc" },
  });

  return NextResponse.json(reviews);
}

export async function POST(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { howWasWeek, difficulties, improvements } = body;

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

  const mondayStart = new Date(weekStart);
  mondayStart.setHours(0, 0, 0, 0);
  const sundayEnd = new Date(weekStart);
  sundayEnd.setDate(sundayEnd.getDate() + 6);
  sundayEnd.setHours(23, 59, 59, 999);

  const tasksCompleted = await prisma.task.count({
    where: {
      status: "COMPLETED",
      assignees: { some: { userId: auth.id } },
      updatedAt: { gte: mondayStart, lte: sundayEnd },
    },
  });

  const review = await prisma.weeklyReview.upsert({
    where: {
      userId_weekStart: {
        userId: auth.id,
        weekStart: mondayStart,
      },
    },
    update: { howWasWeek, difficulties, improvements, tasksCompleted },
    create: {
      userId: auth.id,
      weekStart: mondayStart,
      howWasWeek,
      difficulties,
      improvements,
      tasksCompleted,
    },
    include: { user: { select: { id: true, name: true } } },
  });

  return NextResponse.json(review, { status: 201 });
}
