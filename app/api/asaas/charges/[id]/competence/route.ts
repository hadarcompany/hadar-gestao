import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/permissions";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEdit(auth, "financeiro")) return NextResponse.json({ error: "Sem permissão para ajustar a competência." }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const month = Number(body.month);
  const year = Number(body.year);
  const reason = String(body.reason || "").trim();
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000) {
    return NextResponse.json({ error: "Informe um mês de competência válido." }, { status: 400 });
  }
  if (reason.length < 5) return NextResponse.json({ error: "Explique brevemente o motivo do ajuste." }, { status: 400 });

  const charge = await prisma.receivable.findUnique({ where: { id } });
  if (!charge || !charge.asaasPaymentId) return NextResponse.json({ error: "Cobrança do Asaas não encontrada." }, { status: 404 });
  if (charge.status !== "PAID" || !charge.paidDate) {
    return NextResponse.json({ error: "A competência manual só pode ser ajustada em cobranças pagas." }, { status: 400 });
  }

  const paymentMonth = charge.paidDate.getUTCMonth() + 1;
  const paymentYear = charge.paidDate.getUTCFullYear();
  const fromMonth = charge.revenueCompetenceMonth || paymentMonth;
  const fromYear = charge.revenueCompetenceYear || paymentYear;
  const matchesPaymentMonth = month === paymentMonth && year === paymentYear;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.revenueCompetenceAdjustment.create({
      data: {
        receivableId: charge.id,
        fromMonth,
        fromYear,
        toMonth: month,
        toYear: year,
        reason,
        adjustedById: auth.id,
        adjustedByName: auth.name,
      },
    });
    return tx.receivable.update({
      where: { id: charge.id },
      data: {
        revenueCompetenceMonth: matchesPaymentMonth ? null : month,
        revenueCompetenceYear: matchesPaymentMonth ? null : year,
        competenceNote: reason,
        competenceAdjustedAt: new Date(),
        competenceAdjustedById: auth.id,
      },
    });
  });

  return NextResponse.json(updated);
}
