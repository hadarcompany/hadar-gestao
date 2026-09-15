"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Avatar } from "@/components/ui/avatar";
import { MentionTextarea, MentionText } from "@/components/tasks/mention-textarea";
import { type TaskData, type UserSummary } from "@/lib/types";
import { Loader2, Send, Trash2, MessageSquare, Pencil } from "lucide-react";

interface TaskUpdateItem {
  id: string;
  content: string;
  createdAt: string;
  mentionedUserIds: string[];
  author: { id: string; name: string; image?: string | null } | null;
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/**
 * Descrição e atualizações numa linha do tempo só: a descrição é o primeiro registro
 * e cada atualização entra embaixo. Sem descrição ainda, o primeiro texto vira a descrição.
 */
export function TaskUpdates({
  task, users, onTaskChanged,
}: {
  task: TaskData;
  users: UserSummary[];
  onTaskChanged?: (task: TaskData) => void;
}) {
  const { user } = useAuth();
  const [items, setItems] = useState<TaskUpdateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [description, setDescription] = useState(task.description ?? "");
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");
  const [savingDesc, setSavingDesc] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDescription(task.description ?? "");
    setEditingDesc(false);
  }, [task.id, task.description]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/tasks/${task.id}/updates`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Não foi possível carregar as atualizações"))))
      .then((data: TaskUpdateItem[]) => setItems([...data].reverse()))
      .catch((e) => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [task.id]);

  const hasDescription = description.trim().length > 0;
  const isEmpty = !hasDescription && items.length === 0;
  const creator = users.find((u) => u.id === task.createdBy?.id);

  async function patchDescription(next: string) {
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: next.trim() ? next : null }),
    });
    if (!res.ok) throw new Error("Não foi possível salvar a descrição");
    const updated: TaskData = await res.json();
    setDescription(updated.description ?? "");
    onTaskChanged?.(updated);
  }

  async function saveDescriptionEdit() {
    setSavingDesc(true);
    setError(null);
    try {
      await patchDescription(descDraft);
      setEditingDesc(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingDesc(false);
    }
  }

  async function publish() {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setError(null);
    try {
      if (isEmpty) {
        await patchDescription(content);
      } else {
        const res = await fetch(`/api/tasks/${task.id}/updates`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Não foi possível publicar a atualização");
        const created: TaskUpdateItem = await res.json();
        setItems((prev) => [...prev, created]);
        onTaskChanged?.({ ...task, description: description || null, _count: { updates: items.length + 1 } });
      }
      setText("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function remove(id: string) {
    const previous = items;
    setItems((prev) => prev.filter((i) => i.id !== id));
    const res = await fetch(`/api/tasks/${task.id}/updates/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setItems(previous);
      setError("Não foi possível excluir a atualização.");
    }
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
      <h3 className="text-xs text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
        <MessageSquare size={12} /> Descrição e atualizações {items.length > 0 && `(${items.length})`}
      </h3>

      {(hasDescription || editingDesc || items.length > 0) && (
        <ol className="space-y-2 mb-3">
          {(hasDescription || editingDesc) && (
            <li className="group bg-white border border-gray-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Avatar name={task.createdBy?.name} image={creator?.image} size={24} className="text-[10px]" />
                <span className="text-xs font-semibold text-gray-800">{task.createdBy?.name ?? "Criador"}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-accent-dark bg-accent/10 px-1.5 py-0.5 rounded">Descrição</span>
                <span className="text-[10px] text-gray-400">{formatWhen(task.createdAt)}</span>
                {!editingDesc && (
                  <button
                    type="button"
                    onClick={() => { setDescDraft(description); setEditingDesc(true); }}
                    title="Editar descrição"
                    className="ml-auto p-1 rounded-md text-gray-300 hover:text-accent-dark hover:bg-gray-100 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                  >
                    <Pencil size={13} />
                  </button>
                )}
              </div>
              {editingDesc ? (
                <div className="mt-2">
                  <MentionTextarea
                    value={descDraft}
                    onChange={setDescDraft}
                    users={users}
                    excludeUserId={user?.id}
                    onSubmit={saveDescriptionEdit}
                    rows={Math.min(12, Math.max(3, descDraft.split("\n").length + 1))}
                    autoFocus
                    ariaLabel="Descrição da tarefa"
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button type="button" onClick={() => setEditingDesc(false)} className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg">
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={saveDescriptionEdit}
                      disabled={savingDesc}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-accent hover:bg-accent-dark rounded-lg disabled:opacity-50"
                    >
                      {savingDesc ? <Loader2 size={12} className="inline animate-spin" /> : "Salvar descrição"}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-700 whitespace-pre-wrap break-words pl-8">
                  <MentionText content={description} users={users} />
                </p>
              )}
            </li>
          )}

          {items.map((it) => (
            <li key={it.id} className="group bg-white border border-gray-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Avatar name={it.author?.name} image={it.author?.image} size={24} className="text-[10px]" />
                <span className="text-xs font-semibold text-gray-800">{it.author?.name ?? "Usuário removido"}</span>
                <span className="text-[10px] text-gray-400">{formatWhen(it.createdAt)}</span>
                {(it.author?.id === user?.id || user?.role === "ADMIN") && (
                  <button
                    type="button"
                    onClick={() => remove(it.id)}
                    title="Excluir atualização"
                    className="ml-auto p-1 rounded-md text-gray-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap break-words pl-8">
                <MentionText content={it.content} users={users} />
              </p>
            </li>
          ))}
        </ol>
      )}

      {loading && <p className="text-xs text-gray-400 mb-2">Carregando atualizações...</p>}

      <MentionTextarea
        value={text}
        onChange={setText}
        users={users}
        excludeUserId={user?.id}
        onSubmit={publish}
        rows={isEmpty ? 4 : 2}
        ariaLabel={isEmpty ? "Descrição da tarefa" : "Nova atualização"}
        placeholder={isEmpty
          ? "Escreva a descrição da tarefa… use @ para marcar alguém"
          : "Escreva uma atualização… use @ para marcar alguém"}
      />
      <div className="flex items-center justify-between gap-3 mt-2">
        <span className="text-[11px] text-gray-400">Ctrl + Enter publica. Quem for marcado com @ recebe notificação.</span>
        <button
          type="button"
          onClick={publish}
          disabled={sending || !text.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-accent hover:bg-accent-dark disabled:opacity-50 text-white rounded-lg transition-colors shrink-0"
        >
          {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          {isEmpty ? "Salvar descrição" : "Publicar atualização"}
        </button>
      </div>

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
