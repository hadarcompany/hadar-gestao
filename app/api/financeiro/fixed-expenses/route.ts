import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  const where: Record<string, unknown> = {};
  if (month) where.month = parseInt(month);
  if (year) where.year = parseInt(year);

  const expenses = await prisma.fixedExpense.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(expenses);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, category, amount, paidWithCash, month, year } = body;

  const expense = await prisma.fixedExpense.create({
    data: {
      name,
      category,
      amount: parseFloat(amount),
      paidWithCash: paidWithCash || false,
      month: parseInt(month),
      year: parseInt(year),
    },
  });

  // If paid with cash, create a cash withdrawal entry
  if (paidWithCash) {
    await prisma.cashEntry.create({
      data: {
        type: "RETIRADA_DESPESA",
        amount: parseFloat(amount),
        description: `Despesa Fixa: ${name}`,
      },
    });
  }

  return NextResponse.json(expense, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, ...data } = body;
  if (data.amount) data.amount = parseFloat(data.amount);

  const expense = await prisma.fixedExpense.update({
    where: { id },
    data,
  });

  return NextResponse.json(expense);
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  await prisma.fixedExpense.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
