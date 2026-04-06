import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfWeek } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { howWasWeek, difficulties, improvements } = body;

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

  // Count tasks completed this week by the user
  const mondayStart = new Date(weekStart);
  mondayStart.setHours(0, 0, 0, 0);
  const sundayEnd = new Date(weekStart);
  sundayEnd.setDate(sundayEnd.getDate() + 6);
  sundayEnd.setHours(23, 59, 59, 999);

  const tasksCompleted = await prisma.task.count({
    where: {
      status: "COMPLETED",
      assignees: { some: { userId: session.user.id } },
      updatedAt: { gte: mondayStart, lte: sundayEnd },
    },
  });

  const review = await prisma.weeklyReview.upsert({
    where: {
      userId_weekStart: {
        userId: session.user.id,
        weekStart: mondayStart,
      },
    },
    update: { howWasWeek, difficulties, improvements, tasksCompleted },
    create: {
      userId: session.user.id,
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
