import { NextRequest, NextResponse } from "next/server";
import { getServerAuth } from "@/lib/supabase/get-server-auth";
import { prisma } from "@/lib/prisma";
import { LEAD_STAGES, FUNNEL_STAGES } from "@/lib/leads";
import { canView } from "@/lib/permissions";

/**
 * Painel comercial do mês. Vendas e ticket médio consideram leads FECHADO pela
 * data de fechamento (closedAt), não pela de criação — um lead que entrou em
 * agosto e fechou em setembro é venda de setembro.
 *
 * Taxa de conversão = fechados ÷ (fechados + perdidos) no mês. Usar leads criados
 * como denominador distorceria: negócio fechado neste mês pode ter entrado em outro.
 */
export async function GET(req: NextRequest) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const financialVisible = canView(auth, "financeiro");

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const month = parseInt(searchParams.get("month") || String(now.getUTCMonth() + 1));
  const year = parseInt(searchParams.get("year") || String(now.getUTCFullYear()));

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const inMonth = { gte: start, lt: end };

  const [createdInMonth, closedInMonth, lostInMonth, allLeads, recurringServices, goal] = await Promise.all([
    prisma.lead.count({ where: { createdAt: inMonth } }),
    prisma.lead.findMany({
      where: { stage: "FECHADO", closedAt: inMonth },
      select: { value: true, product: true, origin: true },
    }),
    prisma.lead.count({ where: { stage: "PERDIDO", closedAt: inMonth } }),
    prisma.lead.findMany({ select: { stage: true, value: true, origin: true, createdAt: true } }),
    financialVisible ? prisma.service.findMany({
      where: { type: "RECURRING", status: "IN_PROGRESS" },
      select: { monthlyValue: true },
    }) : Promise.resolve([]),
    financialVisible ? prisma.goal.findFirst({ where: { type: "REVENUE", month, year } }) : Promise.resolve(null),
  ]);

  const closedDeals = closedInMonth.length;
  const totalSales = closedInMonth.reduce((sum, l) => sum + (l.value ?? 0), 0);
  const avgTicket = closedDeals > 0 ? totalSales / closedDeals : 0;
  const concluded = closedDeals + lostInMonth;
  const conversionRate = concluded > 0 ? (closedDeals / concluded) * 100 : 0;
  const mrr = recurringServices.reduce((sum, s) => sum + (s.monthlyValue ?? 0), 0);

  const funnel = FUNNEL_STAGES.map((stage) => {
    const items = allLeads.filter((l) => l.stage === stage);
    return {
      stage,
      label: LEAD_STAGES.find((s) => s.value === stage)?.label ?? stage,
      count: items.length,
      value: items.reduce((sum, l) => sum + (l.value ?? 0), 0),
    };
  });

  const topProducts = aggregate(closedInMonth.map((l) => ({ key: l.product, value: l.value })));
  const salesByOrigin = aggregate(closedInMonth.map((l) => ({ key: l.origin, value: l.value })));
  const leadsByOrigin = aggregate(
    allLeads.filter((l) => l.createdAt >= start && l.createdAt < end).map((l) => ({ key: l.origin, value: l.value }))
  );

  return NextResponse.json({
    month, year, financialVisible,
    leadsInMonth: createdInMonth,
    closedDeals, lostDeals: lostInMonth,
    conversionRate,
    totalSales: financialVisible ? totalSales : null,
    avgTicket: financialVisible ? avgTicket : null,
    mrr: financialVisible ? mrr : null,
    goal: goal ? { title: goal.title, target: goal.targetValue } : null,
    funnel: funnel.map((item) => ({ ...item, value: financialVisible ? item.value : 0 })),
    topProducts: topProducts.map((item) => ({ ...item, value: financialVisible ? item.value : 0 })),
    salesByOrigin: financialVisible ? salesByOrigin : [],
    leadsByOrigin: leadsByOrigin.map((item) => ({ ...item, value: 0 })),
  });
}

function aggregate(rows: { key: string | null; value: number | null }[]) {
  const map = new Map<string, { name: string; count: number; value: number }>();
  for (const row of rows) {
    const name = row.key?.trim() || "Não informado";
    const entry = map.get(name) ?? { name, count: 0, value: 0 };
    entry.count += 1;
    entry.value += row.value ?? 0;
    map.set(name, entry);
  }
  return [...map.values()].sort((a, b) => b.value - a.value || b.count - a.count);
}
