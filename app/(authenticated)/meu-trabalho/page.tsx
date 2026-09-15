"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/auth-context";
import { TaskDetailModal } from "@/components/tasks/task-detail-modal";
import { CreateTaskModal } from "@/components/tasks/create-task-modal";
import { TaskRow } from "@/components/tasks/task-row";
import { Avatar } from "@/components/ui/avatar";
import { type TaskData } from "@/lib/types";
import { getTaskBucket } from "@/lib/dates";
import { Loader2, Plus, Bell, CheckSquare, AtSign, ArrowLeftRight, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

type TabKey = "ALL" | "TODAY" | "OVERDUE" | "UPCOMING" | "COMPLETED";

const TABS: { key: TabKey; label: string }[] = [
  { key: "ALL", label: "Todas" },
  { key: "TODAY", label: "Hoje" },
  { key: "OVERDUE", label: "Atrasadas" },
  { key: "UPCOMING", label: "Próximas" },
  { key: "COMPLETED", label: "Concluídas" },
];

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  taskId: string | null;
  clientId: string | null;
  read: boolean;
  createdAt: string;
}

export default function MeuTrabalhoPage() {
  const { user } = useAuth();
  const [area, setArea] = useState<"tasks" | "notifications">("tasks");

  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string; image?: string | null }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; image?: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<TaskData | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [tab, setTab] = useState<TabKey>("ALL");
  const [clientFilter, setClientFilter] = useState("");

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks?assigneeId=${user.id}`);
      setTasks(await res.json());
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const fetchNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const res = await fetch("/api/notifications");
      const d = await res.json();
      setNotifications(d.notifications ?? []);
      setUnreadCount(d.unreadCount ?? 0);
    } finally {
      setNotifLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchNotifications();
    fetch("/api/clients").then((r) => r.json()).then((d) => setClients(d.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))));
    fetch("/api/users").then((r) => r.json()).then(setUsers);
  }, [fetchTasks, fetchNotifications]);

  const scopedTasks = useMemo(
    () => (clientFilter ? tasks.filter((t) => t.clientId === clientFilter) : tasks),
    [tasks, clientFilter]
  );

  const buckets = useMemo(() => {
    const groups: Record<TabKey, TaskData[]> = { ALL: [], TODAY: [], OVERDUE: [], UPCOMING: [], COMPLETED: [] };
    scopedTasks.forEach((task) => {
      const bucket = getTaskBucket(task);
      if (bucket === "CANCELLED") return; // preserva o registro, mas não ocupa a área de trabalho pessoal
      if (bucket === "COMPLETED") { groups.COMPLETED.push(task); return; }
      groups.ALL.push(task);
      if (bucket === "TODAY") groups.TODAY.push(task);
      else if (bucket === "OVERDUE") groups.OVERDUE.push(task);
      else groups.UPCOMING.push(task);
    });
    const byDueAsc = (a: TaskData, b: TaskData) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    };
    groups.ALL.sort(byDueAsc);
    groups.TODAY.sort(byDueAsc);
    groups.OVERDUE.sort(byDueAsc);
    groups.UPCOMING.sort(byDueAsc);
    groups.COMPLETED.sort((a, b) => new Date(b.completedAt ?? b.updatedAt).getTime() - new Date(a.completedAt ?? a.updatedAt).getTime());
    return groups;
  }, [scopedTasks]);

  const totalActive = buckets.ALL.length;
  const totalDone = buckets.COMPLETED.filter((t) => t.status === "COMPLETED").length;
  const completionRate = totalActive + totalDone > 0 ? Math.round((totalDone / (totalActive + totalDone)) * 100) : 0;

  const displayedTasks = buckets[tab];

  function handleRowUpdated(updated: TaskData) {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }
  function handleRowCloned(clone: TaskData) {
    setTasks((prev) => [clone, ...prev]);
  }

  async function markNotificationRead(n: NotificationItem) {
    if (!n.read) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
      await fetch(`/api/notifications/${n.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ read: true }) }).catch(() => {});
    }
    if (n.taskId) {
      const res = await fetch(`/api/tasks/${n.taskId}`);
      if (res.ok) setSelectedTask(await res.json());
    }
  }

  const notifIcon = (type: string) => {
    if (type === "MENTION") return <AtSign size={14} className="text-blue-600" />;
    if (type === "TRANSFER") return <ArrowLeftRight size={14} className="text-accent-dark" />;
    return <Bell size={14} className="text-gray-400" />;
  };

  return (
    <div className="min-h-screen bg-transparent w-full pb-10">
      {/* PERFIL COMPACTO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <Avatar name={user?.name} image={user?.image} size={48} className="text-lg" />
          <div>
            <p className="text-base font-bold text-gray-900 leading-tight">{user?.name}</p>
            <p className="text-xs text-gray-400">{user?.role === "ADMIN" ? "Administrador" : "Membro da equipe"}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-center">
          <div>
            <p className="text-lg font-bold text-gray-900">{totalActive + totalDone}</p>
            <p className="text-[11px] text-gray-400">Total{clientFilter ? " (filtro)" : ""}</p>
          </div>
          <div>
            <p className="text-lg font-bold text-emerald-600">{totalDone}</p>
            <p className="text-[11px] text-gray-400">Concluídas</p>
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">{totalActive}</p>
            <p className="text-[11px] text-gray-400">Pendentes</p>
          </div>
          <div>
            <p className="text-lg font-bold text-accent-dark">{completionRate}%</p>
            <p className="text-[11px] text-gray-400">Concluído</p>
          </div>
        </div>
      </div>

      {/* ALTERNADOR DE ÁREA */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setArea("tasks")}
          className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
            area === "tasks" ? "bg-accent text-white" : "bg-white border border-gray-200 text-gray-500 hover:text-gray-900")}
        >
          <CheckSquare size={14} /> Minhas tarefas
        </button>
        <button
          onClick={() => setArea("notifications")}
          className={cn("relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
            area === "notifications" ? "bg-accent text-white" : "bg-white border border-gray-200 text-gray-500 hover:text-gray-900")}
        >
          <Bell size={14} /> Notificações
          {unreadCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {area === "tasks" ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border",
                    tab === t.key ? "bg-accent/10 border-accent/30 text-accent-dark" : "bg-white border-gray-200 text-gray-500 hover:text-gray-900"
                  )}
                >
                  {t.label}
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", tab === t.key ? "bg-accent/20" : "bg-gray-100")}>
                    {buckets[t.key].length}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                className="text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 focus:outline-none focus:border-accent/50"
              >
                <option value="">Todos os clientes</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-accent hover:bg-accent-dark text-white rounded-lg transition-colors"
              >
                <Plus size={14} /> Nova
              </button>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-accent" /></div>
            ) : displayedTasks.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-14">Nenhuma tarefa nesta aba.</p>
            ) : (
              displayedTasks.map((task) => (
                <TaskRow key={task.id} task={task} users={users} onUpdated={handleRowUpdated} onCloned={handleRowCloned} onOpenDetail={setSelectedTask} />
              ))
            )}
          </div>
        </>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {notifLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-accent" /></div>
          ) : notifications.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-14">Nenhuma notificação por aqui.</p>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => markNotificationRead(n)}
                className={cn(
                  "w-full flex items-start gap-3 text-left px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors",
                  !n.read && "bg-accent/5"
                )}
              >
                <span className="mt-0.5 shrink-0">{notifIcon(n.type)}</span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2">
                    <span className={cn("text-sm truncate", n.read ? "text-gray-600" : "text-gray-900 font-semibold")}>{n.title}</span>
                    {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />}
                  </span>
                  {n.body && <span className="block text-xs text-gray-400 mt-0.5 truncate">{n.body}</span>}
                  <span className="block text-[11px] text-gray-300 mt-1">{new Date(n.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                </span>
                {n.taskId && <ExternalLink size={13} className="text-gray-300 shrink-0 mt-1" />}
              </button>
            ))
          )}
        </div>
      )}

      <CreateTaskModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={fetchTasks} users={users} clients={clients} />

      <TaskDetailModal
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        task={selectedTask}
        onAttachmentsChanged={fetchTasks}
        onUpdated={() => { fetchTasks(); setSelectedTask(null); }}
        onTaskChanged={handleRowUpdated}
        users={users}
        clients={clients}
      />
    </div>
  );
}
