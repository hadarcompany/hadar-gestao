"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Modal } from "@/components/ui/modal";
import { SelectField } from "@/components/ui/select-field";
import { ClientIdentity } from "@/components/clients/client-identity";
import { TaskRow } from "@/components/tasks/task-row";
import { TaskDetailModal } from "@/components/tasks/task-detail-modal";
import { projectProgress, type ProjectData } from "@/lib/projects";
import { isOverdue } from "@/lib/dates";
import { type TaskData } from "@/lib/types";
import { Rocket, Loader2, Plus, CheckCircle2, AlertTriangle, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";

type Filter = "ANDAMENTO" | "CONCLUIDOS" | "TODOS";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "ANDAMENTO", label: "Em andamento" },
  { key: "CONCLUIDOS", label: "Concluídos" },
  { key: "TODOS", label: "Todos" },
];

function isFinished(p: ProjectData) {
  const { total, pct } = projectProgress(p.tasks);
  return p.status === "CONCLUIDO" || (total > 0 && pct === 100);
}

function daysSince(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

export default function OnboardingPage() {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; image?: string | null }[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string; status: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("ANDAMENTO");
  const [selectedTask, setSelectedTask] = useState<TaskData | null>(null);
  const [showStart, setShowStart] = useState(false);
  const [startClientId, setStartClientId] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/projects?kind=ONBOARDING");
      if (res.ok) setProjects(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
    fetch("/api/users").then((r) => r.json()).then(setUsers);
    fetch("/api/clients").then((r) => r.json()).then((d) =>
      setClients(d.map((c: { id: string; name: string; status: string }) => ({ id: c.id, name: c.name, status: c.status })))
    );
  }, [fetchProjects]);

  const visible = useMemo(
    () => projects.filter((p) => (filter === "TODOS" ? true : filter === "CONCLUIDOS" ? isFinished(p) : !isFinished(p))),
    [projects, filter]
  );

  const stats = useMemo(() => {
    const active = projects.filter((p) => !isFinished(p));
    const overdue = active.flatMap((p) => p.tasks).filter((t) => isOverdue(t)).length;
    const avg = active.length
      ? Math.round(active.reduce((sum, p) => sum + projectProgress(p.tasks).pct, 0) / active.length)
      : 0;
    return { active: active.length, done: projects.length - active.length, overdue, avg };
  }, [projects]);

  const eligibleClients = clients.filter(
    (c) => c.status !== "INACTIVE" && !projects.some((p) => p.clientId === c.id)
  );

  function updateTask(updated: TaskData) {
    setProjects((prev) => prev.map((p) => ({ ...p, tasks: p.tasks.map((t) => (t.id === updated.id ? updated : t)) })));
  }

  async function startOnboarding() {
    if (!startClientId) { setError("Selecione o cliente."); return; }
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "ONBOARDING", clientId: startClientId }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Não foi possível iniciar o onboarding");
      const created: ProjectData = await res.json();
      setProjects((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
      setShowStart(false);
      setStartClientId("");
      setFilter("ANDAMENTO");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  }

  async function markConcluded(p: ProjectData) {
    setProjects((prev) => prev.map((x) => (x.id === p.id ? { ...x, status: "CONCLUIDO" } : x)));
    const res = await fetch(`/api/projects/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CONCLUIDO" }),
    }).catch(() => null);
    if (!res?.ok) fetchProjects();
  }

  const tiles = [
    { label: "Em andamento", value: String(stats.active), icon: Rocket, color: "text-purple-600", bg: "bg-purple-500/10" },
    { label: "Concluídos", value: String(stats.done), icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-500/10" },
    { label: "Tarefas atrasadas", value: String(stats.overdue), icon: AlertTriangle, color: "text-red-600", bg: "bg-red-500/10" },
    { label: "Progresso médio", value: `${stats.avg}%`, icon: Gauge, color: "text-blue-600", bg: "bg-blue-500/10" },
  ];

  return (
    <div className="min-h-screen bg-transparent w-full pb-10">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-5 gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Onboarding</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Entrada de cada cliente novo. As tarefas são criadas sozinhas quando um cliente é cadastrado como ativo.
          </p>
        </div>
        <button
          onClick={() => { setError(null); setShowStart(true); }}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-accent hover:bg-accent-dark text-white rounded-lg transition-colors self-start"
        >
          <Plus size={15} /> Iniciar onboarding
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {tiles.map((tile) => (
          <div key={tile.label} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", tile.bg)}>
              <tile.icon size={16} className={tile.color} />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-gray-900 leading-tight">{tile.value}</p>
              <p className="text-[11px] text-gray-400 truncate">{tile.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1.5 mb-3">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border",
              filter === f.key ? "bg-accent/10 border-accent/30 text-accent-dark" : "bg-white border-gray-200 text-gray-500 hover:text-gray-900"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-accent" /></div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white border border-gray-200 border-dashed rounded-xl">
          <Rocket size={26} className="text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-900 mb-1">
            {filter === "CONCLUIDOS" ? "Nenhum onboarding concluído ainda" : "Nenhum onboarding em andamento"}
          </p>
          <p className="text-xs text-gray-400">Cadastre um cliente ativo ou use &quot;Iniciar onboarding&quot; para um cliente existente.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
          {visible.map((p) => {
            const { done, total, pct } = projectProgress(p.tasks);
            const finished = isFinished(p);
            const days = daysSince(p.createdAt);
            const overdueCount = p.tasks.filter((t) => isOverdue(t)).length;
            return (
              <div key={p.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {p.client ? <ClientIdentity client={p.client} size={24} /> : p.name}
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1">
                        Iniciado em {new Date(p.createdAt).toLocaleDateString("pt-BR")} · {days === 0 ? "hoje" : `há ${days} ${days === 1 ? "dia" : "dias"}`}
                        {overdueCount > 0 && <span className="text-red-600"> · {overdueCount} {overdueCount === 1 ? "atrasada" : "atrasadas"}</span>}
                      </p>
                    </div>
                    <span className={cn("text-lg font-bold shrink-0", finished ? "text-emerald-600" : "text-gray-900")}>{pct}%</span>
                  </div>
                  <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", finished ? "bg-emerald-500" : "bg-accent")} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between mt-1.5 gap-2">
                    <p className="text-[11px] text-gray-400">{done} de {total} concluídas</p>
                    {finished && p.status !== "CONCLUIDO" && (
                      <button onClick={() => markConcluded(p)} className="text-[11px] font-medium text-emerald-600 hover:text-emerald-700">
                        Marcar onboarding como concluído
                      </button>
                    )}
                  </div>
                </div>
                <div className="border-t border-gray-100">
                  {p.tasks.map((t) => (
                    <TaskRow key={t.id} task={t} users={users} showClient={false} onUpdated={updateTask} onOpenDetail={setSelectedTask} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={showStart} onClose={() => setShowStart(false)} title="Iniciar onboarding" size="sm">
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Cria o projeto de onboarding com as 9 tarefas padrão para um cliente que ainda não tem.
          </p>
          <SelectField
            label="Cliente"
            value={startClientId}
            onChange={setStartClientId}
            placeholder={eligibleClients.length ? "Selecione..." : "Todos os clientes já têm onboarding"}
            options={eligibleClients.map((c) => ({ value: c.id, label: c.name }))}
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setShowStart(false)} className="px-4 py-2 text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
              Cancelar
            </button>
            <button
              onClick={startOnboarding}
              disabled={starting || !startClientId}
              className="px-4 py-2 text-xs font-semibold text-white bg-accent hover:bg-accent-dark rounded-lg transition-colors disabled:opacity-50"
            >
              {starting ? <Loader2 size={13} className="inline animate-spin" /> : "Criar tarefas"}
            </button>
          </div>
        </div>
      </Modal>

      <TaskDetailModal
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        task={selectedTask}
        onAttachmentsChanged={fetchProjects}
        onUpdated={() => { fetchProjects(); setSelectedTask(null); }}
        onTaskChanged={updateTask}
        users={users}
        clients={clients}
      />
    </div>
  );
}
