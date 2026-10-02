import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { canEdit, canView } from "@/lib/permissions";
import { ExpensePaymentError } from "@/lib/expense-payments";
import { resolveExpensePayment } from "@/lib/expense-payments-server";

export async function GET(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canView(auth, "financeiro")) return NextResponse.json({ error: "Sem acesso ao financeiro." }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  const where: Record<string, unknown> = {};
  if (month) where.month = parseInt(month);
  if (year) where.year = parseInt(year);

  const expenses = await prisma.fixedExpense.findMany({
    where,
    include: { creditCard: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(expenses);
}

export async function POST(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEdit(auth, "financeiro")) return NextResponse.json({ error: "Sem permissão para editar o financeiro." }, { status: 403 });

  const body = await req.json();
  const { name, category, amount, paidWithCash, month, year } = body;

  try {
    const expense = await prisma.$transaction(async (db) => {
      const payment = await resolveExpensePayment(db, body);
      const expense = await db.fixedExpense.create({
        data: {
          ...payment,
          name,
          category,
          amount: parseFloat(amount),
          paidWithCash: paidWithCash || false,
          month: parseInt(month),
          year: parseInt(year),
        },
      });

      if (paidWithCash) {
        await db.cashEntry.create({
          data: {
            type: "RETIRADA_DESPESA",
            amount: parseFloat(amount),
            description: `Despesa Fixa: ${name}`,
          },
        });
      }
      return expense;
    });
    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    if (error instanceof ExpensePaymentError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEdit(auth, "financeiro")) return NextResponse.json({ error: "Sem permissão para editar o financeiro." }, { status: 403 });

  const body = await req.json();
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  try {
    const expense = await prisma.$transaction(async (db) => {
      const existing = await db.fixedExpense.findUnique({ where: { id } });
      if (!existing) return null;
      const payment = await resolveExpensePayment(db, body, existing);
      return db.fixedExpense.update({
        where: { id },
        data: {
          ...payment,
          ...(body.name !== undefined ? { name: String(body.name) } : {}),
          ...(body.category !== undefined ? { category: body.category } : {}),
          ...(body.amount !== undefined ? { amount: parseFloat(body.amount) } : {}),
          ...(body.month !== undefined ? { month: parseInt(body.month) } : {}),
          ...(body.year !== undefined ? { year: parseInt(body.year) } : {}),
          ...(body.paidWithCash !== undefined ? { paidWithCash: Boolean(body.paidWithCash) } : {}),
        },
      });
    });
    if (!expense) return NextResponse.json({ error: "Despesa não encontrada." }, { status: 404 });
    return NextResponse.json(expense);
  } catch (error) {
    if (error instanceof ExpensePaymentError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEdit(auth, "financeiro")) return NextResponse.json({ error: "Sem permissão para editar o financeiro." }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  await prisma.fixedExpense.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
