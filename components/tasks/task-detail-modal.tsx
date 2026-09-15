"use client";

import { useAuth } from "@/contexts/auth-context";
import { ClientIdentity } from "@/components/clients/client-identity";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { SelectField } from "@/components/ui/select-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MultiSelect } from "@/components/ui/multi-select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Avatar } from "@/components/ui/avatar";
import { PriorityBadge } from "@/components/tasks/priority-badge";
import { TaskLabels } from "@/components/tasks/label-picker";
import { TaskUpdates } from "@/components/tasks/task-updates";
import { STATUS_OPTIONS, PRIORITY_OPTIONS, type ChecklistItem } from "@/lib/task-templates";
import { AREAS, areaInfo } from "@/lib/areas";
import { formatDateBR } from "@/lib/dates";
import { type TaskData, type UserSummary, type TaskAttachmentData } from "@/lib/types";
import {
  CheckSquare, Square, Clock, Calendar, Tag, Pencil, Trash2, ArrowLeftRight, Check, Paperclip,
  Upload, Download, Loader2, X, ChevronLeft, ChevronRight, FolderKanban,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Tipos exibidos inline (SVG fica de fora: pode carregar script). */
const PREVIEWABLE = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface ProjectOption { id: string; name: string; status: string }

interface TaskDetailModalProps {
  open: boolean;
  onClose: () => void;
  task: TaskData | null;
  onUpdated: () => void;
  /** Mudanças salvas na hora (prioridade, etiquetas, descrição) que a lista deve refletir sem fechar o modal. */
  onTaskChanged?: (task: TaskData) => void;
  onAttachmentsChanged?: () => void;
  users?: UserSummary[];
  clients?: { id: string; name: string }[];
}

export function TaskDetailModal({ open, onClose, task, onUpdated, onTaskChanged, onAttachmentsChanged, users = [], clients = [] }: TaskDetailModalProps) {
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [status, setStatus] = useState("");
  const [actualTime, setActualTime] = useState("");
  const [area, setArea] = useState("");
  const [projectId, setProjectId] = useState("");
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [priority, setPriority] = useState("MEDIUM");
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [transferMode, setTransferMode] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Edit mode fields
  const [editTitle, setEditTitle] = useState("");
  const [editClientId, setEditClientId] = useState("");
  const [editAssigneeIds, setEditAssigneeIds] = useState<string[]>([]);
  const [editStartDate, setEditStartDate] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editPublishDate, setEditPublishDate] = useState("");
  const [editIsExtra, setEditIsExtra] = useState(false);
  const [editEstimatedTime, setEditEstimatedTime] = useState("");

  // Transfer mode fields
  const [transferAssigneeIds, setTransferAssigneeIds] = useState<string[]>([]);
  const [transferNote, setTransferNote] = useState("");
  const [transferSaving, setTransferSaving] = useState(false);

  const { user } = useAuth();
  const [deletingAttachment, setDeletingAttachment] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<TaskAttachmentData[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const images = attachments.filter((a) => PREVIEWABLE.has(a.mimeType));
  const files = attachments.filter((a) => !PREVIEWABLE.has(a.mimeType));

  useEffect(() => {
    if (task) {
      setAttachments(task.attachments ?? []);
      setChecklist(Array.isArray(task.checklist) ? task.checklist : []);
      setStatus(task.status);
      setActualTime(task.actualTime ? String(task.actualTime) : "");
      setArea(task.area ?? "");
      setProjectId(task.projectId ?? "");
      setPriority(task.priority);
      setLabelIds(task.labelIds ?? []);
      setInlineError(null);
      setEditMode(false);
      setTransferMode(false);
      setPreviewIndex(null);
      setEditTitle(task.title);
      setEditClientId(task.clientId || "");
      setEditAssigneeIds(task.assignees.map((a) => a.user.id));
      setEditStartDate(task.startDate ? task.startDate.slice(0, 10) : "");
      setEditDueDate(task.dueDate ? task.dueDate.slice(0, 10) : "");
      setEditPublishDate(task.publishDate ? task.publishDate.slice(0, 10) : "");
      setEditIsExtra(task.isExtra);
      setEditEstimatedTime(task.estimatedTime ? String(task.estimatedTime) : "");
      setTransferAssigneeIds(task.assignees.map((a) => a.user.id));
      setTransferNote("");
    }
  }, [task]);

  useEffect(() => {
    if (!open || !task?.id) return;
    const controller = new AbortController();
    setLoadingAttachments(true);
    setAttachmentError(null);
    fetch(`/api/tasks/${task.id}/attachments`, { signal: controller.signal })
      .then(async (res) => { if (!res.ok) throw new Error("Não foi possível carregar os anexos"); return res.json(); })
      .then(setAttachments)
      .catch((error) => { if (!controller.signal.aborted) setAttachmentError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoadingAttachments(false); });
    return () => controller.abort();
  }, [open, task?.id]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/projects?summary=1")
      .then((r) => (r.ok ? r.json() : []))
      .then(setProjects)
      .catch(() => setProjects([]));
  }, [open]);

  // Setas navegam entre as imagens; Esc fecha só a prévia (captura antes do modal).
  useEffect(() => {
    if (previewIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.stopPropagation(); setPreviewIndex(null); }
      else if (e.key === "ArrowRight") setPreviewIndex((i) => (i === null ? i : (i + 1) % images.length));
      else if (e.key === "ArrowLeft") setPreviewIndex((i) => (i === null ? i : (i - 1 + images.length) % images.length));
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [previewIndex, images.length]);

  if (!task) return null;

  const attachmentUrl = (id: string) => `/api/tasks/${task.id}/attachments/${id}`;
  const canDelete = (att: TaskAttachmentData) => user?.role === "ADMIN" || user?.id === att.uploadedBy.id;
  const checkDone = checklist.filter((c) => c.checked).length;
  const checkTotal = checklist.length;
  const preview = previewIndex !== null ? images[previewIndex] : null;

  function toggleCheckItem(id: string) {
    setChecklist((prev) => prev.map((c) => c.id === id ? { ...c, checked: !c.checked } : c));
  }

  /** Salva na hora um campo do topo (prioridade, etiquetas) e avisa a lista. */
  async function saveInline(changes: Record<string, unknown>, rollback: () => void, message: string) {
    if (!task) return;
    setInlineError(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      if (!res.ok) throw new Error();
      onTaskChanged?.(await res.json());
    } catch {
      rollback();
      setInlineError(message);
    }
  }

  function changePriority(next: string) {
    const previous = priority;
    setPriority(next);
    saveInline({ priority: next }, () => setPriority(previous), "Não foi possível alterar a prioridade.");
  }

  function changeLabels(next: string[]) {
    const previous = labelIds;
    setLabelIds(next);
    saveInline({ labelIds: next }, () => setLabelIds(previous), "Não foi possível salvar as etiquetas.");
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

  async function handleUploadAttachment(file: File) {
    if (!task) return;
    setAttachmentError(null);
    if (file.size === 0 || file.size > 8 * 1024 * 1024) {
      setAttachmentError("Selecione um arquivo não vazio de até 8 MB.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/tasks/${task.id}/attachments`, { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Não foi possível enviar o arquivo");
      }
      const created: TaskAttachmentData = await res.json();
      setAttachments((prev) => [...prev, created]);
      onAttachmentsChanged?.();
    } catch (e) {
      setAttachmentError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteAttachment(attachmentId: string) {
    if (!task) return;
    setDeletingAttachment(attachmentId);
    setAttachmentError(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}/attachments/${attachmentId}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Não foi possível remover o arquivo");
      }
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      setPreviewIndex(null);
      onAttachmentsChanged?.();
    } catch (e) {
      setAttachmentError((e as Error).message);
    } finally {
      setDeletingAttachment(null);
    }
  }

  async function handleTransfer() {
    if (!task) return;
    setTransferSaving(true);
    setTransferError(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserIds: transferAssigneeIds, note: transferNote || null }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Não foi possível transferir a tarefa");
      }
      setTransferMode(false);
      onUpdated();
    } catch (e) {
      setTransferError((e as Error).message || "Não foi possível transferir a tarefa");
    } finally {
      setTransferSaving(false);
    }
  }

  async function save() {
    if (!task) return;
    setSaving(true);
    try {
      // A descrição não vai aqui: ela é salva pela própria linha do tempo, que pode estar mais nova.
      const payload: Record<string, unknown> = {
        checklist,
        status,
        actualTime: actualTime ? parseFloat(actualTime) : null,
        area: area || null,
        projectId: projectId || null,
        priority,
        labelIds,
      };

      if (editMode) {
        payload.title = editTitle;
        payload.clientId = editClientId || null;
        payload.assigneeIds = editAssigneeIds;
        payload.startDate = editStartDate || null;
        payload.dueDate = editDueDate || null;
        payload.publishDate = editPublishDate || null;
        payload.isExtra = editIsExtra;
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
  const taskArea = areaInfo(task.area);
  const statusVariant = ({ PENDING: "default", IN_PROGRESS: "info", IN_REVIEW: "purple", COMPLETED: "success", CANCELLED: "danger" } as const)[task.status] || "default";

  return (
    <>
      <Modal open={open} onClose={() => { if (!uploading && deletingAttachment === null) onClose(); }} title={editMode ? "Editar Tarefa" : transferMode ? "Transferir Tarefa" : task.title} size="xl">
        <div className="space-y-6">

          {/* TRANSFER MODE */}
          {transferMode ? (
            <div className="space-y-5">
              <div className="bg-accent-dark/10 border border-accent-dark/20 rounded-xl p-4 text-sm text-accent">
                <p className="font-medium mb-1">Transferindo: <span className="text-gray-900">{task.title}</span></p>
                <p className="text-accent/70">Selecione o(s) novo(s) responsável(is) pela tarefa.</p>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Responsáveis atuais</p>
                <div className="flex flex-wrap gap-2">
                  {task.assignees.length > 0 ? task.assignees.map((a) => (
                    <span key={a.user.id} className="flex items-center gap-1.5 text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg border border-gray-300">
                      <Avatar name={a.user.name} image={a.user.image} size={20} className="text-[10px]" />
                      {a.user.name}
                    </span>
                  )) : (
                    <span className="text-xs text-gray-400">Nenhum responsável atribuído</span>
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

              {transferError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{transferError}</p>
              )}

              <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
                <button
                  onClick={() => setTransferMode(false)}
                  className="px-4 py-2 text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <div className="flex-1" />
                <button
                  onClick={handleTransfer}
                  disabled={transferSaving || transferAssigneeIds.length === 0}
                  className="flex items-center gap-2 px-6 py-2 text-sm bg-accent hover:bg-accent-dark disabled:opacity-50 text-white font-bold rounded-lg transition-colors"
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
                <PriorityBadge priority={priority} onChange={changePriority} />
                {task.type && <Badge>{task.type.replace(/_/g, " ")}</Badge>}
                {taskArea && <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", taskArea.color)}>{taskArea.label}</span>}
                {task.project && (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    <FolderKanban size={11} /> {task.project.name}
                  </span>
                )}
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => { setTransferError(null); setTransferMode(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors"
                  >
                    <ArrowLeftRight size={12} /> Transferir
                  </button>
                  <button
                    onClick={() => setEditMode(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent bg-accent-dark/10 hover:bg-accent-dark/20 rounded-lg transition-colors"
                  >
                    <Pencil size={12} /> Editar
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Tag size={14} className="text-gray-400 mt-1 shrink-0" />
                <TaskLabels labelIds={labelIds} onChange={changeLabels} />
              </div>
              {inlineError && <p className="text-xs text-red-600">{inlineError}</p>}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {task.client && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <ClientIdentity client={task.client} size={24} />
                  </div>
                )}
                {task.dueDate && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Calendar size={14} className="text-accent-dark" />
                    <span>{formatDateBR(task.dueDate)}</span>
                  </div>
                )}
                {task.estimatedTime && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Clock size={14} className="text-accent-dark" />
                    <span>{task.estimatedTime}h estimado</span>
                  </div>
                )}
                {task.assignees.length > 0 && (
                  <div className="flex items-center gap-1 text-gray-500">
                    {task.assignees.map((a, i) => (
                      <span key={i} title={a.user.name}>
                        <Avatar name={a.user.name} image={a.user.image} size={24} className="text-[10px]" />
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {task.tags?.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] text-gray-400">Tags:</span>
                  {task.tags.map((tag) => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{tag}</span>
                  ))}
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
                <SelectField label="Prioridade" value={priority} onChange={setPriority}
                  options={PRIORITY_OPTIONS.map((p) => ({ value: p.value, label: p.label }))} />
                <Input label="Tempo Estimado (h)" type="number" step="0.5" value={editEstimatedTime}
                  onChange={(e) => setEditEstimatedTime(e.target.value)} />
                <Input label="Data Início" type="date" value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)} />
                <Input label="Data Entrega" type="date" value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <Input label="Data de Publicação (calendário de conteúdo)" type="date" value={editPublishDate}
                  onChange={(e) => setEditPublishDate(e.target.value)} />
                <label className="flex items-center gap-2 mb-2.5 text-sm text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={editIsExtra} onChange={(e) => setEditIsExtra(e.target.checked)} className="rounded accent-current text-accent" />
                  Demanda extra (acima do combinado)
                </label>
              </div>
            </>
          )}

          {/* Descrição e atualizações: uma linha do tempo só, com @menção */}
          {!transferMode && <TaskUpdates task={task} users={users} onTaskChanged={onTaskChanged} />}

          {/* Status, área, projeto e tempo (sempre visíveis, fora da transferência) */}
          {!transferMode && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <SelectField label="Status" value={status} onChange={setStatus}
                options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))} />
              <SelectField label="Área" value={area} onChange={setArea} placeholder="Sem área"
                options={AREAS.map((a) => ({ value: a.value, label: a.label }))} />
              <SelectField label="Projeto" value={projectId} onChange={setProjectId} placeholder="Sem projeto"
                options={projects
                  .filter((p) => p.status !== "CONCLUIDO" || p.id === projectId)
                  .map((p) => ({ value: p.id, label: p.name }))} />
              <Input label="Tempo Real (horas)" type="number" step="0.5" value={actualTime}
                onChange={(e) => setActualTime(e.target.value)} placeholder="0" />
            </div>
          )}

          {/* Checklist (not in transfer mode) */}
          {!transferMode && checklist.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs text-gray-400 uppercase tracking-wider">Checklist</h3>
                <span className="text-xs text-gray-400">{checkDone}/{checkTotal}</span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full mb-4 overflow-hidden">
                <div className="h-full bg-accent-dark rounded-full transition-all duration-300"
                  style={{ width: checkTotal > 0 ? `${(checkDone / checkTotal) * 100}%` : "0%" }} />
              </div>
              <div className="space-y-1">
                {checklist.map((item) => (
                  <button key={item.id} onClick={() => toggleCheckItem(item.id)}
                    className="flex items-center gap-3 w-full text-left py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors">
                    {item.checked ? (
                      <CheckSquare size={16} className="text-accent-dark shrink-0" />
                    ) : (
                      <Square size={16} className="text-gray-400 shrink-0" />
                    )}
                    <span className={`text-sm ${item.checked ? "text-gray-400 line-through" : "text-gray-600"}`}>
                      {item.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Anexos (not in transfer mode) */}
          {!transferMode && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Paperclip size={12} /> Anexos {attachments.length > 0 && `(${attachments.length})`}
                </h3>
                <label className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-dark cursor-pointer transition-colors">
                  {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  Anexar arquivo
                  <input
                    type="file"
                    className="hidden"
                    disabled={uploading || loadingAttachments || deletingAttachment !== null}
                    onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) handleUploadAttachment(f); }}
                  />
                </label>
              </div>

              <p className="text-xs text-gray-400 mb-2">Até 8 MB por arquivo. Os anexos são salvos automaticamente.</p>
              {attachmentError && <p className="text-xs text-red-600 mb-2">{attachmentError}</p>}

              {loadingAttachments ? <p className="text-xs text-gray-400">Carregando anexos...</p> : attachments.length === 0 ? (
                <p className="text-xs text-gray-400">Nenhum arquivo anexado ainda.</p>
              ) : (
                <>
                  {images.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-2">
                      {images.map((att, i) => (
                        <div key={att.id} className="group relative aspect-square rounded-lg overflow-hidden border border-gray-200 bg-white">
                          <button type="button" onClick={() => setPreviewIndex(i)} title={`Ampliar ${att.fileName}`} className="w-full h-full cursor-zoom-in">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`${attachmentUrl(att.id)}?inline=1`} alt={att.fileName} loading="lazy" className="w-full h-full object-cover" />
                          </button>
                          {canDelete(att) && (
                            <button
                              type="button"
                              disabled={deletingAttachment !== null || uploading}
                              onClick={() => handleDeleteAttachment(att.id)}
                              title="Remover"
                              className="absolute top-1 right-1 p-1 rounded-md bg-white/90 text-gray-500 hover:text-red-600 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                            >
                              {deletingAttachment === att.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {files.length > 0 && (
                    <div className="space-y-1.5">
                      {files.map((att) => (
                        <div key={att.id} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
                          <Paperclip size={13} className="text-gray-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <a
                              href={attachmentUrl(att.id)}
                              download={att.fileName}
                              className="text-sm text-gray-700 hover:text-accent-dark truncate block"
                              title={`Baixar ${att.fileName}`}
                            >
                              {att.fileName}
                            </a>
                            <p className="text-[11px] text-gray-400">
                              {formatFileSize(att.size)} · {att.uploadedBy.name} · {new Date(att.createdAt).toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                          <a
                            href={attachmentUrl(att.id)}
                            download={att.fileName}
                            title="Baixar"
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-accent-dark transition-colors shrink-0"
                          >
                            <Download size={14} />
                          </a>
                          {canDelete(att) && <button
                            disabled={deletingAttachment !== null || uploading || loadingAttachments}
                            onClick={() => handleDeleteAttachment(att.id)}
                            title="Remover"
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors shrink-0"
                          >
                            <Trash2 size={14} />
                          </button>}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Actions (not in transfer mode) */}
          {!transferMode && (
            <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-600 transition-colors"
                title="Excluir tarefa"
              >
                <Trash2 size={16} />
              </button>
              {editMode && (
                <button onClick={() => setEditMode(false)}
                  className="px-4 py-2 text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                  Cancelar Edição
                </button>
              )}
              <div className="flex-1" />
              <button onClick={save} disabled={saving || uploading || deletingAttachment !== null}
                className="px-6 py-2 text-sm bg-accent hover:bg-accent-dark disabled:opacity-50 text-white font-medium rounded-lg transition-colors">
                {saving ? "Salvando..." : "Salvar Alterações"}
              </button>
            </div>
          )}
        </div>
      </Modal>

      {/* Prévia de imagem: vai direto para o body, acima do modal (z-[100]). */}
      {preview && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={preview.fileName}
          onClick={() => setPreviewIndex(null)}
          className="fixed inset-0 z-[200] bg-black/85 flex items-center justify-center p-6"
        >
          <div className="relative flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${attachmentUrl(preview.id)}?inline=1`}
              alt={preview.fileName}
              className="max-w-[90vw] max-h-[80vh] object-contain rounded-lg shadow-2xl bg-white"
            />
            <div className="mt-3 flex items-center gap-3 text-sm text-white/90">
              <span className="truncate max-w-[50vw]">{preview.fileName}</span>
              {images.length > 1 && <span className="text-white/50">{(previewIndex ?? 0) + 1}/{images.length}</span>}
              <a
                href={attachmentUrl(preview.id)}
                download={preview.fileName}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 transition-colors"
              >
                <Download size={14} /> Baixar
              </a>
            </div>
            <button
              type="button"
              onClick={() => setPreviewIndex(null)}
              aria-label="Fechar prévia"
              className="absolute -top-3 -right-3 p-1.5 rounded-full bg-white text-gray-700 shadow-lg hover:bg-gray-100"
            >
              <X size={16} />
            </button>
          </div>
          {images.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Imagem anterior"
                onClick={(e) => { e.stopPropagation(); setPreviewIndex((i) => (i === null ? i : (i - 1 + images.length) % images.length)); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/15 hover:bg-white/30 text-white"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                type="button"
                aria-label="Próxima imagem"
                onClick={(e) => { e.stopPropagation(); setPreviewIndex((i) => (i === null ? i : (i + 1) % images.length)); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/15 hover:bg-white/30 text-white"
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}
        </div>,
        document.body
      )}

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
