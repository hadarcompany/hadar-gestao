import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { canEdit, canView } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canView(auth, "financeiro")) return NextResponse.json({ error: "Sem acesso ao financeiro." }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  const where: Record<string, unknown> = {};
  if (month && year) {
    const start = new Date(parseInt(year), parseInt(month) - 1, 1);
    const end = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
    where.date = { gte: start, lte: end };
  }

  const expenses = await prisma.variableExpense.findMany({
    where,
    orderBy: { date: "desc" },
  });

  return NextResponse.json(expenses);
}

export async function POST(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEdit(auth, "financeiro")) return NextResponse.json({ error: "Sem permissão para editar o financeiro." }, { status: 403 });

  const body = await req.json();
  const { name, category, amount, date, paidWithCash } = body;

  const expense = await prisma.variableExpense.create({
    data: {
      name,
      category,
      amount: parseFloat(amount),
      date: new Date(date),
      paidWithCash: paidWithCash || false,
    },
  });

  if (paidWithCash) {
    await prisma.cashEntry.create({
      data: {
        type: "RETIRADA_DESPESA",
        amount: parseFloat(amount),
        description: `Despesa Avulsa: ${name}`,
      },
    });
  }

  return NextResponse.json(expense, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEdit(auth, "financeiro")) return NextResponse.json({ error: "Sem permissão para editar o financeiro." }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  await prisma.variableExpense.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEdit(auth, "financeiro")) return NextResponse.json({ error: "Sem permissão para editar o financeiro." }, { status: 403 });

  const body = await req.json();
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  const expense = await prisma.variableExpense.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: String(body.name) } : {}),
      ...(body.category !== undefined ? { category: body.category } : {}),
      ...(body.amount !== undefined ? { amount: parseFloat(body.amount) } : {}),
      ...(body.date !== undefined ? { date: new Date(body.date) } : {}),
      ...(body.paidWithCash !== undefined ? { paidWithCash: Boolean(body.paidWithCash) } : {}),
    },
  });
  return NextResponse.json(expense);
}
