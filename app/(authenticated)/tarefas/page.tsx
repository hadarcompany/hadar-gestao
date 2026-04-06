"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import { CreateTaskModal } from "@/components/tasks/create-task-modal";
import { TaskDetailModal } from "@/components/tasks/task-detail-modal";
import { SelectField } from "@/components/ui/select-field";
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from "@/lib/task-templates";
import { type TaskData } from "@/lib/types";
import { Plus, Filter, ArrowUpDown, Loader2, ChevronDown, ChevronRight, Calendar, Edit3, Briefcase, User } from "lucide-react";
import Link from "next/link";

export default function TarefasPage() {
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskData | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Nova Lógica de Visualização (Por Cliente ou Por Responsável)
  const [groupBy, setGroupBy] = useState<"client" | "assignee">("client");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Filters
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

  // Lógica para Agrupar e remover as Concluídas/Canceladas da visão principal
  const groupedTasks = useMemo(() => {
    // Filtra tarefas ativas (remove concluídas e canceladas)
    const activeTasks = tasks.filter(t => t.status !== "COMPLETED" && t.status !== "CANCELLED");

    const groups: Record<string, { id: string, name: string, tasks: TaskData[] }> = {};

    activeTasks.forEach(task => {
      if (groupBy === "client") {
        const clientId = task.client?.id || "no-client";
        const clientName = task.client?.name || "Outros Projetos";
        if (!groups[clientId]) groups[clientId] = { id: clientId, name: clientName, tasks: [] };
        groups[clientId].tasks.push(task);
      } else {
        // Pega o primeiro responsável ou define como Sem Responsável
        // Adapte "task.assignees" conforme o seu retorno da API
        const assignee = (task as any).assignees?.[0]?.user || (task as any).assignees?.[0]; 
        const assigneeId = assignee?.id || "unassigned";
        const assigneeName = assignee?.name || "Sem Responsável";
        if (!groups[assigneeId]) groups[assigneeId] = { id: assigneeId, name: assigneeName, tasks: [] };
        groups[assigneeId].tasks.push(task);
      }
    });

    return Object.values(groups);
  }, [tasks, groupBy]);

  const toggleGroup = (id: string) => {
    setCollapsedGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="min-h-screen bg-transparent w-full pb-10">
      
      {/* HEADER DA PÁGINA (Estilo Hadar) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Tarefas em Andamento</h1>
          <p className="text-zinc-500 mt-1">
            {tasks.length} tarefa{tasks.length !== 1 ? "s" : ""} ativa{tasks.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Seletor de Visualização */}
          <div className="flex bg-zinc-900/80 backdrop-blur-md rounded-xl border border-zinc-800 p-1">
            <button
              onClick={() => setGroupBy("client")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                groupBy === "client" 
                  ? "bg-[#FF5A00] text-white shadow-lg shadow-[#FF5A00]/20" 
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Briefcase size={16} /> Por Cliente
            </button>
            <button
              onClick={() => setGroupBy("assignee")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                groupBy === "assignee" 
                  ? "bg-[#FF5A00] text-white shadow-lg shadow-[#FF5A00]/20" 
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <User size={16} /> Por Responsável
            </button>
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all border ${
              showFilters || hasFilters
                ? "bg-[#FF5A00]/10 border-[#FF5A00]/30 text-[#FF5A00]"
                : "bg-zinc-900/80 backdrop-blur-md border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800/80"
            }`}
          >
            <Filter size={16} />
            Filtrar
          </button>
          
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-[#FF5A00] hover:bg-[#E04D00] text-white rounded-xl transition-colors shadow-lg shadow-[#FF5A00]/20"
          >
            <Plus size={18} />
            Nova Tarefa
          </button>
        </div>
      </div>

      {/* PAINEL DE FILTROS (Refinado) */}
      {showFilters && (
        <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60 rounded-2xl p-5 mb-8 animate-in fade-in slide-in-from-top-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <SelectField
              label="Status"
              value={filterStatus}
              onChange={setFilterStatus}
              placeholder="Todos"
              options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
            />
            <SelectField
              label="Cliente"
              value={filterClient}
              onChange={setFilterClient}
              placeholder="Todos"
              options={clients.map((c) => ({ value: c.id, label: c.name }))}
            />
            <SelectField
              label="Prioridade"
              value={filterPriority}
              onChange={setFilterPriority}
              placeholder="Todas"
              options={PRIORITY_OPTIONS.map((p) => ({ value: p.value, label: p.label }))}
            />
            <SelectField
              label="Responsável"
              value={filterAssignee}
              onChange={setFilterAssignee}
              placeholder="Todos"
              options={users.map((u) => ({ value: u.id, label: u.name }))}
            />
            <div className="space-y-1.5">
              <label className="block text-xs text-zinc-500 uppercase tracking-wider font-semibold">Ordenar</label>
              <div className="flex gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="flex-1 px-3 py-2 bg-zinc-950/50 border border-zinc-800 rounded-lg text-sm text-zinc-300 appearance-none focus:outline-none focus:border-[#FF5A00]/50"
                >
                  <option value="dueDate" className="bg-zinc-900">Data</option>
                  <option value="priority" className="bg-zinc-900">Prioridade</option>
                  <option value="createdAt" className="bg-zinc-900">Criação</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                  className="px-3 py-2 bg-zinc-950/50 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400"
                  title={sortOrder === "asc" ? "Crescente" : "Decrescente"}
                >
                  <ArrowUpDown size={16} />
                </button>
              </div>
            </div>
          </div>
          {hasFilters && (
            <div className="mt-4 flex justify-end">
              <button onClick={clearFilters} className="text-sm font-medium text-[#FF5A00] hover:text-[#E04D00] transition-colors">
                Limpar todos os filtros
              </button>
            </div>
          )}
        </div>
      )}

      {/* ÁREA DE TAREFAS (Grupos) */}
      {loading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 size={32} className="animate-spin text-[#FF5A00]" />
        </div>
      ) : groupedTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center bg-zinc-900/40 border border-zinc-800/50 rounded-2xl">
          <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
            <Plus size={24} className="text-zinc-500" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">Nenhuma tarefa em andamento</h3>
          <p className="text-sm text-zinc-500 mb-6 max-w-sm">
            Crie sua primeira tarefa ou verifique se seus filtros estão muito restritivos.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-6 py-2.5 text-sm font-semibold bg-[#FF5A00] hover:bg-[#E04D00] text-white rounded-xl transition-colors"
          >
            Criar Nova Tarefa
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedTasks.map((group) => {
            const isCollapsed = collapsedGroups[group.id];
            
            return (
              <div key={group.id} className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60 rounded-2xl overflow-hidden transition-all">
                {/* Cabeçalho do Grupo */}
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-between p-5 hover:bg-zinc-800/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300">
                      {groupBy === "client" ? <Briefcase size={18} /> : <User size={18} />}
                    </div>
                    <div className="text-left">
                      <h2 className="text-lg font-semibold text-white">{group.name}</h2>
                      <p className="text-xs text-zinc-500">{group.tasks.length} tarefa{group.tasks.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="text-zinc-500 bg-zinc-950/50 p-2 rounded-full">
                    {isCollapsed ? <ChevronRight size={20} /> : <ChevronDown size={20} />}
                  </div>
                </button>

                {/* Lista de Tarefas do Grupo */}
                {!isCollapsed && (
                  <div className="border-t border-zinc-800/50 px-2 pb-2">
                    {group.tasks.map((task) => {
                      const priorityOpt = PRIORITY_OPTIONS.find((p) => p.value === task.priority);
                      const isUrgent = String(task.priority).toLowerCase().includes('urgent');
                      const assigneeName = (task as any).assignees?.[0]?.user?.name || (task as any).assignees?.[0]?.name || "Não atribuído";
                      
                      return (
                        <div
                          key={task.id}
                          onClick={() => setSelectedTask(task)}
                          className="group flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 my-2 mx-2 rounded-xl bg-zinc-950/30 border border-transparent hover:border-zinc-700 hover:bg-zinc-800/50 transition-all cursor-pointer"
                        >
                          {/* Info Principal */}
                          <div className="flex items-center gap-4 flex-1">
                            <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-[#FF5A00] text-white shrink-0 shadow-lg shadow-[#FF5A00]/10">
                              {task.status || "Status"}
                            </span>
                            
                            <div className="flex items-center gap-2 min-w-0">
                              <p className="text-sm font-medium text-zinc-200 truncate">
                                {task.title}
                              </p>
                              {isUrgent && <span title="Prioridade Urgente" className="animate-pulse">🍌</span>}
                              <Edit3 size={14} className="text-zinc-600 group-hover:text-[#FF5A00] transition-colors ml-2 opacity-0 group-hover:opacity-100 hidden md:block" />
                            </div>
                          </div>

                          {/* Metadados (Responsável e Data) */}
                          <div className="flex flex-row md:flex-row items-center gap-6 text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-400 border border-zinc-700">
                                {assigneeName.charAt(0).toUpperCase()}
                              </div>
                              <div className="hidden md:block text-xs text-zinc-400">
                                <span className="block text-[10px] text-zinc-600">Responsável</span>
                                {assigneeName}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-zinc-400">
                              <div className="hidden md:block text-xs text-right">
                                <span className="block text-[10px] text-zinc-600">Vencimento</span>
                                <span className={isUrgent ? "text-red-400" : ""}>
                                  {task.dueDate ? new Date(task.dueDate).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit', year: 'numeric' }) : "—"}
                                </span>
                              </div>
                              <Calendar size={16} className="text-zinc-600" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Link para o Histórico */}
          <div className="flex justify-center mt-10">
            <Link 
              href="/tarefas-concluidas" 
              className="text-sm font-medium text-zinc-500 hover:text-[#FF5A00] transition-colors flex items-center gap-2 border-b border-transparent hover:border-[#FF5A00]"
            >
              Visualizar Histórico (Tarefas Concluídas/Canceladas) <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      )}

      {/* MODAIS (Mantidos Inalterados) */}
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