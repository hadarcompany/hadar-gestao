"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Avatar } from "@/components/ui/avatar";
import { type UserSummary } from "@/lib/types";
import { Loader2, Send, Trash2, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskUpdateItem {
  id: string;
  content: string;
  createdAt: string;
  mentionedUserIds: string[];
  author: { id: string; name: string; image?: string | null } | null;
}

/** "@texto" logo antes do cursor: é o que abre a lista de pessoas para mencionar. */
const MENTION_AT_CURSOR = /@([\p{L}0-9._-]*)$/u;

function firstName(name: string) {
  return name.split(" ")[0];
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function renderContent(content: string, users: UserSummary[]) {
  const handles = new Set(users.map((u) => firstName(u.name).toLowerCase()));
  return content.split(/(@[\p{L}0-9._-]+)/u).map((part, i) =>
    part.startsWith("@") && handles.has(part.slice(1).toLowerCase()) ? (
      <span key={i} className="font-semibold text-accent-dark bg-accent/10 rounded px-0.5">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export function TaskUpdates({ taskId, users }: { taskId: string; users: UserSummary[] }) {
  const { user } = useAuth();
  const [items, setItems] = useState<TaskUpdateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/tasks/${taskId}/updates`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Não foi possível carregar as atualizações"))))
      .then(setItems)
      .catch((e) => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [taskId]);

  const suggestions = query === null
    ? []
    : users
        .filter((u) => u.id !== user?.id)
        .filter((u) => u.name.toLowerCase().split(" ").some((part) => part.startsWith(query.toLowerCase())))
        .slice(0, 6);

  function updateQuery(value: string, cursor: number) {
    const match = MENTION_AT_CURSOR.exec(value.slice(0, cursor));
    setQuery(match ? match[1] : null);
    setHighlight(0);
  }

  function pick(u: UserSummary) {
    const el = inputRef.current;
    const cursor = el?.selectionStart ?? text.length;
    const before = text.slice(0, cursor).replace(MENTION_AT_CURSOR, `@${firstName(u.name)} `);
    const next = before + text.slice(cursor);
    setText(next);
    setQuery(null);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(before.length, before.length);
    });
  }

  async function send() {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Não foi possível publicar a atualização");
      const created: TaskUpdateItem = await res.json();
      setItems((prev) => [created, ...prev]);
      setText("");
      setQuery(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function remove(id: string) {
    const previous = items;
    setItems((prev) => prev.filter((i) => i.id !== id));
    const res = await fetch(`/api/tasks/${taskId}/updates/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setItems(previous);
      setError("Não foi possível excluir a atualização.");
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (suggestions.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => (h + 1) % suggestions.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(suggestions[highlight]); return; }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setQuery(null); return; }
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); }
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
      <h3 className="text-xs text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
        <MessageSquare size={12} /> Atualizações {items.length > 0 && `(${items.length})`}
      </h3>

      <div className="relative">
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => { setText(e.target.value); updateQuery(e.target.value, e.target.selectionStart ?? e.target.value.length); }}
          onKeyDown={onKeyDown}
          onClick={(e) => updateQuery(text, e.currentTarget.selectionStart ?? text.length)}
          onBlur={() => setQuery(null)}
          rows={2}
          aria-label="Nova atualização"
          placeholder="Escreva uma atualização… use @ para mencionar alguém"
          className="w-full resize-y bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-accent/50"
        />
        {suggestions.length > 0 && (
          <div role="listbox" className="absolute left-2 top-full -mt-1 w-60 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
            {suggestions.map((u, i) => (
              <button
                key={u.id}
                type="button"
                role="option"
                aria-selected={i === highlight}
                onMouseDown={(e) => { e.preventDefault(); pick(u); }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left",
                  i === highlight ? "bg-accent/10 text-accent-dark" : "text-gray-700 hover:bg-gray-50"
                )}
              >
                <Avatar name={u.name} image={u.image} size={20} className="text-[9px]" />
                {u.name}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between gap-3 mt-2">
          <span className="text-[11px] text-gray-400">Ctrl + Enter publica. Quem for mencionado recebe notificação.</span>
          <button
            type="button"
            onClick={send}
            disabled={sending || !text.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-accent hover:bg-accent-dark disabled:opacity-50 text-white rounded-lg transition-colors shrink-0"
          >
            {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Publicar
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      <div className="mt-3 space-y-2">
        {loading ? (
          <p className="text-xs text-gray-400">Carregando atualizações...</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-gray-400">Nenhuma atualização ainda.</p>
        ) : (
          items.map((it) => (
            <div key={it.id} className="group flex items-start gap-2.5 bg-white border border-gray-200 rounded-lg p-3">
              <Avatar name={it.author?.name} image={it.author?.image} size={28} className="text-[11px]" />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-gray-800">{it.author?.name ?? "Usuário removido"}</span>
                  <span className="text-[10px] text-gray-400">{formatWhen(it.createdAt)}</span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap break-words mt-0.5">{renderContent(it.content, users)}</p>
              </div>
              {(it.author?.id === user?.id || user?.role === "ADMIN") && (
                <button
                  type="button"
                  onClick={() => remove(it.id)}
                  title="Excluir atualização"
                  className="p-1 rounded-md text-gray-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
