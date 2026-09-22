"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { TaskDetailModal } from "@/components/tasks/task-detail-modal";
import { Avatar } from "@/components/ui/avatar";
import { type TaskData } from "@/lib/types";
import {
  Loader2, ChevronLeft, ChevronRight, ChevronDown, CheckCircle2, XCircle, ArrowLeft, Search, History,
} from "lucide-react";
import Link from "next/link";
import { startOfWeek, endOfWeek, addWeeks, subWeeks, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ClientInfo { id: string; name: string; status: string }

interface ClientGroup {
  id: string;
  name: string;
  logoUrl?: string | null;
  active: boolean;
  tasks: TaskData[];
  completed: number;
  cancelled: number;
  last: number;
}

/** Quando a tarefa saiu da fila: conclusão, ou a última alteração para as canceladas. */
const finishedAt = (t: TaskData) => new Date(t.completedAt ?? t.updatedAt).getTime();

export default function TarefasConcluidasPage() {
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; image?: string | null }[]>([]);
  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<TaskData | null>(null);
  const [period, setPeriod] = useState<"all" | "week">("all");
  const [weekDate, setWeekDate] = useState(new Date());
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");

  const weekStart = startOfWeek(weekDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weekDate, { weekStartsOn: 1 });

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const [done, cancelled] = await Promise.all([
        fetch("/api/tasks?status=COMPLETED&sort=updatedAt&order=desc").then((r) => r.json()),
        fetch("/api/tasks?status=CANCELLED&sort=updatedAt&order=desc").then((r) => r.json()),
      ]);
      setTasks([...(Array.isArray(done) ? done : []), ...(Array.isArray(cancelled) ? cancelled : [])]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetch("/api/users").then((r) => r.json()).then(setUsers);
    fetch("/api/clients").then((r) => r.json()).then((d) =>
      setClients(d.map((c: ClientInfo) => ({ id: c.id, name: c.name, status: c.status })))
    );
  }, [fetchTasks]);

  const visibleTasks = useMemo(() => {
    if (period === "all") return tasks;
    const from = weekStart.getTime();
    const to = weekEnd.getTime();
    return tasks.filter((t) => finishedAt(t) >= from && finishedAt(t) <= to);
  }, [tasks, period, weekStart, weekEnd]);

  const { activeGroups, inactiveGroups } = useMemo(() => {
    const statusById = new Map(clients.map((c) => [c.id, c.status]));
    const groups = new Map<string, ClientGroup>();

    for (const task of visibleTasks) {
      const id = task.client?.id ?? "no-client";
      let group = groups.get(id);
      if (!group) {
        group = {
          id,
          name: task.client?.name ?? "Sem cliente",
          logoUrl: task.client?.logoUrl,
          active: id === "no-client" || statusById.get(id) !== "INACTIVE",
          tasks: [],
          completed: 0,
          cancelled: 0,
          last: 0,
        };
        groups.set(id, group);
      }
      group.tasks.push(task);
      if (task.status === "COMPLETED") group.completed++;
      else group.cancelled++;
      group.last = Math.max(group.last, finishedAt(task));
    }

    const term = search.trim().toLowerCase();
    const list = [...groups.values()]
      .filter((g) => !term || g.name.toLowerCase().includes(term))
      .map((g) => ({ ...g, tasks: [...g.tasks].sort((a, b) => finishedAt(b) - finishedAt(a)) }))
      .sort((a, b) => (a.id === "no-client" ? 1 : b.id === "no-client" ? -1 : a.name.localeCompare(b.name)));

    return { activeGroups: list.filter((g) => g.active), inactiveGroups: list.filter((g) => !g.active) };
  }, [visibleTasks, clients, search]);

  const completedCount = visibleTasks.filter((t) => t.status === "COMPLETED").length;
  const cancelledCount = visibleTasks.length - completedCount;

  function toggle(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handleTaskChanged(updated: TaskData) {
    setSelectedTask((current) => current?.id === updated.id ? updated : current);
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }

  function GroupList({ groups }: { groups: ClientGroup[] }) {
    return (
      <div className="space-y-2">
        {groups.map((g) => {
          const open = !!expanded[g.id];
          return (
            <div key={g.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => toggle(g.id)}
                aria-expanded={open}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
              >
                {open ? <ChevronDown size={15} className="text-gray-400 shrink-0" /> : <ChevronRight size={15} className="text-gray-400 shrink-0" />}
                <Avatar name={g.name} image={g.logoUrl} size={24} className="object-contain shrink-0" />
                <span className="flex-1 min-w-0 text-sm font-semibold text-gray-800 truncate">{g.name}</span>
                <span className="flex items-center gap-3 text-[11px] shrink-0">
                  <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 size={12} /> {g.completed}</span>
                  {g.cancelled > 0 && <span className="flex items-center gap-1 text-red-500"><XCircle size={12} /> {g.cancelled}</span>}
                  <span className="text-gray-400 hidden sm:inline">
                    última em {new Date(g.last).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                  </span>
                </span>
              </button>
              {open && (
                <div className="border-t border-gray-100">
                  {g.tasks.map((task) => {
                    const isCompleted = task.status === "COMPLETED";
                    const assignee = task.assignees?.[0]?.user;
                    return (
                      <div
                        key={task.id}
                        onClick={() => setSelectedTask(task)}
                        className="flex items-center gap-3 px-4 py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        {isCompleted
                          ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                          : <XCircle size={16} className="text-red-500 shrink-0" />}
                        <span className="flex-1 min-w-0 text-sm text-gray-700 truncate">{task.title}</span>
                        <span className="hidden md:flex items-center gap-1.5 text-xs text-gray-400 shrink-0">
                          <Avatar name={assignee?.name} image={assignee?.image} size={20} className="text-[9px]" />
                          {assignee?.name ?? "Não atribuído"}
                        </span>
                        <span className="text-xs text-gray-400 w-12 text-right shrink-0">
                          {new Date(finishedAt(task)).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent w-full pb-10">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-6 gap-4">
        <div>
          <Link href="/tarefas" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-accent transition-colors mb-2">
            <ArrowLeft size={14} /> Voltar para Tarefas
          </Link>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Histórico de Tarefas</h1>
          <p className="text-xs text-gray-400 mt-0.5">Concluídas e canceladas, por cliente. Clique no cliente para ver as tarefas.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente"
              className="w-44 pl-7 pr-2 py-1.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-accent/50"
            />
          </div>

          <div className="flex bg-white border border-gray-200 rounded-lg p-0.5">
            <button
              onClick={() => setPeriod("all")}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                period === "all" ? "bg-accent text-white" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100")}
            >
              <History size={13} /> Todo o histórico
            </button>
            <button
              onClick={() => setPeriod("week")}
              className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                period === "week" ? "bg-accent text-white" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100")}
            >
              Por semana
            </button>
          </div>

          {period === "week" && (
            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-0.5">
              <button onClick={() => setWeekDate(subWeeks(weekDate, 1))} aria-label="Semana anterior" className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md">
                <ChevronLeft size={15} />
              </button>
              <span className="text-xs font-medium text-gray-700 min-w-[150px] text-center">
                {format(weekStart, "dd MMM", { locale: ptBR })} — {format(weekEnd, "dd MMM yyyy", { locale: ptBR })}
              </span>
              <button onClick={() => setWeekDate(addWeeks(weekDate, 1))} aria-label="Próxima semana" className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md">
                <ChevronRight size={15} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <CheckCircle2 size={14} className="text-emerald-600" />
          <span className="text-xs font-medium text-emerald-600">{completedCount} concluída{completedCount !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg">
          <XCircle size={14} className="text-red-600" />
          <span className="text-xs font-medium text-red-600">{cancelledCount} cancelada{cancelledCount !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-accent" /></div>
      ) : activeGroups.length + inactiveGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white border border-gray-200 border-dashed rounded-xl">
          <History size={26} className="text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-900 mb-1">Nenhuma tarefa encontrada</p>
          <p className="text-xs text-gray-400">{period === "week" ? "Navegue para outra semana ou veja todo o histórico." : "Ajuste a busca por cliente."}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {activeGroups.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Clientes ativos ({activeGroups.length})</h2>
              {GroupList({ groups: activeGroups })}
            </section>
          )}
          {inactiveGroups.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Clientes inativos ({inactiveGroups.length})</h2>
              {GroupList({ groups: inactiveGroups })}
            </section>
          )}
        </div>
      )}

      <TaskDetailModal
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        task={selectedTask}
        onAttachmentsChanged={fetchTasks}
        onUpdated={() => { fetchTasks(); setSelectedTask(null); }}
        onTaskChanged={handleTaskChanged}
        users={users}
        clients={clients}
      />
    </div>
  );
}
