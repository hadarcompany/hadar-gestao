"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { TaskDetailModal } from "@/components/tasks/task-detail-modal";
import { type TaskData } from "@/lib/types";
import { Loader2, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Calendar, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { startOfWeek, endOfWeek, addWeeks, subWeeks, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function TarefasConcluidasPage() {
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<TaskData | null>(null);
  const [weekDate, setWeekDate] = useState(new Date());

  const weekStart = startOfWeek(weekDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weekDate, { weekStartsOn: 1 });

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tasks?sort=updatedAt&order=desc");
      const data = await res.json();
      setTasks(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetch("/api/users").then((r) => r.json()).then(setUsers);
    fetch("/api/clients").then((r) => r.json()).then((d) =>
      setClients(d.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))
    );
  }, [fetchTasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (t.status !== "COMPLETED" && t.status !== "CANCELLED") return false;
      const updated = new Date(t.updatedAt);
      return updated >= weekStart && updated <= weekEnd;
    });
  }, [tasks, weekStart, weekEnd]);

  const completedCount = filteredTasks.filter((t) => t.status === "COMPLETED").length;
  const cancelledCount = filteredTasks.filter((t) => t.status === "CANCELLED").length;

  return (
    <div className="min-h-screen bg-transparent w-full pb-10">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-4">
        <div>
          <Link href="/tarefas" className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-[#FF5A00] transition-colors mb-2">
            <ArrowLeft size={14} /> Voltar para Tarefas
          </Link>
          <h1 className="text-3xl font-bold text-white tracking-tight">Histórico de Tarefas</h1>
          <p className="text-zinc-500 mt-1">Tarefas concluídas e canceladas</p>
        </div>

        {/* Week navigator */}
        <div className="flex items-center gap-3 bg-zinc-900/80 backdrop-blur-md border border-zinc-800 rounded-xl p-2">
          <button onClick={() => setWeekDate(subWeeks(weekDate, 1))}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
            <ChevronLeft size={18} />
          </button>
          <div className="text-center min-w-[200px]">
            <p className="text-sm font-medium text-white">
              {format(weekStart, "dd MMM", { locale: ptBR })} — {format(weekEnd, "dd MMM yyyy", { locale: ptBR })}
            </p>
          </div>
          <button onClick={() => setWeekDate(addWeeks(weekDate, 1))}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span className="text-sm font-medium text-emerald-300">{completedCount} concluída{completedCount !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl">
          <XCircle size={16} className="text-red-400" />
          <span className="text-sm font-medium text-red-300">{cancelledCount} cancelada{cancelledCount !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Task list */}
      {loading ? (
        <div className="flex items-center justify-center py-20 bg-zinc-900/40 border border-zinc-800/50 rounded-2xl">
          <Loader2 size={32} className="animate-spin text-[#FF5A00]" />
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-zinc-900/40 border border-zinc-800/50 rounded-2xl">
          <Calendar size={32} className="text-zinc-600 mb-3" />
          <h3 className="text-lg font-medium text-white mb-2">Nenhuma tarefa nesta semana</h3>
          <p className="text-sm text-zinc-500">Navegue para outra semana para ver o histórico.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTasks.map((task) => {
            const isCompleted = task.status === "COMPLETED";
            const assigneeName = task.assignees?.[0]?.user?.name || "Não atribuído";

            return (
              <div key={task.id} onClick={() => setSelectedTask(task)}
                className="group flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-zinc-900/80 backdrop-blur-md border border-zinc-800/60 hover:bg-zinc-800/80 hover:border-zinc-700 transition-all cursor-pointer">
                <div className="flex items-center gap-4 flex-1">
                  {isCompleted ? (
                    <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle size={18} className="text-red-400 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs text-zinc-500 mb-0.5">{task.client?.name || "Projeto Interno"}</p>
                    <p className="text-sm font-medium text-zinc-300 truncate">{task.title}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-400 border border-zinc-700">
                      {assigneeName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs text-zinc-500 hidden md:block">{assigneeName}</span>
                  </div>
                  <span className="text-xs text-zinc-600">
                    {new Date(task.updatedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TaskDetailModal
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        task={selectedTask}
        onUpdated={() => { fetchTasks(); setSelectedTask(null); }}
        users={users}
        clients={clients}
      />
    </div>
  );
}
