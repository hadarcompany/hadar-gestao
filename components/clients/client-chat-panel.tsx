"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { TaskDetailModal } from "@/components/tasks/task-detail-modal";
import { Avatar } from "@/components/ui/avatar";
import { statusLabel } from "@/lib/status-labels";
import { Loader2, Send, AtSign, Link2, X, CheckSquare } from "lucide-react";
import { type TaskData, type UserSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  content: string;
  isSystem: boolean;
  createdAt: string;
  author: UserSummary | null;
  task: { id: string; title: string; status: string } | null;
  mentionedUserIds: string[];
}

export function ClientChatPanel({ clientId }: { clientId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastReadAt, setLastReadAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [users, setUsers] = useState<UserSummary[]>([]);
  const [clientTasks, setClientTasks] = useState<{ id: string; title: string; status: string }[]>([]);
  const [showMentionList, setShowMentionList] = useState(false);
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [linkedTask, setLinkedTask] = useState<{ id: string; title: string } | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskData | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/chat`);
      const data = await res.json();
      setMessages(data.messages ?? []);
      setLastReadAt(data.lastReadAt);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchMessages();
    fetch("/api/users").then((r) => r.json()).then(setUsers);
    fetch(`/api/tasks?clientId=${clientId}`).then((r) => r.json()).then((d) =>
      setClientTasks((Array.isArray(d) ? d : []).map((t: TaskData) => ({ id: t.id, title: t.title, status: t.status })))
    );
    fetch(`/api/clients/${clientId}/chat/read`, { method: "POST" }).catch(() => {});
  }, [clientId, fetchMessages]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "nearest" }); }, [messages.length]);

  useEffect(() => {
    if (!selectedTaskId) { setSelectedTask(null); return; }
    fetch(`/api/tasks/${selectedTaskId}`).then((r) => r.json()).then(setSelectedTask);
  }, [selectedTaskId]);

  function insertMention(name: string) {
    const handle = name.split(" ")[0];
    setContent((prev) => `${prev}${prev.endsWith(" ") || prev === "" ? "" : " "}@${handle} `);
    setShowMentionList(false);
  }

  async function handleSend() {
    if (!content.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim(), taskId: linkedTask?.id || null }),
      });
      if (!res.ok) throw new Error("Não foi possível enviar a mensagem");
      setContent("");
      setLinkedTask(null);
      await fetchMessages();
      await fetch(`/api/clients/${clientId}/chat/read`, { method: "POST" }).catch(() => {});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-accent" /></div>;

  return (
    <div className="flex flex-col h-[420px]">
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-3">
        {messages.length === 0 && <p className="text-xs text-gray-400 text-center py-10">Nenhuma mensagem ainda. Comece a conversa da equipe sobre este cliente.</p>}
        {messages.map((m) => {
          const isUnread = lastReadAt ? new Date(m.createdAt) > new Date(lastReadAt) : false;
          if (m.isSystem) {
            return (
              <div key={m.id} className="text-center text-[11px] text-gray-400 bg-gray-50 rounded-lg py-1.5 px-3">
                {m.content}
                {m.task && (
                  <button onClick={() => setSelectedTaskId(m.task!.id)} className="ml-1 text-accent-dark hover:underline font-medium">
                    Ver tarefa
                  </button>
                )}
              </div>
            );
          }
          return (
            <div key={m.id} className={cn("flex items-start gap-2 p-2 rounded-lg", isUnread && "bg-accent/5")}>
              <Avatar name={m.author?.name} image={m.author?.image} size={28} className="text-[11px]" />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-gray-800">{m.author?.name ?? "Usuário removido"}</span>
                  <span className="text-[10px] text-gray-400">{new Date(m.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{m.content}</p>
                {m.task && (
                  <button
                    onClick={() => setSelectedTaskId(m.task!.id)}
                    className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-accent-dark bg-accent/10 hover:bg-accent/20 px-2 py-0.5 rounded-full transition-colors"
                  >
                    <CheckSquare size={10} /> {m.task.title} · {statusLabel(m.task.status)}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {linkedTask && (
        <div className="flex items-center gap-2 mb-2 text-xs bg-accent/10 text-accent-dark px-2.5 py-1.5 rounded-lg w-fit">
          <Link2 size={12} /> {linkedTask.title}
          <button onClick={() => setLinkedTask(null)}><X size={12} /></button>
        </div>
      )}

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      <div className="relative flex items-end gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => { setShowMentionList((v) => !v); setShowTaskPicker(false); }}
            title="Mencionar alguém"
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-accent-dark transition-colors"
          >
            <AtSign size={16} />
          </button>
          {showMentionList && (
            <div className="absolute bottom-full mb-1 left-0 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-40 overflow-y-auto">
              {users.map((u) => (
                <button key={u.id} onClick={() => insertMention(u.name)} className="w-full flex items-center gap-2 text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                  <Avatar name={u.name} image={u.image} size={18} className="text-[9px]" />
                  {u.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => { setShowTaskPicker((v) => !v); setShowMentionList(false); }}
            title="Vincular tarefa"
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-accent-dark transition-colors"
          >
            <Link2 size={16} />
          </button>
          {showTaskPicker && (
            <div className="absolute bottom-full mb-1 left-0 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-40 overflow-y-auto">
              {clientTasks.length === 0 && <p className="text-xs text-gray-400 p-2">Nenhuma tarefa deste cliente.</p>}
              {clientTasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setLinkedTask({ id: t.id, title: t.title }); setShowTaskPicker(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 truncate"
                >
                  {t.title}
                </button>
              ))}
            </div>
          )}
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Mensagem para a equipe sobre este cliente... use @nome para mencionar"
          rows={1}
          className="flex-1 resize-none bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-accent/50"
        />
        <button
          onClick={handleSend}
          disabled={sending || !content.trim()}
          className="p-2.5 rounded-lg bg-accent hover:bg-accent-dark disabled:opacity-50 text-white transition-colors shrink-0"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>

      <TaskDetailModal
        open={!!selectedTask}
        onClose={() => setSelectedTaskId(null)}
        task={selectedTask}
        onUpdated={() => setSelectedTaskId(null)}
        users={users}
        clients={[]}
      />
    </div>
  );
}
