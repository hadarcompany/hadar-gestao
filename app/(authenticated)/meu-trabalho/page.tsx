"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/auth-context";
import { TaskDetailModal } from "@/components/tasks/task-detail-modal";
import { CreateTaskModal } from "@/components/tasks/create-task-modal";
import { SelectField } from "@/components/ui/select-field";
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from "@/lib/task-templates";
import { type TaskData } from "@/lib/types";
import { type ChecklistItem } from "@/lib/task-templates";
import { Loader2, Plus, Calendar, Edit3, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

// ── helpers ────────────────────────────────────────────────────────

type QuickFilter = "all" | "overdue" | "today" | "week" | "month";

function getDeadlineBorder(dueDate: string | null): string {
  if (!dueDate) return "border-zinc-800/60";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  if (due < today) return "border-red-500/60";          // atrasada
  if (due.getTime() === today.getTime()) return "border-amber-500/60"; // hoje
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);
  if (due <= weekEnd) return "border-blue-500/60";       // esta semana
  const monthEnd = new Date(today);
  monthEnd.setMonth(today.getMonth() + 1);
  if (due <= monthEnd) return "border-green-500/60";     // este mês
  return "border-zinc-800/60";
}

function getChecklistProgress(checklist: ChecklistItem[] | null): number | null {
  if (!checklist || checklist.length === 0) return null;
  const done = checklist.filter((i) => i.checked).length;
  return Math.round((done / checklist.length) * 100);
}

function applyQuickFilter(tasks: TaskData[], filter: QuickFilter): TaskData[] {
  if (filter === "all") return tasks;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return tasks.filter((t) => {
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate);
    due.setHours(0, 0, 0, 0);
    if (filter === "overdue") return due < today;
    if (filter === "today") return due.getTime() === today.getTime();
    if (filter === "week") {
      const end = new Date(today); end.setDate(today.getDate() + 7);
      return due >= today && due <= end;
    }
    if (filter === "month") {
      const end = new Date(today); end.setMonth(today.getMonth() + 1);
      return due >= today && due <= end;
    }
    return true;
  });
}

const QUICK_FILTERS: { key: QuickFilter; label: string }[] = [
  { key: "all",     label: "Simples"   },
  { key: "overdue", label: "Atrasadas" },
  { key: "today",   label: "Hoje"      },
  { key: "week",    label: "Semana"    },
  { key: "month",   label: "Mês"       },
];

// ── component ──────────────────────────────────────────────────────

export default function MeuTrabalhoPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<TaskData | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterClient, setFilterClient] = useState("");

  const fetchTasks = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const params = new URLSearchParams();
    params.set("assigneeId", user!.id);
    if (filterStatus) params.set("status", filterStatus);
    if (filterPriority) params.set("priority", filterPriority);
    if (filterClient) params.set("clientId", filterClient);

    try {
      const res = await fetch(`/api/tasks?${params}`);
      setTasks(await res.json());
    } finally {
      setLoading(false);
    }
  }, [user?.id, filterStatus, filterPriority, filterClient]);

  useEffect(() => {
    fetchTasks();
    fetch("/api/clients").then((r) => r.json()).then((d) => setClients(d.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))));
    fetch("/api/users").then((r) => r.json()).then(setUsers);
  }, [fetchTasks]);

  const { activeTasks, stats } = useMemo(() => {
    const active: TaskData[] = [];
    const calcStats = { completed: 0, overdue: 0, upcoming: 0 };
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    tasks.forEach((task) => {
      const isCompleted = task.status === "COMPLETED" || task.status === "CANCELLED";
      if (isCompleted) {
        calcStats.completed++;
      } else {
        active.push(task);
        if (task.dueDate) {
          const due = new Date(task.dueDate);
          due.setHours(0, 0, 0, 0);
          if (due < today) calcStats.overdue++;
          else calcStats.upcoming++;
        } else {
          calcStats.upcoming++;
        }
      }
    });

    return { activeTasks: active, stats: calcStats };
  }, [tasks]);

  const displayedTasks = useMemo(
    () => applyQuickFilter(activeTasks, quickFilter),
    [activeTasks, quickFilter]
  );

  return (
    <div className="min-h-screen bg-transparent w-full pb-10">

      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Meu Trabalho{" "}
            <span className="text-zinc-500 font-normal">| {user?.name?.split(" ")[0] ?? ""}</span>
          </h1>
          <p className="text-zinc-400 mt-2 text-sm font-medium">Minhas Tarefas Ativas</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-2">
            <div className="w-36">
              <SelectField
                label=""
                value={filterPriority}
                onChange={setFilterPriority}
                placeholder="Por Urgência"
                options={PRIORITY_OPTIONS.map((p) => ({ value: p.value, label: p.label }))}
              />
            </div>
            <div className="w-40">
              <SelectField
                label=""
                value={filterClient}
                onChange={setFilterClient}
                placeholder="Por Cliente"
                options={clients.map((c) => ({ value: c.id, label: c.name }))}
              />
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-[#FF5A00] hover:bg-[#E04D00] text-white rounded-xl transition-colors shadow-lg shadow-[#FF5A00]/20 h-10"
          >
            <Plus size={18} />
            Nova Tarefa
          </button>
        </div>
      </div>

      {/* FILTROS RÁPIDOS */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {QUICK_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setQuickFilter(f.key)}
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border transition-all",
              quickFilter === f.key
                ? f.key === "overdue"
                  ? "bg-red-500/15 text-red-400 border-red-500/40"
                  : f.key === "today"
                  ? "bg-amber-500/15 text-amber-400 border-amber-500/40"
                  : f.key === "week"
                  ? "bg-blue-500/15 text-blue-400 border-blue-500/40"
                  : f.key === "month"
                  ? "bg-green-500/15 text-green-400 border-green-500/40"
                  : "bg-[#FF5A00]/15 text-[#FF5A00] border-[#FF5A00]/40"
                : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300"
            )}
          >
            {f.label}
          </button>
        ))}

        {/* legenda de cores */}
        <div className="ml-auto hidden lg:flex items-center gap-4 text-[11px] text-zinc-600">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />Atrasada</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" />Hoje</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" />Semana</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" />Mês</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">

        {/* LISTA DE TAREFAS */}
        <div className="xl:col-span-3 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-20 bg-zinc-900/40 border border-zinc-800/50 rounded-2xl">
              <Loader2 size={32} className="animate-spin text-[#FF5A00]" />
            </div>
          ) : displayedTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-zinc-900/40 border border-zinc-800/50 rounded-2xl">
              <h3 className="text-lg font-medium text-white mb-2">Nenhuma tarefa encontrada</h3>
              <p className="text-sm text-zinc-500">Tente outro filtro ou crie uma nova tarefa.</p>
            </div>
          ) : (
            displayedTasks.map((task) => {
              const statusOpt = STATUS_OPTIONS.find((s) => s.value === task.status);
              const isUrgent = String(task.priority).toLowerCase().includes("urgent");
              const borderColor = getDeadlineBorder(task.dueDate);
              const progress = getChecklistProgress(task.checklist);

              return (
                <div
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className={cn(
                    "group flex flex-col gap-3 p-4 rounded-xl bg-zinc-900/80 backdrop-blur-md border-2 hover:bg-zinc-800/80 transition-all cursor-pointer",
                    borderColor
                  )}
                >
                  {/* Linha principal */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1">
                      <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-[#FF5A00] text-white shrink-0 shadow-sm shadow-[#FF5A00]/20">
                        {statusOpt?.label || task.status}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs text-zinc-500 mb-0.5 font-medium">
                          {task.client?.name || "Projeto Interno"}
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-zinc-200 truncate">{task.title}</p>
                          {isUrgent && <span title="Prioridade Urgente" className="animate-pulse">🍌</span>}
                          <Edit3 size={14} className="text-zinc-600 group-hover:text-[#FF5A00] opacity-0 group-hover:opacity-100 transition-all hidden md:block" />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 md:gap-10 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-300 border border-zinc-700">
                          {user?.name?.charAt(0).toUpperCase() || "M"}
                        </div>
                        <span className="text-xs text-zinc-400 hidden md:block">Mim</span>
                      </div>

                      <div className="flex items-center gap-2 text-zinc-400 min-w-[90px] justify-end">
                        <div className="hidden md:block text-xs text-right">
                          <span className={isUrgent ? "text-red-400 font-medium" : ""}>
                            {task.dueDate
                              ? new Date(task.dueDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
                              : "—"}
                          </span>
                        </div>
                        <Calendar size={16} className={isUrgent ? "text-red-400" : "text-zinc-600"} />
                      </div>
                    </div>
                  </div>

                  {/* BARRA DE PROGRESSO (checklist) */}
                  {progress !== null && (
                    <div className="mt-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-zinc-500 font-medium">Progresso do checklist</span>
                        <span className="text-[11px] font-bold text-zinc-400">{progress}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            progress === 100
                              ? "bg-emerald-500"
                              : progress >= 50
                              ? "bg-blue-500"
                              : "bg-[#FF5A00]"
                          )}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* WIDGET RESUMO */}
        <div className="xl:col-span-1">
          <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60 rounded-2xl p-6 sticky top-6">
            <h2 className="text-sm font-semibold text-white mb-6">Resumo da Minha Semana</h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={18} className="text-emerald-500" />
                  <span className="text-sm font-medium text-emerald-100">Concluídas</span>
                </div>
                <span className="text-lg font-bold text-emerald-400">{stats.completed}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-[#FF5A00]/10 border border-[#FF5A00]/20">
                <div className="flex items-center gap-3">
                  <AlertTriangle size={18} className="text-[#FF5A00]" />
                  <span className="text-sm font-medium text-orange-100">Atrasadas</span>
                </div>
                <span className="text-lg font-bold text-[#FF5A00]">{stats.overdue}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <div className="flex items-center gap-3">
                  <Clock size={18} className="text-blue-500" />
                  <span className="text-sm font-medium text-blue-100">Próximas</span>
                </div>
                <span className="text-lg font-bold text-blue-400">{stats.upcoming}</span>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-zinc-800/50">
              <p className="text-xs text-zinc-500 text-center">
                Mantenha o foco! Priorize as tarefas com a 🍌.
              </p>
            </div>
          </div>
        </div>
      </div>

      <CreateTaskModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={fetchTasks}
        users={users}
        clients={clients}
      />

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
