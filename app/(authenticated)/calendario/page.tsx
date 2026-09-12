"use client";

import { ClientIdentity } from "@/components/clients/client-identity";
import { useState, useEffect, useCallback } from "react";
import { TaskDetailModal } from "@/components/tasks/task-detail-modal";
import { CreateTaskModal } from "@/components/tasks/create-task-modal";
import { statusLabel, statusColor } from "@/lib/status-labels";
import { deliveryTypeLabel } from "@/lib/delivery-types";
import { formatDateKeyBR, getCurrentWeekRange, addDaysToKey } from "@/lib/dates";
import { type TaskData } from "@/lib/types";
import { ChevronLeft, ChevronRight, RotateCcw, Plus, Loader2, Calendar as CalendarIcon, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalendarTask {
  id: string;
  title: string;
  type: string | null;
  status: string;
  publishDate: string;
  isExtra: boolean;
  client: { id: string; name: string; logoUrl?: string | null } | null;
}

interface DemandComparison {
  deliveryType: string;
  label: string;
  configured: boolean;
  contracted: number;
  programmed: number;
  completed: number;
  missingToProgram: number;
  programmedPendingCompletion: number;
  extra: number;
  unflaggedExcess: number;
}

interface WeekData {
  start: string;
  end: string;
  tasks: CalendarTask[];
  comparison: DemandComparison[] | null;
}

const WEEK_COUNT = 4;

export default function CalendarioPage() {
  const [clients, setClients] = useState<{ id: string; name: string; image?: string | null }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; image?: string | null }[]>([]);
  const [clientFilter, setClientFilter] = useState("");
  const [anchor, setAnchor] = useState(getCurrentWeekRange().start);
  const [weeks, setWeeks] = useState<WeekData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskData | null>(null);
  const [createFor, setCreateFor] = useState<{ weekStart: string } | null>(null);

  const fetchWeeks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ anchor, count: String(WEEK_COUNT) });
      if (clientFilter) params.set("clientId", clientFilter);
      const res = await fetch(`/api/calendar?${params}`);
      const data = await res.json();
      setWeeks(data.weeks ?? []);
    } finally {
      setLoading(false);
    }
  }, [anchor, clientFilter]);

  useEffect(() => {
    fetch("/api/clients").then((r) => r.json()).then((d) => setClients(d.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))));
    fetch("/api/users").then((r) => r.json()).then(setUsers);
  }, []);

  useEffect(() => { fetchWeeks(); }, [fetchWeeks]);

  useEffect(() => {
    if (!selectedTaskId) { setSelectedTask(null); return; }
    fetch(`/api/tasks/${selectedTaskId}`).then((r) => r.json()).then(setSelectedTask);
  }, [selectedTaskId]);

  async function updatePublishDate(taskId: string, value: string) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publishDate: value || null }),
    });
    fetchWeeks();
  }

  function goPrev() { setAnchor((a) => addDaysToKey(a, -7 * WEEK_COUNT)); }
  function goNext() { setAnchor((a) => addDaysToKey(a, 7 * WEEK_COUNT)); }
  function goToday() { setAnchor(getCurrentWeekRange().start); }

  const isCurrentWindow = anchor === getCurrentWeekRange().start;

  return (
    <div className="min-h-screen bg-transparent w-full pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">Calendário de Entregas</h1>
        <div className="flex items-center gap-2">
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 focus:outline-none focus:border-accent/50"
          >
            <option value="">Todos os clientes</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="flex items-center bg-white border border-gray-200 rounded-lg">
            <button onClick={goPrev} className="p-1.5 hover:bg-gray-100 rounded-l-lg text-gray-500" title="Semanas anteriores"><ChevronLeft size={15} /></button>
            {!isCurrentWindow && (
              <button onClick={goToday} className="px-2 py-1.5 text-[11px] font-medium text-accent hover:text-accent-dark flex items-center gap-1" title="Semana atual">
                <RotateCcw size={11} /> Hoje
              </button>
            )}
            <button onClick={goNext} className="p-1.5 hover:bg-gray-100 rounded-r-lg text-gray-500" title="Próximas semanas"><ChevronRight size={15} /></button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-accent" /></div>
      ) : (
        <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1">
          {weeks.map((week, idx) => (
            <div key={week.start} className="snap-start shrink-0 w-[85vw] sm:w-[320px] bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Semana {idx + 1}</p>
                  <p className="text-[11px] text-gray-400">{formatDateKeyBR(week.start)} – {formatDateKeyBR(week.end)}</p>
                </div>
                <button
                  onClick={() => setCreateFor({ weekStart: week.start })}
                  className="p-1.5 rounded-lg hover:bg-white text-gray-400 hover:text-accent-dark transition-colors"
                  title="Adicionar tarefa nesta semana"
                >
                  <Plus size={14} />
                </button>
              </div>

              <div className="flex-1 divide-y divide-gray-50">
                {week.tasks.length === 0 ? (
                  <p className="text-[11px] text-gray-400 text-center py-6">Sem entregas nesta semana.</p>
                ) : (
                  week.tasks.map((task) => (
                    <div key={task.id} className="px-3 py-2 group">
                      <div className="flex items-start justify-between gap-2">
                        <button onClick={() => setSelectedTaskId(task.id)} className="flex-1 min-w-0 text-left">
                          <p className="text-xs font-medium text-gray-800 truncate hover:text-accent-dark transition-colors">{task.title}</p>
                          <p className="text-[10px] text-gray-400 truncate">
                            {task.type ? deliveryTypeLabel(task.type) : "—"}
                            {task.client && <ClientIdentity client={task.client} size={16} />}
                            {task.isExtra ? " · Extra" : ""}
                          </p>
                        </button>
                        <span className={cn("shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap", statusColor(task.status))}>
                          {statusLabel(task.status)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <CalendarIcon size={10} className="text-gray-300" />
                        <input
                          type="date"
                          defaultValue={task.publishDate.slice(0, 10)}
                          onBlur={(e) => { if (e.target.value !== task.publishDate.slice(0, 10)) updatePublishDate(task.id, e.target.value); }}
                          className="text-[10px] text-gray-400 bg-transparent outline-none"
                        />
                        <button onClick={() => updatePublishDate(task.id, "")} className="text-[10px] text-gray-300 hover:text-red-500 ml-1" title="Remover do calendário (mantém a tarefa)">
                          remover
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {clientFilter && (
                <div className="border-t border-gray-100 bg-gray-50 px-3 py-2.5">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-1.5">Demanda da semana</p>
                  {week.comparison ? (
                    <div className="space-y-1.5">
                      {week.comparison.filter((c) => c.configured || c.programmed > 0).map((c) => (
                        <div key={c.deliveryType} className="text-[11px]">
                          <div className="flex items-center justify-between text-gray-600">
                            <span className="font-medium">{c.label}</span>
                            <span>{c.completed}/{c.programmed} prog. · {c.contracted} contrat.</span>
                          </div>
                          {c.missingToProgram > 0 && (
                            <p className="text-accent-dark flex items-center gap-1"><AlertTriangle size={10} /> Falta programar {c.missingToProgram}</p>
                          )}
                          {c.programmedPendingCompletion > 0 && (
                            <p className="text-blue-600">Programado(s) a concluir: {c.programmedPendingCompletion}</p>
                          )}
                          {c.extra > 0 && <p className="text-purple-600">Extras: {c.extra}</p>}
                          {c.unflaggedExcess > 0 && (
                            <p className="text-red-600 flex items-center gap-1"><AlertTriangle size={10} /> {c.unflaggedExcess} acima do combinado sem marcação de extra</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-gray-400">Demanda semanal não configurada para este cliente.</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <CreateTaskModal
        open={!!createFor}
        onClose={() => setCreateFor(null)}
        onCreated={fetchWeeks}
        users={users}
        clients={clients}
        initialClientId={clientFilter || undefined}
        initialPublishDate={createFor?.weekStart}
      />

      <TaskDetailModal
        open={!!selectedTask}
        onClose={() => setSelectedTaskId(null)}
        task={selectedTask}
        onUpdated={() => { fetchWeeks(); setSelectedTaskId(null); }}
        users={users}
        clients={clients}
      />
    </div>
  );
}
