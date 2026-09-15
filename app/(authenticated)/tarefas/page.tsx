"use client";

import { Avatar } from "@/components/ui/avatar";
import { useState, useEffect, useCallback, useMemo } from "react";
import { CreateTaskModal } from "@/components/tasks/create-task-modal";
import { TaskDetailModal } from "@/components/tasks/task-detail-modal";
import { TaskRow } from "@/components/tasks/task-row";
import { SelectField } from "@/components/ui/select-field";
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from "@/lib/task-templates";
import { AREAS, areaInfo } from "@/lib/areas";
import { type TaskData } from "@/lib/types";
import {
  Plus, Filter, ArrowUpDown, Loader2, ChevronDown, ChevronRight, Briefcase, User, Search,
  ChevronsDownUp, ChevronsUpDown, Layers, FolderKanban,
} from "lucide-react";
import Link from "next/link";

type GroupBy = "client" | "assignee" | "area" | "project";

const GROUP_OPTIONS: { key: GroupBy; label: string; icon: typeof User; search: string }[] = [
  { key: "client", label: "Cliente", icon: Briefcase, search: "Buscar cliente" },
  { key: "assignee", label: "Responsável", icon: User, search: "Buscar responsável" },
  { key: "area", label: "Área", icon: Layers, search: "Buscar área" },
  { key: "project", label: "Projeto", icon: FolderKanban, search: "Buscar projeto" },
];

interface TaskGroup {
  id: string;
  name: string;
  tasks: TaskData[];
  order: number;
  color?: string;
  image?: string | null;
}

// Grupos "sem X" sempre por último.
const LAST = 999;

export default function TarefasPage() {
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; email?: string | null; image?: string | null }[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string; image?: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskData | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const [groupBy, setGroupBy] = useState<GroupBy>("client");
  // Grupos nascem fechados: a lista serve primeiro para achar o cliente, depois as tarefas.
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [groupSearch, setGroupSearch] = useState("");

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
    const groups: Record<string, TaskGroup> = {};

    function push(key: string, init: Omit<TaskGroup, "tasks">, task: TaskData) {
      if (!groups[key]) groups[key] = { ...init, tasks: [] };
      groups[key].tasks.push(task);
    }

    activeTasks.forEach((task) => {
      if (groupBy === "client") {
        const id = task.client?.id || "no-client";
        push(id, { id, name: task.client?.name || "Sem cliente", order: task.client ? 0 : LAST, image: task.client?.logoUrl }, task);
      } else if (groupBy === "assignee") {
        const assignee = task.assignees[0]?.user;
        const id = assignee?.id || "unassigned";
        push(id, { id, name: assignee?.name || "Sem responsável", order: assignee ? 0 : LAST, image: assignee?.image }, task);
      } else if (groupBy === "area") {
        const info = areaInfo(task.area);
        const id = info?.value || "no-area";
        push(id, { id, name: info?.label || "Sem área", order: info ? AREAS.indexOf(info) : LAST, color: info?.bar }, task);
      } else {
        const id = task.project?.id || "no-project";
        push(id, { id, name: task.project?.name || "Sem projeto", order: task.project ? 0 : LAST }, task);
      }
    });

    const term = groupSearch.trim().toLowerCase();
    return Object.values(groups)
      .filter((g) => !term || g.name.toLowerCase().includes(term))
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  }, [tasks, groupBy, groupSearch]);

  const toggleGroup = (id: string) => setExpandedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  const allExpanded = groupedTasks.length > 0 && groupedTasks.every((g) => expandedGroups[g.id]);
  const toggleAll = () =>
    setExpandedGroups(allExpanded ? {} : Object.fromEntries(groupedTasks.map((g) => [g.id, true])));

  const searchPlaceholder = GROUP_OPTIONS.find((o) => o.key === groupBy)?.search ?? "Buscar";

  function GroupIcon({ group }: { group: TaskGroup }) {
    if (groupBy === "client") return <Avatar name={group.name} image={group.image} size={22} className="object-contain" />;
    if (groupBy === "assignee") return <Avatar name={group.name} image={group.image} size={22} className="text-[10px]" />;
    if (groupBy === "area") return <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: group.color ?? "#d1d5db" }} />;
    return <FolderKanban size={14} className="text-gray-400" />;
  }

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
            {GROUP_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setGroupBy(opt.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  groupBy === opt.key ? "bg-accent text-white" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <opt.icon size={13} /> {opt.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={groupSearch}
              onChange={(e) => setGroupSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-44 pl-7 pr-2 py-1.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-accent/50"
            />
          </div>

          <button
            onClick={toggleAll}
            title={allExpanded ? "Recolher todos" : "Expandir todos"}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border bg-white border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all"
          >
            {allExpanded ? <ChevronsDownUp size={13} /> : <ChevronsUpDown size={13} />}
            {allExpanded ? "Recolher" : "Expandir"}
          </button>

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
            const isCollapsed = !expandedGroups[group.id];
            return (
              <div
                key={group.id}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden"
                style={group.color ? { borderLeft: `4px solid ${group.color}` } : undefined}
              >
                <button onClick={() => toggleGroup(group.id)} aria-expanded={!isCollapsed} className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-2">
                    <GroupIcon group={group} />
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
