import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { guardApiRequest } from "@/lib/api-guard";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { canEdit, canView } from "@/lib/permissions";
import { investmentData, InvestmentError } from "@/lib/investments";
import { adoptInvestmentExpenses, syncInvestmentCash, syncInvestmentExpenses, validateInvestmentCard } from "@/lib/investments-server";
import { financeTransaction } from "@/lib/finance-transactions";

const include = { creditCard: true, _count: { select: { expenses: true } } };
async function authorize(req: NextRequest, edit = false) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await guardApiRequest(auth, req, "/api/financeiro/investments");
  if (denied) return denied;
  if (!(edit ? canEdit : canView)(auth, "financeiro")) return NextResponse.json({ error: "Sem permissão para o financeiro." }, { status: 403 });
  return null;
}
export async function GET(req: NextRequest) {
  const denied = await authorize(req); if (denied) return denied;
  const month = req.nextUrl.searchParams.get("month"), year = req.nextUrl.searchParams.get("year");
  const where: Prisma.InvestmentWhereInput = {};
  if (month && year) where.date = { gte: new Date(Date.UTC(Number(year), Number(month) - 1, 1)), lt: new Date(Date.UTC(Number(year), Number(month), 1)) };
  return NextResponse.json(await prisma.investment.findMany({ where, include, orderBy: { date: "desc" } }));
}
function failure(error: unknown) {
  if (error instanceof InvestmentError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") return NextResponse.json({ error: "Investimento não encontrado." }, { status: 404 });
    if (error.code === "P2002") return NextResponse.json({ error: "Este lançamento já foi salvo. Atualize a lista antes de tentar novamente." }, { status: 409 });
  }
  throw error;
}
function parse(body: Record<string, unknown>, existing?: Parameters<typeof investmentData>[1]) {
  try { return investmentData(body, existing); }
  catch (error) { throw new InvestmentError(error instanceof Error ? error.message : "Dados inválidos."); }
}
export async function POST(req: NextRequest) {
  const denied = await authorize(req, true); if (denied) return denied;
  try {
    const body = await req.json();
    const data = parse(body);
    const requestId = typeof body.requestId === "string" && body.requestId.length <= 100 ? body.requestId : null;
    const result = await financeTransaction(async db => {
      if (requestId) {
        const previous = await db.investment.findUnique({ where: { requestId }, include });
        if (previous) return previous;
      }
      await validateInvestmentCard(db, data.creditCardId);
      const investment = await db.investment.create({ data: { ...data, requestId } });
      await adoptInvestmentExpenses(db, investment, body.existingExpenseIds);
      await syncInvestmentExpenses(db, investment);
      await syncInvestmentCash(db, investment);
      return db.investment.findUniqueOrThrow({ where: { id: investment.id }, include });
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) { return failure(error); }
}
export async function PATCH(req: NextRequest) {
  const denied = await authorize(req, true); if (denied) return denied;
  try {
    const body = await req.json();
    if (typeof body.id !== "string" || !body.id) throw new InvestmentError("ID obrigatório.");
    const result = await financeTransaction(async db => {
      const existing = await db.investment.findUnique({ where: { id: body.id } });
      if (!existing) throw new InvestmentError("Investimento não encontrado.", 404);
      const data = parse(body, existing);
      if (await db.variableExpense.count({ where: { investmentId: existing.id } })) data.autoCreateExpenses = true;
      await validateInvestmentCard(db, data.creditCardId, existing.creditCardId);
      const investment = await db.investment.update({ where: { id: existing.id }, data });
      await adoptInvestmentExpenses(db, investment, body.existingExpenseIds);
      await syncInvestmentExpenses(db, investment);
      await syncInvestmentCash(db, investment);
      return db.investment.findUniqueOrThrow({ where: { id: investment.id }, include });
    });
    return NextResponse.json(result);
  } catch (error) { return failure(error); }
}
export async function DELETE(req: NextRequest) {
  const denied = await authorize(req, true); if (denied) return denied;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
  try {
    // Preserve existing behavior: expenses remain, with their investment link released.
    await financeTransaction(db => db.investment.delete({ where: { id } }));
    return NextResponse.json({ ok: true });
  } catch (error) { return failure(error); }
}
