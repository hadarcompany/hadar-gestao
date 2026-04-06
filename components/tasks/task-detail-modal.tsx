"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { SelectField } from "@/components/ui/select-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MultiSelect } from "@/components/ui/multi-select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { STATUS_OPTIONS, PRIORITY_OPTIONS, type ChecklistItem } from "@/lib/task-templates";
import { type TaskData } from "@/lib/types";
import { CheckSquare, Square, Clock, User, Calendar, Tag, Pencil, Trash2, ArrowLeftRight, Check } from "lucide-react";

interface TaskDetailModalProps {
  open: boolean;
  onClose: () => void;
  task: TaskData | null;
  onUpdated: () => void;
  users?: { id: string; name: string }[];
  clients?: { id: string; name: string }[];
}

export function TaskDetailModal({ open, onClose, task, onUpdated, users = [], clients = [] }: TaskDetailModalProps) {
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [status, setStatus] = useState("");
  const [actualTime, setActualTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [transferMode, setTransferMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Edit mode fields
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editClientId, setEditClientId] = useState("");
  const [editAssigneeIds, setEditAssigneeIds] = useState<string[]>([]);
  const [editStartDate, setEditStartDate] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editEstimatedTime, setEditEstimatedTime] = useState("");

  // Transfer mode fields
  const [transferAssigneeIds, setTransferAssigneeIds] = useState<string[]>([]);
  const [transferNote, setTransferNote] = useState("");
  const [transferSaving, setTransferSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setChecklist(Array.isArray(task.checklist) ? task.checklist : []);
      setStatus(task.status);
      setActualTime(task.actualTime ? String(task.actualTime) : "");
      setEditMode(false);
      setTransferMode(false);
      // Pre-fill edit fields
      setEditTitle(task.title);
      setEditDescription(task.description || "");
      setEditPriority(task.priority);
      setEditClientId(task.clientId || "");
      setEditAssigneeIds(task.assignees.map((a) => a.user.id));
      setEditStartDate(task.startDate ? task.startDate.slice(0, 10) : "");
      setEditDueDate(task.dueDate ? task.dueDate.slice(0, 10) : "");
      setEditEstimatedTime(task.estimatedTime ? String(task.estimatedTime) : "");
      // Transfer fields start with current assignees
      setTransferAssigneeIds(task.assignees.map((a) => a.user.id));
      setTransferNote("");
    }
  }, [task]);

  if (!task) return null;

  const checkDone = checklist.filter((c) => c.checked).length;
  const checkTotal = checklist.length;

  function toggleCheckItem(id: string) {
    setChecklist((prev) => prev.map((c) => c.id === id ? { ...c, checked: !c.checked } : c));
  }

  async function handleDelete() {
    if (!task) return;
    try {
      await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      onUpdated();
    } catch (e) {
      console.error("Error deleting task:", e);
    }
  }

  async function handleTransfer() {
    if (!task) return;
    setTransferSaving(true);
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assigneeIds: transferAssigneeIds,
          transferNote: transferNote || null,
        }),
      });
      setTransferMode(false);
      onUpdated();
    } finally {
      setTransferSaving(false);
    }
  }

  async function save() {
    if (!task) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        checklist,
        status,
        actualTime: actualTime ? parseFloat(actualTime) : null,
      };

      if (editMode) {
        payload.title = editTitle;
        payload.description = editDescription || null;
        payload.priority = editPriority;
        payload.clientId = editClientId || null;
        payload.assigneeIds = editAssigneeIds;
        payload.startDate = editStartDate || null;
        payload.dueDate = editDueDate || null;
        payload.estimatedTime = editEstimatedTime || null;
      }

      await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      onUpdated();
    } finally {
      setSaving(false);
    }
  }

  const statusOpt = STATUS_OPTIONS.find((s) => s.value === task.status);
  const priorityOpt = PRIORITY_OPTIONS.find((p) => p.value === task.priority);

  const statusVariant = ({ PENDING: "default", IN_PROGRESS: "info", IN_REVIEW: "purple", COMPLETED: "success", CANCELLED: "danger" } as const)[task.status] || "default";
  const priorityVariant = ({ LOW: "default", MEDIUM: "warning", HIGH: "warning", URGENT: "danger" } as const)[task.priority] || "default";

  return (
    <>
      <Modal open={open} onClose={onClose} title={editMode ? "Editar Tarefa" : transferMode ? "Transferir Tarefa" : task.title} size="xl">
        <div className="space-y-6">

          {/* TRANSFER MODE */}
          {transferMode ? (
            <div className="space-y-5">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-300">
                <p className="font-medium mb-1">Transferindo: <span className="text-white">{task.title}</span></p>
                <p className="text-amber-400/70">Selecione o(s) novo(s) responsável(is) pela tarefa.</p>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Responsáveis atuais</p>
                <div className="flex flex-wrap gap-2">
                  {task.assignees.length > 0 ? task.assignees.map((a) => (
                    <span key={a.user.id} className="flex items-center gap-1.5 text-xs bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded-lg border border-zinc-700">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px] text-amber-400 font-bold">
                        {a.user.name[0]}
                      </span>
                      {a.user.name}
                    </span>
                  )) : (
                    <span className="text-xs text-zinc-600">Nenhum responsável atribuído</span>
                  )}
                </div>
              </div>

              <MultiSelect
                label="Novo(s) Responsável(is)"
                options={users.map((u) => ({ value: u.id, label: u.name }))}
                value={transferAssigneeIds}
                onChange={setTransferAssigneeIds}
                placeholder="Selecione os novos responsáveis..."
              />

              <Textarea
                label="Observação da transferência (opcional)"
                value={transferNote}
                onChange={(e) => setTransferNote(e.target.value)}
                placeholder="Ex: Tarefa transferida para revisão final..."
              />

              <div className="flex items-center gap-3 pt-2 border-t border-white/5">
                <button
                  onClick={() => setTransferMode(false)}
                  className="px-4 py-2 text-sm text-white/50 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <div className="flex-1" />
                <button
                  onClick={handleTransfer}
                  disabled={transferSaving || transferAssigneeIds.length === 0}
                  className="flex items-center gap-2 px-6 py-2 text-sm bg-[#FF5A00] hover:bg-[#E04D00] disabled:opacity-50 text-white font-bold rounded-lg transition-colors"
                >
                  <Check size={14} />
                  {transferSaving ? "Transferindo..." : "Confirmar Transferência"}
                </button>
              </div>
            </div>
          ) : !editMode ? (
            <>
              {/* View mode */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant}>{statusOpt?.label ?? ""}</Badge>
                <Badge variant={priorityVariant}>{priorityOpt?.label ?? ""}</Badge>
                {task.type && <Badge>{task.type.replace(/_/g, " ")}</Badge>}
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => setTransferMode(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors"
                  >
                    <ArrowLeftRight size={12} /> Transferir
                  </button>
                  <button
                    onClick={() => setEditMode(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-colors"
                  >
                    <Pencil size={12} /> Editar
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {task.client && (
                  <div className="flex items-center gap-2 text-white/50">
                    <User size={14} className="text-amber-500" />
                    <span>{task.client.name}</span>
                  </div>
                )}
                {task.dueDate && (
                  <div className="flex items-center gap-2 text-white/50">
                    <Calendar size={14} className="text-amber-500" />
                    <span>{new Date(task.dueDate).toLocaleDateString("pt-BR")}</span>
                  </div>
                )}
                {task.estimatedTime && (
                  <div className="flex items-center gap-2 text-white/50">
                    <Clock size={14} className="text-amber-500" />
                    <span>{task.estimatedTime}h estimado</span>
                  </div>
                )}
                {task.assignees.length > 0 && (
                  <div className="flex items-center gap-1 text-white/50">
                    {task.assignees.map((a, i) => (
                      <span key={i} className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px] text-amber-400 font-bold" title={a.user.name}>
                        {a.user.name[0]}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {task.tags?.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Tag size={14} className="text-white/20" />
                  {task.tags.map((tag) => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-white/40">{tag}</span>
                  ))}
                </div>
              )}

              {task.description && (
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                  <h3 className="text-xs text-white/30 uppercase tracking-wider mb-2">Descrição</h3>
                  <p className="text-sm text-white/60 whitespace-pre-wrap">{task.description}</p>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Edit mode - full fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Título" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                <SelectField
                  label="Cliente"
                  value={editClientId}
                  onChange={setEditClientId}
                  placeholder="Sem cliente"
                  options={clients.map((c) => ({ value: c.id, label: c.name }))}
                />
              </div>

              <MultiSelect
                label="Responsável(is)"
                options={users.map((u) => ({ value: u.id, label: u.name }))}
                value={editAssigneeIds}
                onChange={setEditAssigneeIds}
                placeholder="Selecione responsáveis..."
              />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SelectField label="Prioridade" value={editPriority} onChange={setEditPriority}
                  options={PRIORITY_OPTIONS.map((p) => ({ value: p.value, label: p.label }))} />
                <Input label="Tempo Estimado (h)" type="number" step="0.5" value={editEstimatedTime}
                  onChange={(e) => setEditEstimatedTime(e.target.value)} />
                <Input label="Data Início" type="date" value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)} />
                <Input label="Data Entrega" type="date" value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)} />
              </div>

              <Textarea label="Descrição" value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)} placeholder="Detalhes da tarefa..." />
            </>
          )}

          {/* Editable Status + Time (always visible, not in transfer mode) */}
          {!transferMode && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <SelectField label="Alterar Status" value={status} onChange={setStatus}
                options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))} />
              <Input label="Tempo Real (horas)" type="number" step="0.5" value={actualTime}
                onChange={(e) => setActualTime(e.target.value)} placeholder="0" />
            </div>
          )}

          {/* Checklist (not in transfer mode) */}
          {!transferMode && checklist.length > 0 && (
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs text-white/30 uppercase tracking-wider">Checklist</h3>
                <span className="text-xs text-white/30">{checkDone}/{checkTotal}</span>
              </div>
              <div className="w-full h-1.5 bg-white/5 rounded-full mb-4 overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full transition-all duration-300"
                  style={{ width: checkTotal > 0 ? `${(checkDone / checkTotal) * 100}%` : "0%" }} />
              </div>
              <div className="space-y-1">
                {checklist.map((item) => (
                  <button key={item.id} onClick={() => toggleCheckItem(item.id)}
                    className="flex items-center gap-3 w-full text-left py-1.5 px-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                    {item.checked ? (
                      <CheckSquare size={16} className="text-amber-500 shrink-0" />
                    ) : (
                      <Square size={16} className="text-white/20 shrink-0" />
                    )}
                    <span className={`text-sm ${item.checked ? "text-white/30 line-through" : "text-white/70"}`}>
                      {item.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actions (not in transfer mode) */}
          {!transferMode && (
            <div className="flex items-center gap-3 pt-2 border-t border-white/5">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-colors"
                title="Excluir tarefa"
              >
                <Trash2 size={16} />
              </button>
              {editMode && (
                <button onClick={() => setEditMode(false)}
                  className="px-4 py-2 text-sm text-white/50 bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
                  Cancelar Edição
                </button>
              )}
              <div className="flex-1" />
              <button onClick={save} disabled={saving}
                className="px-6 py-2 text-sm bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors">
                {saving ? "Salvando..." : "Salvar Alterações"}
              </button>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Excluir Tarefa"
        message={`Tem certeza que deseja excluir a tarefa "${task?.title}"? Esta ação é irreversível.`}
        confirmLabel="Sim, excluir"
        cancelLabel="Cancelar"
        onConfirm={() => { setShowDeleteConfirm(false); handleDelete(); }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
}
