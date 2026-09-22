"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/auth-context";
import { TaskDetailModal } from "@/components/tasks/task-detail-modal";
import { CreateTaskModal } from "@/components/tasks/create-task-modal";
import { TaskRow } from "@/components/tasks/task-row";
import { TaskListHeader } from "@/components/tasks/task-list-header";
import { Avatar } from "@/components/ui/avatar";
import { type TaskData } from "@/lib/types";
import { getTaskBucket } from "@/lib/dates";
import { sortTasks, type SortKey, type SortState } from "@/lib/task-sort";
import {
  Loader2, Plus, Bell, CheckSquare, AtSign, ArrowLeftRight, ExternalLink, Check, CheckCheck,
  ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown,
} from "lucide-react";
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

interface ClientInfo { id: string; name: string; status: string }

interface ClientGroup {
  id: string;
  name: string;
  logoUrl?: string | null;
  active: boolean;
  tasks: TaskData[];
  overdue: number;
}

export default function MeuTrabalhoPage() {
  const { user } = useAuth();
  const [area, setArea] = useState<"tasks" | "notifications">("tasks");

  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; image?: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<TaskData | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [tab, setTab] = useState<TabKey>("ALL");
  const [clientFilter, setClientFilter] = useState("");
  const [sort, setSort] = useState<SortState>({ key: "dueDate", dir: "asc" });
  // Clientes nascem fechados na aba Concluídas: as tarefas aparecem ao clicar no cliente.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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
    fetch("/api/clients").then((r) => r.json()).then((d) =>
      setClients(d.map((c: ClientInfo) => ({ id: c.id, name: c.name, status: c.status })))
    );
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
    return groups;
  }, [scopedTasks]);

  const totalActive = buckets.ALL.length;
  const totalDone = buckets.COMPLETED.filter((t) => t.status === "COMPLETED").length;
  const completionRate = totalActive + totalDone > 0 ? Math.round((totalDone / (totalActive + totalDone)) * 100) : 0;

  const displayedTasks = useMemo(() => sortTasks(buckets[tab], sort), [buckets, tab, sort]);

  function handleSort(key: SortKey) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  // Só a aba Concluídas, que acumula, fica agrupada por cliente.
  const { activeGroups, inactiveGroups } = useMemo(() => {
    const statusById = new Map(clients.map((c) => [c.id, c.status]));
    const groups = new Map<string, ClientGroup>();
    for (const task of displayedTasks) {
      const id = task.client?.id ?? "no-client";
      let group = groups.get(id);
      if (!group) {
        group = {
          id,
          name: task.client?.name ?? "Sem cliente",
          logoUrl: task.client?.logoUrl,
          active: id === "no-client" || statusById.get(id) !== "INACTIVE",
          tasks: [],
          overdue: 0,
        };
        groups.set(id, group);
      }
      group.tasks.push(task);
      if (getTaskBucket(task) === "OVERDUE") group.overdue++;
    }
    const list = [...groups.values()].sort((a, b) =>
      a.id === "no-client" ? 1 : b.id === "no-client" ? -1 : a.name.localeCompare(b.name)
    );
    return { activeGroups: list.filter((g) => g.active), inactiveGroups: list.filter((g) => !g.active) };
  }, [displayedTasks, clients]);

  const allGroups = [...activeGroups, ...inactiveGroups];
  const allExpanded = allGroups.length > 0 && allGroups.every((g) => expanded[g.id]);

  function toggleAll() {
    setExpanded(allExpanded ? {} : Object.fromEntries(allGroups.map((g) => [g.id, true])));
  }

  function handleRowUpdated(updated: TaskData) {
    setSelectedTask((current) => current?.id === updated.id ? updated : current);
    setTasks((prev) => {
      if (user?.id && !updated.assignees.some((assignee) => assignee.user.id === user.id)) {
        return prev.filter((task) => task.id !== updated.id);
      }
      return prev.map((task) => (task.id === updated.id ? updated : task));
    });
  }
  function handleRowCloned(clone: TaskData) {
    setTasks((prev) => [clone, ...prev]);
  }

  function markRead(n: NotificationItem) {
    if (n.read) return;
    setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    setUnreadCount((c) => Math.max(0, c - 1));
    fetch(`/api/notifications/${n.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    }).catch(() => {});
  }

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    }).catch(() => {});
  }

  async function openNotification(n: NotificationItem) {
    markRead(n);
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

  function GroupList({ groups }: { groups: ClientGroup[] }) {
    return (
      <div className="space-y-2">
        {groups.map((g) => {
          const open = !!expanded[g.id];
          return (
            <div key={g.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpanded((prev) => ({ ...prev, [g.id]: !prev[g.id] }))}
                aria-expanded={open}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left"
              >
                {open ? <ChevronDown size={15} className="text-gray-400 shrink-0" /> : <ChevronRight size={15} className="text-gray-400 shrink-0" />}
                <Avatar name={g.name} image={g.logoUrl} size={24} className="object-contain shrink-0" />
                <span className="flex-1 min-w-0 text-sm font-semibold text-gray-800 truncate">{g.name}</span>
                {g.overdue > 0 && (
                  <span className="text-[11px] font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full shrink-0">
                    {g.overdue} {g.overdue === 1 ? "atrasada" : "atrasadas"}
                  </span>
                )}
                <span className="text-[11px] text-gray-400 shrink-0">
                  {g.tasks.length} {g.tasks.length === 1 ? "tarefa" : "tarefas"}
                </span>
              </button>
              {open && (
                <div className="border-t border-gray-100">
                  <TaskListHeader sort={sort} onSort={handleSort} showClient={false} />
                  {g.tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      users={users}
                      showClient={false}
                      onUpdated={handleRowUpdated}
                      onCloned={handleRowCloned}
                      onOpenDetail={setSelectedTask}
                    />
                  ))}
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
              {tab === "COMPLETED" && (
                <button
                  onClick={toggleAll}
                  disabled={allGroups.length === 0}
                  title={allExpanded ? "Recolher todos" : "Expandir todos"}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border bg-white border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all disabled:opacity-50"
                >
                  {allExpanded ? <ChevronsDownUp size={13} /> : <ChevronsUpDown size={13} />}
                  {allExpanded ? "Recolher" : "Expandir"}
                </button>
              )}
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

          {loading ? (
            <div className="flex items-center justify-center py-16 bg-white border border-gray-200 rounded-xl"><Loader2 size={24} className="animate-spin text-accent" /></div>
          ) : displayedTasks.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-14 bg-white border border-gray-200 rounded-xl">Nenhuma tarefa nesta aba.</p>
          ) : tab !== "COMPLETED" ? (
            // Abas do dia a dia: lista direta. Só as concluídas, que acumulam, ficam por cliente.
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <TaskListHeader sort={sort} onSort={handleSort} />
              {displayedTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  users={users}
                  onUpdated={handleRowUpdated}
                  onCloned={handleRowCloned}
                  onOpenDetail={setSelectedTask}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {activeGroups.length > 0 && (
                <section>
                  <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Clientes ativos ({activeGroups.length})</h2>
                  {/* Chamado como função: como componente interno, remontaria as linhas a cada
                      render e fecharia os menus abertos (etiquetas, status, transferir). */}
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
        </>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {unreadCount > 0 && (
            <div className="flex justify-end px-4 py-2 border-b border-gray-100">
              <button onClick={markAllRead} className="flex items-center gap-1 text-[11px] font-medium text-accent hover:text-accent-dark">
                <CheckCheck size={13} /> Marcar todas como lidas
              </button>
            </div>
          )}
          {notifLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-accent" /></div>
          ) : notifications.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-14">Nenhuma notificação por aqui.</p>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={cn(
                  "flex items-start gap-1 pr-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors",
                  !n.read && "bg-accent/5"
                )}
              >
                <button onClick={() => openNotification(n)} className="flex-1 min-w-0 flex items-start gap-3 text-left pl-4 py-3">
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
                {!n.read && (
                  <button
                    type="button"
                    onClick={() => markRead(n)}
                    title="Marcar como lida"
                    aria-label="Marcar como lida"
                    className="mt-2.5 p-1.5 rounded-md text-gray-300 hover:text-emerald-600 hover:bg-emerald-50 shrink-0 transition-colors"
                  >
                    <Check size={15} />
                  </button>
                )}
              </div>
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
