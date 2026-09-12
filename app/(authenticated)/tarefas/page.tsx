"use client";

import { Avatar } from "@/components/ui/avatar";
import { useState, useEffect, useCallback, useMemo } from "react";
import { CreateTaskModal } from "@/components/tasks/create-task-modal";
import { TaskDetailModal } from "@/components/tasks/task-detail-modal";
import { TaskRow } from "@/components/tasks/task-row";
import { SelectField } from "@/components/ui/select-field";
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from "@/lib/task-templates";
import { type TaskData } from "@/lib/types";
import { Plus, Filter, ArrowUpDown, Loader2, ChevronDown, ChevronRight, Briefcase, User } from "lucide-react";
import Link from "next/link";

export default function TarefasPage() {
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; image?: string | null }[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string; image?: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskData | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const [groupBy, setGroupBy] = useState<"client" | "assignee">("client");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const [filterStatus, setFilterStatus] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("");
  const [sortBy, setSortBy] = useState("dueDate");
  const [sortOrder, setSortOrder] = useState("asc");

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus) params.set("status", filterStatus);
    if (filterClient) params.set("clientId", filterClient);
    if (filterPriority) params.set("priority", filterPriority);
    if (filterAssignee) params.set("assigneeId", filterAssignee);
    params.set("sort", sortBy);
    params.set("order", sortOrder);

    try {
      const res = await fetch(`/api/tasks?${params}`);
      const data = await res.json();
      setTasks(data);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterClient, filterPriority, filterAssignee, sortBy, sortOrder]);

  useEffect(() => {
    fetchTasks();
    fetch("/api/users").then((r) => r.json()).then(setUsers);
    fetch("/api/clients").then((r) => r.json()).then((d) => setClients(d.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))));
  }, [fetchTasks]);

  function clearFilters() {
    setFilterStatus(""); setFilterClient(""); setFilterPriority(""); setFilterAssignee("");
  }

  const hasFilters = filterStatus || filterClient || filterPriority || filterAssignee;

  function handleRowUpdated(updated: TaskData) {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }

  function handleRowCloned(clone: TaskData) {
    setTasks((prev) => [clone, ...prev]);
  }

  const groupedTasks = useMemo(() => {
    const activeTasks = tasks.filter((t) => t.status !== "COMPLETED" && t.status !== "CANCELLED");
    const groups: Record<string, { id: string; name: string; tasks: TaskData[] }> = {};

    activeTasks.forEach((task) => {
      if (groupBy === "client") {
        const clientId = task.client?.id || "no-client";
        const clientName = task.client?.name || "Sem cliente";
        if (!groups[clientId]) groups[clientId] = { id: clientId, name: clientName, tasks: [] };
        groups[clientId].tasks.push(task);
      } else {
        const assignee = task.assignees[0]?.user;
        const assigneeId = assignee?.id || "unassigned";
        const assigneeName = assignee?.name || "Sem responsável";
        if (!groups[assigneeId]) groups[assigneeId] = { id: assigneeId, name: assigneeName, tasks: [] };
        groups[assigneeId].tasks.push(task);
      }
    });

    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks, groupBy]);

  const toggleGroup = (id: string) => setCollapsedGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="min-h-screen bg-transparent w-full pb-10">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-5 gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Tarefas</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {tasks.filter((t) => t.status !== "COMPLETED" && t.status !== "CANCELLED").length} ativas
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-white border border-gray-200 rounded-lg p-0.5">
            <button
              onClick={() => setGroupBy("client")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                groupBy === "client" ? "bg-accent text-white" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              <Briefcase size={13} /> Cliente
            </button>
            <button
              onClick={() => setGroupBy("assignee")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                groupBy === "assignee" ? "bg-accent text-white" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              <User size={13} /> Responsável
            </button>
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all border ${
              showFilters || hasFilters ? "bg-accent/10 border-accent/30 text-accent-dark" : "bg-white border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            <Filter size={13} /> Filtrar
          </button>

          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-accent hover:bg-accent-dark text-white rounded-lg transition-colors"
          >
            <Plus size={15} /> Nova Tarefa
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <SelectField label="Status" value={filterStatus} onChange={setFilterStatus} placeholder="Todos" options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))} />
            <SelectField label="Cliente" value={filterClient} onChange={setFilterClient} placeholder="Todos" options={clients.map((c) => ({ value: c.id, label: c.name }))} />
            <SelectField label="Prioridade" value={filterPriority} onChange={setFilterPriority} placeholder="Todas" options={PRIORITY_OPTIONS.map((p) => ({ value: p.value, label: p.label }))} />
            <SelectField label="Responsável" value={filterAssignee} onChange={setFilterAssignee} placeholder="Todos" options={users.map((u) => ({ value: u.id, label: u.name }))} />
            <div className="space-y-1.5">
              <label className="block text-xs text-gray-400 uppercase tracking-wider font-semibold">Ordenar</label>
              <div className="flex gap-2">
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 appearance-none focus:outline-none focus:border-accent/50">
                  <option value="dueDate">Data</option>
                  <option value="priority">Prioridade</option>
                  <option value="createdAt">Criação</option>
                </select>
                <button onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors text-gray-500" title={sortOrder === "asc" ? "Crescente" : "Decrescente"}>
                  <ArrowUpDown size={14} />
                </button>
              </div>
            </div>
          </div>
          {hasFilters && (
            <div className="mt-3 flex justify-end">
              <button onClick={clearFilters} className="text-xs font-medium text-accent hover:text-accent-dark transition-colors">Limpar filtros</button>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-accent" /></div>
      ) : groupedTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white border border-gray-200 border-dashed rounded-xl">
          <h3 className="text-sm font-medium text-gray-900 mb-1">Nenhuma tarefa em andamento</h3>
          <p className="text-xs text-gray-400 mb-4">Crie a primeira tarefa ou ajuste os filtros.</p>
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 text-xs font-semibold bg-accent hover:bg-accent-dark text-white rounded-lg transition-colors">Criar Nova Tarefa</button>
        </div>
      ) : (
        <div className="space-y-3">
          {groupedTasks.map((group) => {
            const isCollapsed = collapsedGroups[group.id];
            return (
              <div key={group.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <button onClick={() => toggleGroup(group.id)} className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-2">
                    {groupBy === "client" ? <Avatar name={group.name} image={group.tasks[0]?.client?.logoUrl} size={22} className="object-contain" /> : <User size={13} className="text-gray-400" />}
                    <span className="text-sm font-semibold text-gray-800">{group.name}</span>
                    <span className="text-[11px] text-gray-400">({group.tasks.length})</span>
                  </div>
                  {isCollapsed ? <ChevronRight size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
                </button>
                {!isCollapsed && (
                  <div>
                    {group.tasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        users={users}
                        showClient={groupBy !== "client"}
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

          <div className="flex justify-center pt-4">
            <Link href="/tarefas-concluidas" className="text-xs font-medium text-gray-400 hover:text-accent transition-colors flex items-center gap-1">
              Ver histórico (concluídas/canceladas) <ChevronRight size={12} />
            </Link>
          </div>
        </div>
      )}

      <CreateTaskModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={fetchTasks} users={users} clients={clients} />

      <TaskDetailModal
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        task={selectedTask}
        onAttachmentsChanged={fetchTasks}
        onUpdated={() => { fetchTasks(); setSelectedTask(null); }}
        users={users}
        clients={clients}
      />
    </div>
  );
}
