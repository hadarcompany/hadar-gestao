"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Clock, AlertTriangle, CheckCircle2, Calendar, Loader2, ArrowUpRight } from "lucide-react";
import dynamic from "next/dynamic";

const DashboardChart = dynamic(() => import("@/components/dashboard-chart"), { ssr: false });

interface DashboardData {
  stats: { pending: number; inProgress: number; overdue: number; completedThisPeriod: number };
  chartData: { week: string; concluidas: number }[];
  nextDeliveries: Array<Record<string, unknown>>;
  upcomingRenewals: Array<{ id: string; name: string; renewalDate: string }>;
}

const periods = [
  { value: "week", label: "Semana" },
  { value: "month", label: "Mês" },
  { value: "quarter", label: "Trimestre" },
  { value: "year", label: "Ano" },
];

export default function DashboardPage() {
  const { data: session } = useSession();
  const [period, setPeriod] = useState("month");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard?period=${period}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [period]);

  const stats = data?.stats;

  const statCards = [
    { label: "A Fazer", value: stats?.pending ?? 0, icon: ClipboardList, color: "text-zinc-300", bg: "bg-zinc-800" },
    { label: "Em Progresso", value: stats?.inProgress ?? 0, icon: Clock, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "Atrasadas", value: stats?.overdue ?? 0, icon: AlertTriangle, color: "text-[#FF5A00]", bg: "bg-[#FF5A00]/10", isAlert: true },
    { label: "Concluídas", value: stats?.completedThisPeriod ?? 0, icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  ];

  return (
    <div className="min-h-screen bg-transparent w-full">
      {/* HEADER DA PÁGINA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Dashboard <span className="text-zinc-500 font-normal">| Bem-vindo, {session?.user?.name?.split(' ')[0] ?? ""}</span>
          </h1>
        </div>

        {/* SELETOR DE PERÍODO (Estilo Hadar) */}
        <div className="flex bg-zinc-900/80 backdrop-blur-md rounded-xl border border-zinc-800 p-1">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                period === p.value 
                  ? "bg-[#FF5A00] text-white shadow-lg shadow-[#FF5A00]/20" 
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 size={32} className="animate-spin text-[#FF5A00]" />
        </div>
      ) : (
        <>
          {/* CARDS DE KPIS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            {statCards.map((card) => (
              <div 
                key={card.label} 
                className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60 rounded-2xl p-6 hover:border-zinc-700 transition-colors relative overflow-hidden"
              >
                <div className="flex justify-between items-start mb-4">
                  <p className="text-sm font-medium text-zinc-400">{card.label}</p>
                  <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center`}>
                    <card.icon size={20} className={card.color} />
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-4xl font-bold text-white">{card.value}</p>
                  {card.isAlert && card.value > 0 && (
                    <span className="text-xs font-medium text-[#FF5A00] bg-[#FF5A00]/10 px-2 py-1 rounded-md flex items-center gap-1">
                      Atenção 🍌
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* PRÓXIMAS ENTREGAS (Estilo Tabela/Lista Aprovada) */}
            <div className="lg:col-span-2 bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white">Minhas Tarefas e Próximas Atividades</h2>
              </div>
              
              {data?.nextDeliveries && data.nextDeliveries.length > 0 ? (
                <div className="space-y-3">
                  {data.nextDeliveries.map((t, idx) => (
                    <div 
                      key={t.id as string} 
                      className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-3 px-4 rounded-xl border border-zinc-800/40 bg-zinc-900/40 hover:bg-zinc-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        {/* BADGE DE STATUS */}
                        <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-[#FF5A00] text-white shrink-0">
                          Status
                        </span>
                        
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-100 truncate flex items-center gap-2">
                            {t.title as string}
                            {idx === 0 && <span title="Urgente">🍌</span>} {/* Nano banana na primeira tarefa */}
                          </p>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {(t.client as { name: string } | null)?.name || "Sem cliente"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 md:gap-12 text-sm text-zinc-400">
                        <div className="hidden md:block text-right">
                          <p className="text-xs text-zinc-500 mb-0.5">Data de Entrega</p>
                          <div className="flex items-center gap-1.5 text-zinc-300">
                            <Calendar size={14} className="text-[#FF5A00]" />
                            {t.dueDate ? new Date(t.dueDate as string).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-xl">
                  <p className="text-zinc-500 text-sm">Nenhuma entrega próxima.</p>
                </div>
              )}
            </div>

            {/* GRÁFICO E RENOVAÇÕES (Coluna da Direita) */}
            <div className="flex flex-col gap-6">
              
              {/* RENOVAÇÕES PRÓXIMAS */}
              <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-sm font-semibold text-white">Renovações (30 dias)</h2>
                  <ArrowUpRight size={18} className="text-zinc-500" />
                </div>
                
                {data?.upcomingRenewals && data.upcomingRenewals.length > 0 ? (
                  <div className="space-y-4">
                    {data.upcomingRenewals.map((r) => (
                      <div key={r.id} className="flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-[#FF5A00]" />
                          <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">{r.name}</span>
                        </div>
                        <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded-md">
                          {new Date(r.renewalDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500 text-center py-4">Tudo tranquilo por enquanto.</p>
                )}
              </div>

              {/* CHART (Mantido mas com container na IDV) */}
              <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60 rounded-2xl p-6 flex-1 min-h-[300px]">
                <h2 className="text-sm font-semibold text-white mb-6">Concluídas por Semana</h2>
                {data?.chartData && data.chartData.length > 0 ? (
                  <div className="h-[200px] w-full">
                    {/* O componente do chart interno (Recharts) deve ser atualizado para usar fill="#FF5A00" nas barras */}
                    <DashboardChart data={data.chartData} />
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500 text-center py-10 border border-dashed border-zinc-800 rounded-xl">
                    Sem dados suficientes.
                  </p>
                )}
              </div>

            </div>
          </div>
        </>
      )}
    </div>
  );
}