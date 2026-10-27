import { guardApiRequest } from "@/lib/api-guard";
import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { canEdit, canView } from "@/lib/permissions";
import { sumMoney } from "@/lib/finance-money";
import { financeTransaction } from "@/lib/finance-transactions";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await guardApiRequest(auth, _req, "/api/financeiro/cash");
  if (denied) return denied;
  if (!canView(auth, "financeiro")) return NextResponse.json({ error: "Sem acesso ao financeiro." }, { status: 403 });

  const entries = await prisma.cashEntry.findMany({
    where: { voidedAt: null },
    orderBy: { date: "desc" },
  });

  const balance = sumMoney(entries.map(entry => entry.type === "RETIRADA_DESPESA" ? -entry.amount : entry.amount));

  let config = await prisma.cashConfig.findUnique({ where: { id: "singleton" } });
  if (!config) {
    config = await prisma.cashConfig.create({
      data: { id: "singleton", minBalance: 1000 },
    });
  }

  return NextResponse.json({ balance, entries, minBalance: config.minBalance });
}

export async function DELETE(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await guardApiRequest(auth, req, "/api/financeiro/cash");
  if (denied) return denied;
  if (!canEdit(auth, "financeiro")) return NextResponse.json({ error: "Sem permissão para editar o financeiro." }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
  const result = await financeTransaction(async db => {
    const entry = await db.cashEntry.findUnique({ where: { id } });
    if (!entry || entry.voidedAt) return null;
    // A reserva automática é calculada pelo pró-labore, não é uma despesa avulsa.
    if (entry.type !== "RETIRADA_DESPESA") return "INVALID";
    if (entry.fixedExpenseId) await db.fixedExpense.update({ where: { id: entry.fixedExpenseId }, data: { paidWithCash: false } });
    if (entry.variableExpenseId) await db.variableExpense.update({ where: { id: entry.variableExpenseId }, data: { paidWithCash: false } });
    if (entry.investmentId) await db.investment.update({ where: { id: entry.investmentId }, data: { paidWithCash: false } });
    await db.cashEntry.update({ where: { id }, data: { voidedAt: new Date() } });
    return "OK";
  });
  if (!result) return NextResponse.json({ error: "Movimentação não encontrada." }, { status: 404 });
  if (result === "INVALID") return NextResponse.json({ error: "Somente retiradas de despesas podem ser removidas por esta ação." }, { status: 409 });
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await guardApiRequest(auth, req, "/api/financeiro/cash");
  if (denied) return denied;
  if (!canEdit(auth, "financeiro")) return NextResponse.json({ error: "Sem permissão para editar o financeiro." }, { status: 403 });

  const body = await req.json();
  const { type, amount, description } = body;

  if (body.action === "updateConfig") {
    const config = await prisma.cashConfig.upsert({
      where: { id: "singleton" },
      update: { minBalance: parseFloat(body.minBalance) },
      create: { id: "singleton", minBalance: parseFloat(body.minBalance) },
    });
    return NextResponse.json(config);
  }

  const entry = await prisma.cashEntry.create({
    data: {
      type: type || "APORTE",
      amount: parseFloat(amount),
      description: description || null,
      date: new Date(),
    },
  });

  return NextResponse.json(entry, { status: 201 });
}
