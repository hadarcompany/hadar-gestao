"use client";

import { useState, useRef, useEffect } from "react";
import { type TaskData, type UserSummary } from "@/lib/types";
import { getTaskBucket, formatDayMonthBR } from "@/lib/dates";
import { Avatar } from "@/components/ui/avatar";
import { Floating } from "@/components/ui/floating";
import { PriorityBadge } from "@/components/tasks/priority-badge";
import { StatusBadge } from "@/components/tasks/status-badge";
import { TaskLabels } from "@/components/tasks/label-picker";
import {
  Copy, ArrowLeftRight, Info, Calendar as CalendarIcon,
  Loader2, Check, X as XIcon, Paperclip, CheckCircle2, Circle, MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskRowProps {
  task: TaskData;
  users: UserSummary[];
  showClient?: boolean;
  onUpdated: (task: TaskData) => void;
  onCloned?: (task: TaskData) => void;
  onOpenDetail: (task: TaskData) => void;
}

async function patchTask(id: string, body: Record<string, unknown>): Promise<TaskData> {
  const res = await fetch(`/api/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Falha ao salvar alteração");
  return res.json();
}

export function TaskRow({ task, users, showClient = true, onUpdated, onCloned, onOpenDetail }: TaskRowProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(task.title);
  const [editingDate, setEditingDate] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [saving, setSaving] = useState<"title" | "date" | "clone" | "status" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const assigneeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { setTitleValue(task.title); }, [task.title]);
  useEffect(() => { if (editingTitle) { titleInputRef.current?.focus(); titleInputRef.current?.select(); } }, [editingTitle]);
  useEffect(() => { if (editingDate) { dateInputRef.current?.focus(); try { dateInputRef.current?.showPicker?.(); } catch { /* not supported */ } } }, [editingDate]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  const bucket = getTaskBucket(task);
  const assignee = task.assignees[0]?.user;
  const extraAssignees = task.assignees.length - 1;
  const isDone = task.status === "COMPLETED";
  const updatesCount = task._count?.updates ?? 0;

  async function saveTitle() {
    const trimmed = titleValue.trim();
    if (!trimmed || trimmed === task.title) { setEditingTitle(false); setTitleValue(task.title); return; }
    setSaving("title");
    try {
      const updated = await patchTask(task.id, { title: trimmed });
      onUpdated(updated);
      setEditingTitle(false);
    } catch {
      setError("Não foi possível salvar o nome.");
      setTitleValue(task.title);
    } finally {
      setSaving(null);
    }
  }

  async function saveDueDate(value: string) {
    setSaving("date");
    try {
      const updated = await patchTask(task.id, { dueDate: value || null });
      onUpdated(updated);
      setEditingDate(false);
    } catch {
      setError("Não foi possível salvar o prazo.");
    } finally {
      setSaving(null);
    }
  }

  async function toggleComplete() {
    setSaving("status");
    setError(null);
    try {
      onUpdated(await patchTask(task.id, { status: isDone ? "PENDING" : "COMPLETED" }));
    } catch {
      setError(isDone ? "Não foi possível reabrir a tarefa." : "Não foi possível concluir a tarefa.");
    } finally {
      setSaving(null);
    }
  }

  // Status, prioridade e etiquetas mudam na hora na tela; se a gravação falhar, voltam ao valor anterior.
  async function quickUpdate(changes: Partial<TaskData>, message: string) {
    const previous = task;
    onUpdated({ ...task, ...changes });
    try {
      onUpdated(await patchTask(task.id, changes));
    } catch {
      onUpdated(previous);
      setError(message);
    }
  }

  async function handleClone() {
    setSaving("clone");
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}/clone`, { method: "POST" });
      if (!res.ok) throw new Error();
      const clone = await res.json();
      onCloned?.(clone);
    } catch {
      setError("Não foi possível clonar a tarefa.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div
      onClick={() => onOpenDetail(task)}
      className="group relative flex items-center gap-3 px-3 py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors text-sm cursor-pointer"
    >
      {/* concluir / reabrir */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); toggleComplete(); }}
        disabled={saving === "status"}
        title={isDone ? "Reabrir tarefa" : "Concluir tarefa"}
        aria-label={isDone ? "Reabrir tarefa" : "Concluir tarefa"}
        className={cn(
          "shrink-0 transition-colors disabled:opacity-50",
          isDone ? "text-emerald-600 hover:text-emerald-700" : "text-gray-300 hover:text-emerald-600"
        )}
      >
        {saving === "status"
          ? <Loader2 size={17} className="animate-spin" />
          : isDone ? <CheckCircle2 size={17} /> : <Circle size={17} />}
      </button>

      <StatusBadge status={task.status} onChange={(status) => quickUpdate({ status }, "Não foi possível alterar o status.")} />

      <PriorityBadge
        priority={task.priority}
        onChange={(priority) => quickUpdate({ priority }, "Não foi possível alterar a prioridade.")}
      />

      {/* título: clique renomeia; o resto da linha abre a tarefa */}
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        {editingTitle ? (
          <input
            ref={titleInputRef}
            value={titleValue}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveTitle();
              if (e.key === "Escape") { e.stopPropagation(); setTitleValue(task.title); setEditingTitle(false); }
            }}
            aria-label="Nome da tarefa"
            className="w-full bg-white border border-accent/50 rounded px-1.5 py-0.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-accent/30"
          />
        ) : (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); setEditingTitle(true); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setEditingTitle(true); } }}
            title="Clique para renomear"
            className={cn(
              "truncate text-left font-medium max-w-[280px] cursor-text rounded px-0.5 -mx-0.5 hover:bg-white hover:ring-1 hover:ring-gray-200",
              isDone ? "text-gray-400 line-through" : "text-gray-800"
            )}
          >
            {saving === "title" ? <Loader2 size={12} className="inline animate-spin mr-1" /> : null}
            {task.title}
          </span>
        )}
        {task.description && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowDescription((v) => !v); }}
              onMouseEnter={() => setShowDescription(true)}
              onMouseLeave={() => setShowDescription(false)}
              aria-expanded={showDescription}
              aria-label="Ver descrição da tarefa"
              className="text-gray-300 hover:text-accent transition-colors"
            >
              <Info size={13} />
            </button>
            {showDescription && (
              <div
                role="tooltip"
                className="absolute z-20 top-full left-0 mt-1 w-64 max-h-40 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs text-gray-600 whitespace-pre-wrap"
              >
                {task.description}
              </div>
            )}
          </div>
        )}
        {!!task.attachments?.length && (
          <span title={`${task.attachments.length} anexo(s)`} className="shrink-0 flex items-center gap-0.5 text-gray-300">
            <Paperclip size={12} />
            <span className="text-[10px]">{task.attachments.length}</span>
          </span>
        )}
        {updatesCount > 0 && (
          <span title={`${updatesCount} atualização(ões)`} className="shrink-0 flex items-center gap-0.5 text-gray-400">
            <MessageSquare size={12} />
            <span className="text-[10px]">{updatesCount}</span>
          </span>
        )}
        {error && <span role="alert" className="shrink-0 text-[11px] text-red-600 bg-red-50 rounded px-1.5 py-0.5">{error}</span>}
      </div>

      {/* etiquetas */}
      <div className="hidden lg:flex shrink-0 max-w-[240px]">
        <TaskLabels
          compact
          labelIds={task.labelIds ?? []}
          onChange={(labelIds) => quickUpdate({ labelIds }, "Não foi possível salvar as etiquetas.")}
        />
      </div>

      {/* client */}
      {showClient && (
        <span className="hidden sm:flex items-center gap-1.5 w-28 shrink-0 truncate text-xs text-gray-400" title={task.client?.name ?? "Sem cliente"}>
          {task.client && <Avatar name={task.client.name} image={task.client.logoUrl} size={18} className="text-[8px] object-contain" />}
          <span className="truncate">{task.client?.name ?? "Sem cliente"}</span>
        </span>
      )}

      {/* responsável / transferir: o painel flutua fora da lista para não ser cortado */}
      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
          ref={assigneeRef}
          type="button"
          onClick={() => setShowTransfer((v) => !v)}
          title="Transferir responsável"
          className="flex items-center gap-1 rounded-full hover:bg-gray-100 pr-1.5 pl-0.5 py-0.5 transition-colors"
        >
          <Avatar name={assignee?.name} image={assignee?.image} size={24} className="text-[10px]" />
          <span className="hidden md:inline text-xs text-gray-500 truncate max-w-[70px]">
            {assignee?.name ?? "Sem responsável"}{extraAssignees > 0 ? ` +${extraAssignees}` : ""}
          </span>
        </button>
        <Floating anchorRef={assigneeRef} open={showTransfer} onClose={() => setShowTransfer(false)} width={264} className="p-3">
          <TransferPanel
            task={task}
            users={users}
            onCancel={() => setShowTransfer(false)}
            onTransferred={(t) => { onUpdated(t); setShowTransfer(false); }}
          />
        </Floating>
      </div>

      {/* due date */}
      <div className="shrink-0 w-24 text-right" onClick={(e) => e.stopPropagation()}>
        {editingDate ? (
          <input
            ref={dateInputRef}
            type="date"
            defaultValue={task.dueDate ? task.dueDate.slice(0, 10) : ""}
            onBlur={(e) => saveDueDate(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") setEditingDate(false); }}
            className="w-full bg-white border border-accent/50 rounded px-1 py-0.5 text-xs text-gray-900 focus:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingDate(true)}
            title="Clique para alterar o prazo"
            className={cn(
              "inline-flex items-center gap-1 text-xs hover:text-accent-dark transition-colors",
              bucket === "OVERDUE" ? "text-red-600 font-medium" : bucket === "TODAY" ? "text-accent-dark font-medium" : "text-gray-500"
            )}
          >
            {saving === "date" ? <Loader2 size={11} className="animate-spin" /> : <CalendarIcon size={11} />}
            {task.dueDate ? formatDayMonthBR(task.dueDate) : "Sem data"}
          </button>
        )}
      </div>

      {/* actions */}
      <div
        className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleClone}
          disabled={saving === "clone"}
          title="Clonar tarefa"
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-accent-dark transition-colors disabled:opacity-50"
        >
          {saving === "clone" ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
        </button>
        <button
          type="button"
          onClick={() => setShowTransfer(true)}
          title="Transferir"
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-accent-dark transition-colors"
        >
          <ArrowLeftRight size={14} />
        </button>
        <button
          type="button"
          onClick={() => onOpenDetail(task)}
          title="Ver detalhes completos"
          className="px-2 py-1 rounded-lg hover:bg-gray-100 text-[11px] text-gray-400 hover:text-gray-700 transition-colors"
        >
          Detalhes
        </button>
      </div>
    </div>
  );
}

function TransferPanel({
  task, users, onCancel, onTransferred,
}: {
  task: TaskData;
  users: UserSummary[];
  onCancel: () => void;
  onTransferred: (t: TaskData) => void;
}) {
  const [selected, setSelected] = useState<string[]>(task.assignees.map((a) => a.user.id));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  }

  async function confirm() {
    if (selected.length === 0) { setError("Selecione ao menos um responsável"); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserIds: selected, note: note || null }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Falha ao transferir");
      }
      onTransferred(await res.json());
    } catch (e) {
      setError((e as Error).message || "Falha ao transferir a tarefa");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold mb-2">Transferir para</p>
      <div className="max-h-40 overflow-y-auto space-y-1 mb-2">
        {users.map((u) => (
          <label key={u.id} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-gray-50 cursor-pointer text-sm text-gray-700">
            <input type="checkbox" checked={selected.includes(u.id)} onChange={() => toggle(u.id)} className="rounded accent-current text-accent" />
            <Avatar name={u.name} image={u.image} size={18} className="text-[9px]" />
            {u.name}
          </label>
        ))}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Nota (opcional)"
        className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 mb-2 resize-none focus:outline-none focus:border-accent/50"
        rows={2}
      />
      {error && <p className="text-[11px] text-red-600 mb-2">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 py-1.5 text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
          <XIcon size={12} className="inline mr-1" /> Cancelar
        </button>
        <button type="button" onClick={confirm} disabled={saving} className="flex-1 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent-dark rounded-lg transition-colors disabled:opacity-50">
          {saving ? <Loader2 size={12} className="inline animate-spin" /> : <Check size={12} className="inline mr-1" />} Confirmar
        </button>
      </div>
    </>
  );
}
