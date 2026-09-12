"use client";

import { ClientIdentity } from "@/components/clients/client-identity";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/auth-context";
import { TaskRow } from "@/components/tasks/task-row";
import { TaskDetailModal } from "@/components/tasks/task-detail-modal";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { CommercialPanel } from "@/components/dashboard/commercial-panel";
import { getCurrentWeekRange, formatDayMonthBR } from "@/lib/dates";
import { type TaskData } from "@/lib/types";
import { ClipboardList, Clock, AlertTriangle, CheckCircle2, Loader2, ArrowUpRight } from "lucide-react";

interface DashboardData {
  range: { from: string; to: string };
  stats: { pending: number; inProgress: number; overdue: number; completedInRange: number };
  nextDeliveries: TaskData[];
  upcomingRenewals: Array<{ id: string; name: string; logoUrl?: string | null; renewalDate: string }>;
}

function currentWeekAsRange() {
  const { start, end } = getCurrentWeekRange();
  return { from: start, to: end };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [range, setRange] = useState(currentWeekAsRange());
  const [isCustom, setIsCustom] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<{ id: string; name: string; image?: string | null }[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string; image?: string | null }[]>([]);
  const [selectedTask, setSelectedTask] = useState<TaskData | null>(null);
  const defaultRangeRef = useRef(range);

  const fetchData = useCallback(async (from: string, to: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard?from=${from}&to=${to}`);
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(range.from, range.to);
    fetch("/api/users").then((r) => r.json()).then(setUsers);
    fetch("/api/clients").then((r) => r.json()).then((d) => setClients(d.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchData(range.from, range.to); }, [range, fetchData]);

  // Mantém a semana padrão sempre atualizada enquanto a tela fica aberta (ex: virada de segunda-feira),
  // mas só quando o usuário não estiver com um intervalo personalizado selecionado.
  useEffect(() => {
    const id = setInterval(() => {
      const fresh = currentWeekAsRange();
      if (!isCustom && (fresh.from !== defaultRangeRef.current.from || fresh.to !== defaultRangeRef.current.to)) {
        defaultRangeRef.current = fresh;
        setRange(fresh);
      }
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [isCustom]);

  function handleRangeChange(from: string, to: string) {
    setIsCustom(true);
    setRange({ from, to });
  }

  function resetToCurrentWeek() {
    const fresh = currentWeekAsRange();
    defaultRangeRef.current = fresh;
    setIsCustom(false);
    setRange(fresh);
  }

  function handleRowUpdated(updated: TaskData) {
    setData((prev) => (prev ? { ...prev, nextDeliveries: prev.nextDeliveries.map((t) => (t.id === updated.id ? updated : t)) } : prev));
  }

  const stats = data?.stats;
  const statCards = [
    { label: "A Fazer", value: stats?.pending ?? 0, icon: ClipboardList, color: "text-gray-600", bg: "bg-gray-100" },
    { label: "Em Andamento", value: stats?.inProgress ?? 0, icon: Clock, color: "text-blue-600", bg: "bg-blue-500/10" },
    { label: "Atrasadas", value: stats?.overdue ?? 0, icon: AlertTriangle, color: "text-accent", bg: "bg-accent/10" },
    { label: "Concluídas no período", value: stats?.completedInRange ?? 0, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-500/10" },
  ];

  return (
    <div className="min-h-screen bg-transparent w-full">
      <h1 className="text-xl font-bold text-gray-900 tracking-tight mb-5">
        Dashboard <span className="text-gray-400 font-normal text-sm">· {user?.name?.split(" ")[0] ?? ""}</span>
      </h1>

      <CommercialPanel />

      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-semibold text-gray-800">Operação</h2>
        <DateRangePicker from={range.from} to={range.to} isCustom={isCustom} onChange={handleRangeChange} onResetToCurrentWeek={resetToCurrentWeek} />
      </div>

      {/* KPIs — compactos, uma linha */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center shrink-0`}>
              <card.icon size={16} className={card.color} />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-gray-900 leading-tight">{card.value}</p>
              <p className="text-[11px] text-gray-400 truncate">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Lista de tarefas — prioridade visual */}
        <div className="lg:col-span-3 bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800">Entregas no período selecionado</h2>
            {loading && <Loader2 size={14} className="animate-spin text-accent" />}
          </div>
          {!loading && data?.nextDeliveries.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-10">Nenhuma entrega prevista neste período.</p>
          ) : (
            <div>
              {data?.nextDeliveries.map((t) => (
                <TaskRow key={t.id} task={t} users={users} onUpdated={handleRowUpdated} onOpenDetail={setSelectedTask} />
              ))}
            </div>
          )}
        </div>

        {/* Renovações — secundário, sem destaque visual grande */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Renovações (30 dias)</h2>
            <ArrowUpRight size={13} className="text-gray-300" />
          </div>
          {data?.upcomingRenewals && data.upcomingRenewals.length > 0 ? (
            <div className="space-y-2.5">
              {data.upcomingRenewals.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 truncate"><ClientIdentity client={r} /></span>
                  <span className="text-gray-400 shrink-0 ml-2">{formatDayMonthBR(r.renewalDate)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">Nenhuma renovação próxima.</p>
          )}
        </div>
      </div>

      <TaskDetailModal
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        task={selectedTask}
        onAttachmentsChanged={() => fetchData(range.from, range.to)}
        onUpdated={() => { fetchData(range.from, range.to); setSelectedTask(null); }}
        users={users}
        clients={clients}
      />
    </div>
  );
}
