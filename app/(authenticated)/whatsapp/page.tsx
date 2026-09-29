"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Building2, Loader2, LogOut, MessageCircle, QrCode, RefreshCw, Send, Settings2, UserPlus } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface SessionState { configured: boolean; status: string; session: string; provider?: "WAHA" | "META_CLOUD"; me?: { id?: string; pushName?: string } | null }
interface Conversation {
  id: string; chatId: string; phone: string; name: string | null; lastMessage: string | null;
  lastMessageAt: string | null; unreadCount: number; lead: { id: string; name: string; stage: string } | null;
  client: { id: string; name: string } | null; contactKind: "CLIENT" | "EXISTING_LEAD" | "NEW_LEAD" | "UNKNOWN";
}
interface Message { id: string; body: string; direction: "INBOUND" | "OUTBOUND"; sentAt: string; status: string | null }

const connected = (status: string) => status === "WORKING";

export default function WhatsAppPage() {
  const { user } = useAuth();
  const [session, setSession] = useState<SessionState | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrNonce, setQrNonce] = useState(() => Date.now());
  const [qrLoading, setQrLoading] = useState(true);
  const [qrError, setQrError] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const selected = useMemo(() => conversations.find((item) => item.id === selectedId) ?? null, [conversations, selectedId]);

  const loadSession = useCallback(async () => {
    const response = await fetch("/api/whatsapp/session", { cache: "no-store" });
    if (response.ok) setSession(await response.json());
  }, []);
  const loadConversations = useCallback(async () => {
    const response = await fetch("/api/whatsapp/conversations", { cache: "no-store" });
    if (response.ok) {
      const data: Conversation[] = await response.json();
      setConversations(data);
      setSelectedId((current) => {
        if (current) return current;
        const requested = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("conversation") : null;
        return (requested && data.some((item) => item.id === requested) ? requested : data[0]?.id) ?? null;
      });
    }
  }, []);
  const loadMessages = useCallback(async (id: string) => {
    const response = await fetch(`/api/whatsapp/conversations/${id}/messages`, { cache: "no-store" });
    if (response.ok) setMessages(await response.json());
  }, []);

  useEffect(() => {
    Promise.all([loadSession(), loadConversations()]).finally(() => setLoading(false));
    const timer = window.setInterval(() => { void loadSession(); void loadConversations(); }, 5000);
    return () => window.clearInterval(timer);
  }, [loadConversations, loadSession]);
  useEffect(() => {
    if (!selectedId) { setMessages([]); return; }
    void loadMessages(selectedId);
    const timer = window.setInterval(() => void loadMessages(selectedId), 4000);
    return () => window.clearInterval(timer);
  }, [loadMessages, selectedId]);

  async function start() {
    setStarting(true); setError(null);
    const response = await fetch("/api/whatsapp/session", { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) setError(data.error || "Não foi possível iniciar a conexão.");
    setQrLoading(true); setQrError(false); setQrNonce(Date.now());
    await loadSession();
    setStarting(false);
  }

  async function disconnect() {
    setConfirmDisconnect(false); setDisconnecting(true); setError(null);
    const response = await fetch("/api/whatsapp/session", { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) setError(data.error || "Não foi possível desvincular o número.");
    await loadSession(); setDisconnecting(false);
  }

  function refreshQr() {
    setQrLoading(true); setQrError(false); setQrNonce(Date.now());
  }

  async function send() {
    if (!selectedId || !text.trim() || sending) return;
    const value = text.trim(); setSending(true); setError(null);
    const response = await fetch(`/api/whatsapp/conversations/${selectedId}/messages`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: value }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) { setText(""); await loadMessages(selectedId); await loadConversations(); }
    else setError(data.error || "Não foi possível enviar a mensagem.");
    setSending(false);
  }

  return (
    <div className="min-h-[calc(100vh-90px)] flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div><h1 className="text-xl font-bold text-gray-900">WhatsApp</h1><p className="text-xs text-gray-400">Conversas conectadas ao pipeline comercial.</p></div>
        <button onClick={() => { void loadSession(); void loadConversations(); }} className="p-2 text-gray-400 hover:text-accent rounded-lg hover:bg-white" title="Atualizar"><RefreshCw size={17} /></button>
      </div>

      {loading ? <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-accent" /></div> : !session?.configured ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 max-w-2xl">
          <Settings2 className="text-accent mb-3" />
          <h2 className="font-bold text-gray-900">Servidor do WhatsApp ainda não configurado</h2>
          <p className="text-sm text-gray-500 mt-2">O painel está pronto. Configure o WAHA ou a Cloud API oficial nas variáveis de ambiente da Vercel.</p>
        </div>
      ) : !connected(session.status) ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 max-w-2xl">
          <div className="flex items-center gap-2 mb-4"><QrCode className="text-accent" /><h2 className="font-bold">Conectar número pelo QR Code</h2></div>
          {["NOT_STARTED", "STOPPED", "UNAVAILABLE", "FAILED"].includes(session.status) ? (
            <button onClick={start} disabled={starting} className="px-4 py-2 text-sm font-semibold text-white bg-accent hover:bg-accent-dark rounded-lg disabled:opacity-50">
              {starting ? "Iniciando…" : "Gerar QR Code"}
            </button>
          ) : (
            <div className="flex flex-col sm:flex-row gap-5 items-center">
              <div className="relative w-64 h-64 border border-gray-200 rounded-xl bg-white flex items-center justify-center overflow-hidden">
                {qrLoading && <Loader2 className="absolute animate-spin text-accent" />}
                {qrError && <div className="absolute inset-0 bg-white flex flex-col items-center justify-center text-center p-5"><QrCode className="text-gray-300 mb-2" /><p className="text-xs text-gray-500">O QR ainda está sendo preparado.</p><button onClick={refreshQr} className="mt-3 text-xs font-semibold text-accent">Tentar novamente</button></div>}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/whatsapp/qr?v=${qrNonce}`} alt="QR Code do WhatsApp" className={`w-full h-full object-contain ${qrLoading || qrError ? "opacity-0" : "opacity-100"}`} onLoad={() => { setQrLoading(false); setQrError(false); }} onError={() => { setQrLoading(false); setQrError(true); window.setTimeout(() => setQrNonce(Date.now()), 7000); }} />
              </div>
              <div className="text-sm text-gray-500"><p className="font-semibold text-gray-700 mb-2">No celular:</p><p>WhatsApp → Aparelhos conectados → Conectar aparelho.</p><p className="mt-3 text-xs">Status: {session.status}</p><button onClick={refreshQr} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-accent"><RefreshCw size={12} /> Atualizar QR Code</button></div>
            </div>
          )}
          {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
        </div>
      ) : (
        <div className="flex-1 min-h-[620px] grid grid-cols-[320px_1fr] bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <aside className="border-r border-gray-200 overflow-y-auto">
            <div className="px-4 py-3 border-b border-gray-200 bg-emerald-50"><div className="flex items-center justify-between gap-2"><div className="min-w-0"><p className="text-xs font-semibold text-emerald-700">WhatsApp conectado</p><p className="text-[11px] text-emerald-600 truncate">{session.me?.pushName || session.me?.id || session.session} · {session.provider === "META_CLOUD" ? "API oficial" : "WAHA"}</p></div>{user?.role === "ADMIN" && session.provider !== "META_CLOUD" && <button disabled={disconnecting} onClick={() => setConfirmDisconnect(true)} title="Desvincular número" className="p-1.5 text-emerald-700 hover:text-red-600 hover:bg-white rounded-lg">{disconnecting ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}</button>}</div></div>
            {conversations.length === 0 ? <p className="p-6 text-xs text-gray-400 text-center">As novas mensagens aparecerão aqui.</p> : conversations.map((conversation) => (
              <button key={conversation.id} onClick={() => setSelectedId(conversation.id)} className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 ${selectedId === conversation.id ? "bg-accent/5" : ""}`}>
                <div className="flex items-center gap-2"><MessageCircle size={16} className="text-emerald-600 shrink-0" /><p className="text-sm font-semibold text-gray-800 truncate flex-1">{conversation.client?.name || conversation.lead?.name || conversation.name || conversation.phone}</p>{conversation.unreadCount > 0 && <span className="text-[10px] bg-emerald-500 text-white rounded-full px-1.5 py-0.5">{conversation.unreadCount}</span>}</div>
                <p className="text-xs text-gray-400 truncate mt-1">{conversation.lastMessage}</p>
                {conversation.contactKind === "CLIENT" && <p className="text-[10px] text-blue-600 mt-1 inline-flex items-center gap-1"><Building2 size={10} /> Cliente existente</p>}
                {conversation.contactKind === "EXISTING_LEAD" && <p className="text-[10px] text-accent mt-1">Lead existente no pipeline</p>}
                {conversation.contactKind === "NEW_LEAD" && <p className="text-[10px] text-emerald-600 mt-1 inline-flex items-center gap-1"><UserPlus size={10} /> Novo lead criado</p>}
              </button>
            ))}
          </aside>
          <section className="flex flex-col min-w-0">
            {!selected ? <div className="flex-1 flex items-center justify-center text-sm text-gray-400">Selecione uma conversa.</div> : <>
              <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between"><div><p className="font-semibold text-gray-800">{selected.client?.name || selected.lead?.name || selected.name || selected.phone}</p><p className="text-xs text-gray-400">{selected.phone} · {selected.contactKind === "CLIENT" ? "Cliente" : selected.contactKind === "NEW_LEAD" ? "Novo lead" : selected.contactKind === "EXISTING_LEAD" ? "Lead existente" : "Contato"}</p></div>{selected.lead && <Link href="/pipeline" className="text-xs font-semibold text-accent hover:underline">Ver no pipeline</Link>}</div>
              <div className="flex-1 overflow-y-auto p-5 space-y-2 bg-[#f7f5f1]">
                {messages.map((message) => <div key={message.id} className={`flex ${message.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}><div className={`max-w-[72%] rounded-xl px-3 py-2 text-sm shadow-sm ${message.direction === "OUTBOUND" ? "bg-emerald-100 text-gray-800" : "bg-white text-gray-800"}`}><p className="whitespace-pre-wrap break-words">{message.body}</p><p className="text-[9px] text-gray-400 text-right mt-1">{new Date(message.sentAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p></div></div>)}
              </div>
              <div className="p-3 border-t border-gray-200 flex gap-2"><textarea value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} rows={2} placeholder="Digite uma mensagem…" className="flex-1 resize-none px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-accent" /><button onClick={send} disabled={sending || !text.trim()} className="self-end p-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl disabled:opacity-50">{sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}</button></div>
            </>}
          </section>
        </div>
      )}
      {error && connected(session?.status ?? "") && <p className="text-xs text-red-600">{error}</p>}
      <ConfirmDialog open={confirmDisconnect} title="Desvincular WhatsApp" message="O número será desconectado da VPS. As conversas já registradas continuarão salvas e outro número poderá ser conectado por QR Code." confirmLabel="Desvincular" cancelLabel="Cancelar" onConfirm={() => void disconnect()} onCancel={() => setConfirmDisconnect(false)} />
    </div>
  );
}
