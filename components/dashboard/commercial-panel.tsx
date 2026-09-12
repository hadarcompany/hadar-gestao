"use client";

import { useState, useEffect, useCallback } from "react";
import { LEAD_STAGES } from "@/lib/leads";
import { Loader2, TrendingUp, Users, Percent, DollarSign, Receipt, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";

const BRL = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2000, i).toLocaleString("pt-BR", { month: "long" }));

interface BreakdownRow { name: string; count: number; value: number }

interface CommercialData {
  month: number;
  year: number;
  leadsInMonth: number;
  closedDeals: number;
  lostDeals: number;
  conversionRate: number;
  totalSales: number;
  avgTicket: number;
  mrr: number;
  goal: { title: string; target: number } | null;
  funnel: { stage: string; label: string; count: number; value: number }[];
  topProducts: BreakdownRow[];
  salesByOrigin: BreakdownRow[];
  leadsByOrigin: BreakdownRow[];
}

export function CommercialPanel() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<CommercialData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/commercial?month=${month}&year=${year}`);
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const cards = [
    { label: "Leads no mês", value: String(data?.leadsInMonth ?? 0), icon: Users, color: "text-blue-600", bg: "bg-blue-500/10" },
    { label: "Negócios fechados", value: String(data?.closedDeals ?? 0), icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-500/10" },
    { label: "Taxa de conversão", value: `${(data?.conversionRate ?? 0).toFixed(0)}%`, icon: Percent, color: "text-purple-600", bg: "bg-purple-500/10" },
    { label: "Total em vendas", value: BRL(data?.totalSales ?? 0), icon: DollarSign, color: "text-accent", bg: "bg-accent/10" },
    { label: "Ticket médio", value: BRL(data?.avgTicket ?? 0), icon: Receipt, color: "text-amber-600", bg: "bg-amber-500/10" },
    { label: "Recorrência (MRR)", value: BRL(data?.mrr ?? 0), icon: Repeat, color: "text-gray-600", bg: "bg-gray-100" },
  ];

  const goalPct = data?.goal && data.goal.target > 0 ? Math.min(100, (data.totalSales / data.goal.target) * 100) : null;
  const funnelMax = Math.max(1, ...(data?.funnel.map((f) => f.count) ?? [1]));

  return (
    <section className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-semibold text-gray-800">Comercial</h2>
        <div className="flex items-center gap-2">
          {loading && <Loader2 size={13} className="animate-spin text-accent" />}
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 focus:outline-none focus:border-accent/50 capitalize"
          >
            {MONTHS.map((m, i) => <option key={m} value={i + 1} className="capitalize">{m}</option>)}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 focus:outline-none focus:border-accent/50"
          >
            {[year - 2, year - 1, year, year + 1].filter((y, i, a) => a.indexOf(y) === i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white border border-gray-200 rounded-xl px-3 py-3">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-2", card.bg)}>
              <card.icon size={15} className={card.color} />
            </div>
            <p className="text-base font-bold text-gray-900 leading-tight truncate" title={card.value}>{card.value}</p>
            <p className="text-[11px] text-gray-400 truncate">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Meta x realizado + funil */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Meta x vendas realizadas</h3>
          {data?.goal ? (
            <div className="mb-5">
              <div className="flex items-end justify-between mb-1.5">
                <span className="text-lg font-bold text-gray-900">{BRL(data.totalSales)}</span>
                <span className="text-xs text-gray-400">meta {BRL(data.goal.target)}</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", (goalPct ?? 0) >= 100 ? "bg-emerald-500" : "bg-accent")}
                  style={{ width: `${goalPct ?? 0}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">{(goalPct ?? 0).toFixed(0)}% da meta de {data.goal.title}</p>
            </div>
          ) : (
            <p className="text-xs text-gray-400 mb-5">
              Nenhuma meta de receita cadastrada para este mês. Defina em Metas para acompanhar aqui.
            </p>
          )}

          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Funil de conversão</h3>
          <div className="space-y-2">
            {data?.funnel.map((f) => {
              const color = LEAD_STAGES.find((s) => s.value === f.stage)?.dot ?? "bg-gray-300";
              return (
                <div key={f.stage} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-[11px] text-gray-500 truncate">{f.label}</span>
                  <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                    <div
                      className={cn("h-full rounded transition-all", color)}
                      style={{ width: `${(f.count / funnelMax) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-xs font-semibold text-gray-700">{f.count}</span>
                  <span className="w-24 shrink-0 text-right text-[11px] text-gray-400">{f.value > 0 ? BRL(f.value) : "—"}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <Breakdown title="Produtos mais vendidos" rows={data?.topProducts ?? []} empty="Nenhuma venda no mês." showValue />
          <Breakdown title="Leads por origem" rows={data?.leadsByOrigin ?? []} empty="Nenhum lead no mês." />
        </div>
      </div>
    </section>
  );
}

function Breakdown({ title, rows, empty, showValue = false }: { title: string; rows: BreakdownRow[]; empty: string; showValue?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-gray-400">{empty}</p>
      ) : (
        <div className="space-y-2">
          {rows.slice(0, 6).map((r) => (
            <div key={r.name}>
              <div className="flex items-center justify-between text-xs mb-0.5">
                <span className="text-gray-600 truncate">{r.name}</span>
                <span className="text-gray-400 shrink-0 ml-2">
                  {showValue && r.value > 0 ? BRL(r.value) : `${r.count}`}
                </span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-accent/60 rounded-full" style={{ width: `${(r.count / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
