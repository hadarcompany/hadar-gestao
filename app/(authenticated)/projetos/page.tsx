"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/ui/select-field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ClientIdentity } from "@/components/clients/client-identity";
import { TaskRow } from "@/components/tasks/task-row";
import { TaskDetailModal } from "@/components/tasks/task-detail-modal";
import { CreateTaskModal } from "@/components/tasks/create-task-modal";
import { PROJECT_STATUSES, PROJECT_COLORS, projectProgress, projectStatusInfo, type ProjectData } from "@/lib/projects";
import { formatDayMonthBR } from "@/lib/dates";
import { type TaskData } from "@/lib/types";
import { Plus, Loader2, ChevronDown, ChevronRight, Pencil, Trash2, FolderKanban, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjectForm {
  name: string;
  clientId: string;
  dueDate: string;
  status: string;
  color: string;
  description: string;
}

const EMPTY_FORM: ProjectForm = {
  name: "", clientId: "", dueDate: "", status: "EM_ANDAMENTO", color: PROJECT_COLORS[0], description: "",
};

export default function ProjetosPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; email?: string | null; image?: string | null }[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeOnboarding, setIncludeOnboarding] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<ProjectData | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ProjectForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ProjectData | null>(null);
  const [newTaskFor, setNewTaskFor] = useState<ProjectData | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskData | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(includeOnboarding ? "/api/projects" : "/api/projects?kind=GERAL");
      if (res.ok) setProjects(await res.json());
    } finally {
      setLoading(false);
    }
  }, [includeOnboarding]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  useEffect(() => {
    fetch("/api/users").then((r) => r.json()).then(setUsers);
    fetch("/api/clients").then((r) => r.json()).then((d) => setClients(d.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))));
  }, []);

  // Em aberto primeiro, depois pelo prazo mais próximo.
  const sorted = useMemo(() => [...projects].sort((a, b) => {
    const aDone = a.status === "CONCLUIDO" ? 1 : 0;
    const bDone = b.status === "CONCLUIDO" ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    if (!a.dueDate && !b.dueDate) return a.name.localeCompare(b.name);
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  }), [projects]);

  const openCount = projects.filter((p) => p.status !== "CONCLUIDO").length;

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowForm(true);
  }

  function openEdit(p: ProjectData) {
    setEditing(p);
    setForm({
      name: p.name,
      clientId: p.clientId ?? "",
      dueDate: p.dueDate ? p.dueDate.slice(0, 10) : "",
      status: p.status,
      color: p.color ?? PROJECT_COLORS[0],
      description: p.description ?? "",
    });
    setError(null);
    setShowForm(true);
  }

  async function save() {
    if (!form.name.trim()) { setError("Dê um nome ao projeto."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(editing ? `/api/projects/${editing.id}` : "/api/projects", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, clientId: form.clientId || null, dueDate: form.dueDate || null }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Não foi possível salvar o projeto");
      const saved: ProjectData = await res.json();
      setProjects((prev) => (editing ? prev.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...prev]));
      if (!editing) setExpanded((e) => ({ ...e, [saved.id]: true }));
      setShowForm(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(p: ProjectData, status: string) {
    setProjects((prev) => prev.map((x) => (x.id === p.id ? { ...x, status } : x)));
    const res = await fetch(`/api/projects/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => null);
    if (!res?.ok) fetchProjects();
  }

  async function remove(p: ProjectData) {
    setConfirmDelete(null);
    setShowForm(false);
    setProjects((prev) => prev.filter((x) => x.id !== p.id));
    const res = await fetch(`/api/projects/${p.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) fetchProjects();
  }

  function updateTask(updated: TaskData) {
    setSelectedTask((current) => current?.id === updated.id ? updated : current);
    setProjects((prev) => prev.map((p) => ({ ...p, tasks: p.tasks.map((t) => (t.id === updated.id ? updated : t)) })));
  }

  function addClone(clone: TaskData) {
    setProjects((prev) => prev.map((p) => (p.id === clone.projectId ? { ...p, tasks: [...p.tasks, clone] } : p)));
  }

  return (
    <div className="min-h-screen bg-transparent w-full pb-10">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-5 gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Projetos</h1>
          <p className="text-xs text-gray-400 mt-0.5">{openCount} em aberto · {projects.length} no total</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeOnboarding}
              onChange={(e) => setIncludeOnboarding(e.target.checked)}
              className="rounded accent-current text-accent"
            />
            Mostrar onboardings
          </label>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-accent hover:bg-accent-dark text-white rounded-lg transition-colors"
          >
            <Plus size={15} /> Novo projeto
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-accent" /></div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white border border-gray-200 border-dashed rounded-xl">
          <FolderKanban size={28} className="text-gray-300 mb-3" />
          <h3 className="text-sm font-medium text-gray-900 mb-1">Nenhum projeto ainda</h3>
          <p className="text-xs text-gray-400 mb-4">Agrupe tarefas em projetos para acompanhar prazo e progresso.</p>
          <button onClick={openCreate} className="px-4 py-2 text-xs font-semibold bg-accent hover:bg-accent-dark text-white rounded-lg transition-colors">
            Criar primeiro projeto
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((p) => {
            const open = !!expanded[p.id];
            const { done, total, pct } = projectProgress(p.tasks);
            const color = p.color ?? PROJECT_COLORS[0];
            const status = projectStatusInfo(p.status);
            return (
              <div key={p.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden" style={{ borderLeft: `4px solid ${color}` }}>
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <button
                    onClick={() => setExpanded((e) => ({ ...e, [p.id]: !open }))}
                    aria-expanded={open}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  >
                    {open ? <ChevronDown size={16} style={{ color }} className="shrink-0" /> : <ChevronRight size={16} style={{ color }} className="shrink-0" />}
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold truncate" style={{ color }}>{p.name}</span>
                      <span className="flex items-center gap-2 text-[11px] text-gray-400">
                        {total} {total === 1 ? "tarefa" : "tarefas"}
                        {p.client && <span className="inline-flex items-center gap-1 truncate"><ClientIdentity client={p.client} size={14} /></span>}
                      </span>
                    </span>
                  </button>

                  <div className="hidden md:flex items-center gap-2 w-40 shrink-0" title={`${pct}% concluído`}>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                    <span className="text-[11px] text-gray-500 w-10 text-right">{done}/{total}</span>
                  </div>

                  {p.dueDate && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-gray-500 shrink-0">
                      <Calendar size={11} /> {formatDayMonthBR(p.dueDate)}
                    </span>
                  )}

                  <select
                    value={p.status}
                    onChange={(e) => changeStatus(p, e.target.value)}
                    aria-label="Status do projeto"
                    className={cn("text-[11px] font-medium rounded-full px-2 py-0.5 border-0 focus:outline-none cursor-pointer shrink-0", status.color)}
                  >
                    {PROJECT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>

                  <button onClick={() => setNewTaskFor(p)} title="Adicionar tarefa" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-accent-dark transition-colors shrink-0">
                    <Plus size={15} />
                  </button>
                  <button onClick={() => openEdit(p)} title="Editar projeto" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-accent-dark transition-colors shrink-0">
                    <Pencil size={14} />
                  </button>
                </div>

                {open && (
                  <div className="border-t border-gray-100">
                    {p.tasks.length === 0 ? (
                      <div className="flex items-center justify-between px-4 py-4 text-xs text-gray-400">
                        Nenhuma tarefa neste projeto ainda.
                        <button onClick={() => setNewTaskFor(p)} className="font-medium text-accent hover:text-accent-dark">Adicionar tarefa</button>
                      </div>
                    ) : (
                      p.tasks.map((t) => (
                        <TaskRow
                          key={t.id}
                          task={t}
                          users={users}
                          showClient={!p.client}
                          onUpdated={updateTask}
                          onCloned={addClone}
                          onOpenDetail={setSelectedTask}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? "Editar projeto" : "Novo projeto"} size="md">
        <div className="space-y-3">
          <Input label="Nome *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Lançamento do site" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SelectField
              label="Cliente"
              value={form.clientId}
              onChange={(v) => setForm({ ...form, clientId: v })}
              placeholder="Sem cliente"
              options={clients.map((c) => ({ value: c.id, label: c.name }))}
            />
            <Input label="Prazo" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            <SelectField
              label="Status"
              value={form.status}
              onChange={(v) => setForm({ ...form, status: v })}
              options={PROJECT_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
            />
            <div className="space-y-1.5">
              <span className="block text-xs text-gray-500 uppercase tracking-wider font-medium">Cor</span>
              <div className="flex flex-wrap gap-2 pt-1">
                {PROJECT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    aria-label={`Cor ${c}`}
                    aria-pressed={form.color === c}
                    className={cn("w-6 h-6 rounded-full transition-transform", form.color === c && "ring-2 ring-offset-2 ring-gray-400 scale-110")}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <Textarea label="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex items-center justify-between gap-2 pt-1">
            {editing && user?.role === "ADMIN" ? (
              <button
                onClick={() => setConfirmDelete(editing)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 size={13} /> Excluir
              </button>
            ) : <span />}
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold text-white bg-accent hover:bg-accent-dark rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 size={13} className="inline animate-spin" /> : editing ? "Salvar" : "Criar projeto"}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && remove(confirmDelete)}
        title="Excluir projeto"
        message={`Excluir o projeto "${confirmDelete?.name}"? As tarefas continuam existindo, apenas sem projeto.`}
      />

      <CreateTaskModal
        open={!!newTaskFor}
        onClose={() => setNewTaskFor(null)}
        onCreated={fetchProjects}
        users={users}
        clients={clients}
        initialClientId={newTaskFor?.clientId ?? undefined}
        initialProjectId={newTaskFor?.id}
      />

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
