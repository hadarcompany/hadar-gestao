import { NextRequest, NextResponse } from "next/server";
import { guardApiRequest } from "@/lib/api-guard";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { canEdit, canView } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { invoiceDates, validatePeriod } from "@/lib/card-invoices";
import { moneyInput } from "@/lib/finance-money";
import { loadCardInvoice } from "@/lib/card-invoices-server";
import { financeTransaction } from "@/lib/finance-transactions";

async function authorize(req: NextRequest, edit = false) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await guardApiRequest(auth, req, "/api/financeiro/credit-cards/invoices");
  if (denied) return denied;
  return (edit ? canEdit : canView)(auth, "financeiro") ? null : NextResponse.json({ error: "Sem permissão para o financeiro." }, { status: 403 });
}

export async function GET(req: NextRequest) {
  const denied = await authorize(req); if (denied) return denied;
  const creditCardId = req.nextUrl.searchParams.get("creditCardId");
  if (!creditCardId) return NextResponse.json({ error: "Selecione o cartão." }, { status: 400 });
  let period;
  try { period = validatePeriod(Number(req.nextUrl.searchParams.get("month")), Number(req.nextUrl.searchParams.get("year"))); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
  const card = await prisma.creditCard.findUnique({ where: { id: creditCardId } });
  if (!card) return NextResponse.json({ error: "Cartão não encontrado." }, { status: 404 });
  try { invoiceDates(period, card); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 409 }); }
  const invoice = await financeTransaction(db => loadCardInvoice(db, creditCardId, period));
  return NextResponse.json(invoice, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(req: NextRequest) {
  const denied = await authorize(req, true); if (denied) return denied;
  const body = await req.json();
  let period, paidAmount;
  try { period = validatePeriod(Number(body.month), Number(body.year)); paidAmount = moneyInput(body.paidAmount, true); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
  if (typeof body.creditCardId !== "string" || !body.creditCardId) return NextResponse.json({ error: "Selecione o cartão." }, { status: 400 });
  const card = await prisma.creditCard.findUnique({ where: { id: body.creditCardId } });
  if (!card) return NextResponse.json({ error: "Cartão não encontrado." }, { status: 404 });
  try { invoiceDates(period, card); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 409 }); }
  const invoice = await financeTransaction(async db => {
    await db.creditCardInvoice.upsert({ where: { creditCardId_year_month: { creditCardId: card.id, ...period } }, update: { paidAmount }, create: { creditCardId: card.id, ...period, paidAmount } });
    return loadCardInvoice(db, card.id, period);
  });
  return NextResponse.json(invoice);
}
