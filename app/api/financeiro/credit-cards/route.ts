import { guardApiRequest } from "@/lib/api-guard";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { canEdit, canView } from "@/lib/permissions";
import { financeTransaction } from "@/lib/finance-transactions";
import { syncInvestmentExpenses } from "@/lib/investments-server";
import { InvestmentError } from "@/lib/investments";

function cardData(body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const bank = typeof body.bank === "string" ? body.bank.trim() : "";
  const brand = typeof body.brand === "string" ? body.brand.trim() : "";
  const color = body.color ?? "#FF5A00";
  if (!name || name.length > 100 || bank.length > 100 || brand.length > 50) {
    throw new Error("Informe um nome de até 100 caracteres, banco de até 100 e bandeira de até 50.");
  }
  if (typeof color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error("Cor do cartão inválida.");
  if (body.isActive !== undefined && typeof body.isActive !== "boolean") throw new Error("Status do cartão inválido.");
  const day = (value: unknown) => value == null || value === "" ? null : typeof value === "number" || (typeof value === "string" && /^\d+$/.test(value)) ? Number(value) : NaN;
  const closingDay = day(body.closingDay), dueDay = day(body.dueDay);
  if ((closingDay === null) !== (dueDay === null) || [closingDay, dueDay].some(value => value !== null && (!Number.isInteger(value) || value < 1 || value > 31))) {
    throw new Error("Informe os dias de fechamento e vencimento entre 1 e 31.");
  }
  return { name, bank: bank || null, brand: brand || null, color, isActive: body.isActive ?? true, closingDay, dueDay };
}

export async function GET(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await guardApiRequest(auth, req, "/api/financeiro/credit-cards");
  if (denied) return denied;
  if (!canView(auth, "financeiro")) return NextResponse.json({ error: "Sem acesso ao financeiro." }, { status: 403 });
  const cards = await prisma.creditCard.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] });
  return NextResponse.json(cards);
}

export async function POST(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await guardApiRequest(auth, req, "/api/financeiro/credit-cards");
  if (denied) return denied;
  if (!canEdit(auth, "financeiro")) return NextResponse.json({ error: "Sem permissão para editar o financeiro." }, { status: 403 });
  let data;
  try { data = cardData(await req.json()); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Dados inválidos." }, { status: 400 }); }
  return NextResponse.json(await prisma.creditCard.create({ data }), { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await guardApiRequest(auth, req, "/api/financeiro/credit-cards");
  if (denied) return denied;
  if (!canEdit(auth, "financeiro")) return NextResponse.json({ error: "Sem permissão para editar o financeiro." }, { status: 403 });
  const body = await req.json();
  if (typeof body.id !== "string" || !body.id) return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
  try {
    const card = await financeTransaction(async db => {
    const existing = await db.creditCard.findUnique({ where: { id: body.id } });
    if (!existing) throw new InvestmentError("Cartão não encontrado.", 404);
    let data;
    try { data = cardData({ ...existing, ...body }); }
    catch (error) { throw new InvestmentError((error as Error).message); }
    if (data.closingDay === null && await db.investment.count({ where: { creditCardId: existing.id } })) throw new InvestmentError("Mantenha as datas configuradas enquanto houver investimentos vinculados.", 409);
    const updated = await db.creditCard.update({ where: { id: body.id }, data });
    if (updated.closingDay !== existing.closingDay || updated.dueDay !== existing.dueDay) {
      const investments = await db.investment.findMany({ where: { creditCardId: updated.id, autoCreateExpenses: true } });
      for (const investment of investments) await syncInvestmentExpenses(db, investment);
    }
    return updated;
    });
    return NextResponse.json(card);
  } catch (error) {
    if (error instanceof InvestmentError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await guardApiRequest(auth, req, "/api/financeiro/credit-cards");
  if (denied) return denied;
  if (!canEdit(auth, "financeiro")) return NextResponse.json({ error: "Sem permissão para editar o financeiro." }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
  try { await prisma.creditCard.delete({ where: { id } }); }
  catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2003") return NextResponse.json({ error: "Este cartão possui despesas, investimentos ou faturas vinculadas. Desative-o para preservar o histórico." }, { status: 409 });
      if (error.code === "P2025") return NextResponse.json({ error: "Cartão não encontrado." }, { status: 404 });
    }
    throw error;
  }
  return NextResponse.json({ ok: true });
}
