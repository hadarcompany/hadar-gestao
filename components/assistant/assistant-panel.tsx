"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Check, ChevronDown, FileText, History, Loader2, Mic, MicOff, Paperclip, Plus, Send, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { ActionView, AssistantAttachment, AssistantReply, ChatMessage } from "@/lib/assistant/types";
import { assistantConversationContext, attachmentMediaType, ATTACHMENT_ACCEPT, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS } from "@/lib/assistant/attachments";

type RecognitionResult = { isFinal: boolean; [index: number]: { transcript: string } };
type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: { results: ArrayLike<RecognitionResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
type RecognitionConstructor = new () => Recognition;
type PanelMessage = ChatMessage & { id: string; actions?: ActionView[] };
const STATUS = { PENDING: "Aguardando confirmação", RUNNING: "Execução iniciada — confira o registro", COMPLETED: "Concluída", FAILED: "Falhou — confira o registro", CANCELLED: "Cancelada" };
const FIELD_LABELS: Record<string, string> = {
  title: "Título", name: "Nome", description: "Descrição", type: "Tipo", status: "Status", priority: "Prioridade",
  dueDate: "Prazo", startDate: "Início", publishDate: "Publicação", clientId: "Cliente", assigneeIds: "Responsáveis", toUserIds: "Novos responsáveis",
  area: "Área", projectId: "Projeto", amount: "Valor", date: "Data", category: "Categoria", month: "Mês", year: "Ano", paymentMethod: "Pagamento",
  creditCardId: "Cartão", paidWithCash: "Descontar da reserva", bank: "Banco", brand: "Bandeira", isActive: "Ativo", stage: "Etapa", email: "E-mail", phone: "Telefone",
  targetValue: "Valor da meta", note: "Observação", id: "Registro", value: "Valor", ownerId: "Responsável",
};

function readAttachment(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") { reject(new Error("Não foi possível ler o arquivo.")); return; }
      resolve(reader.result.slice(reader.result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error(`Não foi possível ler ${file.name}.`));
    reader.onabort = () => reject(new Error("A leitura do arquivo foi interrompida."));
    reader.readAsDataURL(file);
  });
}

function AttachmentPreview({ attachment }: { attachment: AssistantAttachment }) {
  return <div className="flex min-w-0 items-center gap-2 text-xs">
    {attachment.mediaType === "application/pdf" ? <FileText size={24} className="shrink-0 text-accent" /> : <Image src={`data:${attachment.mediaType};base64,${attachment.data}`} alt="Prévia do anexo" width={36} height={36} unoptimized className="h-9 w-9 shrink-0 rounded object-cover" />}
    <span className="min-w-0"><span className="block truncate">{attachment.name}</span><span className="text-gray-400">{Math.ceil(attachment.size / 1000)} KB</span></span>
  </div>;
}

function ActionCard({ action, busy, onConfirm }: { action: ActionView; busy: boolean; onConfirm: (id: string, cancel: boolean) => void }) {
  const failed = action.status === "FAILED";
  const result = action.result && typeof action.result === "object" ? action.result as Record<string, unknown> : null;
  const target = result && (result.name || result.title);
  return <div className={`mt-3 rounded-xl border p-3 text-sm ${failed ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"}`}>
    <div className="flex items-center gap-2 font-semibold text-gray-800">{action.name.startsWith("excluir_") ? <Trash2 size={14} /> : <Check size={14} />}{action.label}</div>
    <p className={`text-xs mt-1 ${failed ? "text-red-700" : action.status === "COMPLETED" ? "text-emerald-700" : "text-gray-500"}`}>{STATUS[action.status]}{target ? ` · ${String(target)}` : ""}</p>
    {result?.error ? <p className="text-xs text-red-700 mt-2">{String(result.error)}</p> : null}
    <details className="mt-2 text-xs text-gray-500">
      <summary className="cursor-pointer">{action.status === "PENDING" ? "Revisar dados da ação" : "Ver dados da ação"}</summary>
      <dl className="mt-2 space-y-1 max-h-40 overflow-auto">
        {Object.entries(action.input).map(([key, value]) => <div key={key} className="break-words"><dt className="inline font-medium">{FIELD_LABELS[key] || key}: </dt><dd className="inline">{typeof value === "boolean" ? value ? "Sim" : "Não" : Array.isArray(value) ? value.join(", ") : String(value)}</dd></div>)}
      </dl>
    </details>
    {action.status === "PENDING" && <div className="mt-3 flex gap-2">
      <button disabled={busy} onClick={() => onConfirm(action.id, false)} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-accent text-white disabled:opacity-40">{action.name.startsWith("excluir_") ? "Confirmar exclusão" : "Confirmar ação"}</button>
      <button disabled={busy} onClick={() => onConfirm(action.id, true)} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40">Cancelar</button>
    </div>}
  </div>;
}

export function AssistantPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<PanelMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<AssistantAttachment[]>([]);
  const [readingFiles, setReadingFiles] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [configVersion, setConfigVersion] = useState(0);
  const [autoExecute, setAutoExecute] = useState(true);
  const [autoVoice, setAutoVoice] = useState(true);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<ActionView[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const recognition = useRef<Recognition | null>(null);
  const constructor = useRef<RecognitionConstructor | null>(null);
  const busyRef = useRef(false);
  const readingFilesRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sendRef = useRef<(text: string) => Promise<void>>(async () => {});
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const speechWindow = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
    constructor.current = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null;
    setVoiceSupported(!!constructor.current);
    return () => { if (recognition.current) { recognition.current.onend = null; recognition.current.abort(); } };
  }, []);

  useEffect(() => {
    const refreshConfiguration = () => setConfigVersion((version) => version + 1);
    window.addEventListener("hadar:assistant-configured", refreshConfiguration);
    return () => window.removeEventListener("hadar:assistant-configured", refreshConfiguration);
  }, []);

  useEffect(() => {
    if (!open) return;
    let active = true;
    fetch("/api/assistant", { cache: "no-store" }).then(async (res) => {
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Não foi possível verificar o assistente.");
      if (active) setConfigured(body.configured);
    }).catch((err) => { if (active) setError(err instanceof Error ? err.message : "Não foi possível conectar."); });
    return () => { active = false; };
  }, [open, configVersion]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, busy, open]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/assistant/actions", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível carregar o histórico.");
      setHistory(data);
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível carregar o histórico."); }
    finally { setHistoryLoading(false); }
  }, []);

  const send = useCallback(async (text: string) => {
    if ((!text.trim() && !attachments.length) || busyRef.current || readingFilesRef.current || configured === false) return;
    if (recognition.current) { recognition.current.onend = null; recognition.current.abort(); recognition.current = null; setListening(false); }
    busyRef.current = true;
    setBusy(true);
    setError("");
    const userMessage: PanelMessage = { id: crypto.randomUUID(), role: "user", content: text.trim() || "Analise os arquivos anexados.", ...(attachments.length ? { attachments } : {}) };
    const requestId = crypto.randomUUID();
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setDraft("");
    setAttachments([]);
    setShowHistory(false);
    try {
      const context = assistantConversationContext(nextMessages);
      const res = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId, autoExecute, messages: context }) });
      const reply = await res.json() as AssistantReply & { error?: string };
      if (!res.ok || reply.error) throw new Error(reply.error || "Não foi possível executar o comando.");
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: reply.text, actions: reply.actions }]);
      if (reply.navigation) router.push(reply.navigation);
      if (reply.actions.some((action) => action.status === "COMPLETED")) {
        window.dispatchEvent(new CustomEvent("hadar:assistant-updated"));
        router.refresh();
      }
    } catch (err) { setError(`${err instanceof Error ? err.message : "A conexão foi interrompida."} Confira o histórico de ações antes de repetir um comando.`); }
    finally { busyRef.current = false; setBusy(false); }
  }, [messages, attachments, configured, autoExecute, router]);

  useEffect(() => { sendRef.current = send; }, [send]);

  async function addAttachments(files: File[]) {
    if (!files.length || busyRef.current || readingFilesRef.current) return;
    readingFilesRef.current = true; setReadingFiles(true); setError("");
    try {
      const existing = [...messages.flatMap((message) => message.attachments || []), ...attachments];
      if (existing.length + files.length > MAX_ATTACHMENTS) throw new Error(`Envie até ${MAX_ATTACHMENTS} arquivos por conversa. Inicie uma nova conversa para enviar outros.`);
      if (existing.reduce((total, file) => total + file.size, 0) + files.reduce((total, file) => total + file.size, 0) > MAX_ATTACHMENT_BYTES) throw new Error("Os anexos devem somar até 3 MB por conversa. Use arquivos menores ou inicie uma nova conversa.");
      const added: AssistantAttachment[] = [];
      for (const file of files) {
        const mediaType = attachmentMediaType(file.name, file.type);
        if (!mediaType) throw new Error("Envie PDFs ou imagens JPG, PNG, GIF e WebP.");
        if (!file.size || file.name.length > 200) throw new Error(`Arquivo vazio ou nome muito longo: ${file.name.slice(0, 100)}`);
        added.push({ name: file.name, mediaType, size: file.size, data: await readAttachment(file) });
      }
      setAttachments((current) => [...current, ...added]);
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível anexar o arquivo."); }
    finally { readingFilesRef.current = false; setReadingFiles(false); }
  }

  async function confirmAction(id: string, cancel: boolean) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError("");
    try {
      const res = await fetch("/api/assistant/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, cancel }) });
      const action = await res.json() as ActionView & { error?: string };
      if (!res.ok) throw new Error(action.error || "Não foi possível concluir a ação.");
      setMessages((current) => current.map((message) => ({ ...message, actions: message.actions?.map((item) => item.id === id ? action : item) })));
      setHistory((current) => current.map((item) => item.id === id ? action : item));
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: `${action.label}: ${STATUS[action.status]}.` }]);
      if (action.status === "COMPLETED") { window.dispatchEvent(new CustomEvent("hadar:assistant-updated")); router.refresh(); }
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível confirmar a ação."); }
    finally { busyRef.current = false; setBusy(false); }
  }

  function startVoice() {
    if (listening) { recognition.current?.stop(); return; }
    if (!constructor.current || busyRef.current || readingFilesRef.current) return;
    setError("");
    const speech = new constructor.current();
    speech.lang = "pt-BR"; speech.continuous = false; speech.interimResults = true;
    const base = draft.trim();
    let finalText = "";
    let failed = false;
    speech.onresult = (event) => {
      let all = ""; let final = "";
      for (let i = 0; i < event.results.length; i++) {
        all += event.results[i][0].transcript;
        if (event.results[i].isFinal) final += event.results[i][0].transcript;
      }
      finalText = final.trim() ? [base, final.trim()].filter(Boolean).join(" ") : "";
      setDraft([base, all.trim()].filter(Boolean).join(" "));
    };
    speech.onerror = (event) => {
      failed = true;
      const errors: Record<string, string> = { "not-allowed": "Permita o uso do microfone no navegador.", "service-not-allowed": "O navegador bloqueou o reconhecimento de voz.", "no-speech": "Nenhuma fala foi detectada. Tente novamente.", "audio-capture": "Não foi possível acessar o microfone.", network: "Não foi possível transcrever a voz. Confira a conexão." };
      if (event.error !== "aborted") setError(errors[event.error] || "Não foi possível reconhecer a voz.");
    };
    speech.onend = () => {
      setListening(false); recognition.current = null;
      if (!failed && finalText && autoVoice) void sendRef.current(finalText);
    };
    recognition.current = speech;
    try { speech.start(); setListening(true); }
    catch { recognition.current = null; setError("Não foi possível iniciar o microfone."); }
  }

  function closePanel() {
    if (recognition.current) { recognition.current.onend = null; recognition.current.abort(); recognition.current = null; setListening(false); }
    setOpen(false);
  }

  return <>
    {!open && <button onClick={() => setOpen(true)} aria-label="Abrir assistente Hadar" className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-accent hover:bg-accent-dark px-5 py-3 text-white font-semibold shadow-xl"><Bot size={20} /> Assistente</button>}
    {open && <section role="dialog" aria-label="Assistente Hadar" className="fixed z-50 bottom-0 right-0 sm:bottom-5 sm:right-5 w-full sm:w-[440px] h-[min(760px,calc(100dvh-20px))] flex flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border border-gray-200 bg-white shadow-2xl">
      <header className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between gap-2">
        <div><p className="font-semibold flex items-center gap-2"><Bot size={19} /> Assistente Hadar</p><p className="text-xs text-gray-300 mt-0.5">Comandos por texto ou voz · Claude</p></div>
        <div className="flex gap-1">
          <button title="Histórico de ações" aria-label="Ver histórico de ações" disabled={busy} onClick={() => { setShowHistory(!showHistory); if (!showHistory) loadHistory(); }} className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-40"><History size={17} /></button>
          <button title="Nova conversa" aria-label="Iniciar nova conversa" disabled={busy || listening || readingFiles} onClick={() => { setMessages([]); setAttachments([]); setDraft(""); setError(""); setShowHistory(false); }} className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-40"><Plus size={18} /></button>
          <button onClick={closePanel} aria-label="Fechar assistente" className="p-2 rounded-lg hover:bg-white/10"><X size={18} /></button>
        </div>
      </header>
      <details className="border-b border-gray-200 px-4 py-2 text-xs text-gray-600">
        <summary className="cursor-pointer flex items-center justify-between">{autoExecute ? "Execução automática ativada" : "Confirmar antes de alterar"}<ChevronDown size={14} /></summary>
        <div className="space-y-2 pt-3 pb-1">
          <label className="flex gap-2 items-center"><input type="checkbox" checked={autoExecute} disabled={busy} onChange={(e) => setAutoExecute(e.target.checked)} /> Executar criações e alterações automaticamente</label>
          <label className="flex gap-2 items-center"><input type="checkbox" checked={autoVoice} disabled={listening || busy} onChange={(e) => setAutoVoice(e.target.checked)} /> Enviar o comando ao terminar de falar</label>
          <p>Exclusões sempre pedem confirmação. A IA respeita suas permissões no aplicativo.</p>
        </div>
      </details>
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50/60" aria-live="polite">
        {configured === false && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 mb-3">O assistente aguarda configuração. O administrador pode conectar o Claude em <a href="/configuracoes?tab=integracoes" className="font-semibold underline">Configurações &gt; Integrações</a>.</p>}
        {showHistory ? <>
          <p className="text-sm font-semibold text-gray-800 mb-2">Suas últimas 30 ações</p>
          {historyLoading ? <Loader2 className="animate-spin mx-auto my-5 text-accent" /> : history.length ? history.map((action) => <ActionCard key={action.id} action={action} busy={busy} onConfirm={confirmAction} />) : <p className="text-sm text-gray-500">Nenhuma ação encontrada.</p>}
        </> : <>
          {!messages.length && <div className="space-y-3 text-sm text-gray-600">
            <p>Peça o que você precisa fazer no aplicativo. Anexe PDFs e imagens para dar contexto.</p>
            {["Crie uma tarefa de editar um reels para amanhã e atribua a mim.", "Liste as tarefas atrasadas.", "Quero registrar uma despesa de R$ 150 paga por Pix."].map((example) => <button key={example} onClick={() => setDraft(example)} className="block w-full text-left rounded-xl border border-gray-200 bg-white p-3 hover:border-accent">{example}</button>)}
          </div>}
          {messages.map((message) => <div key={message.id} className={`mb-4 ${message.role === "user" ? "pl-8" : "pr-2"}`}>
            <div className={`rounded-2xl p-3 text-sm whitespace-pre-wrap break-words ${message.role === "user" ? "bg-accent text-white rounded-br-sm" : "bg-white border border-gray-200 text-gray-700 rounded-bl-sm"}`}>{message.content}</div>
            {!!message.attachments?.length && <div className="mt-2 space-y-2 rounded-xl border border-gray-200 bg-white p-2 text-gray-600">{message.attachments.map((attachment, index) => <AttachmentPreview key={index} attachment={attachment} />)}</div>}
            {message.actions?.map((action) => <ActionCard key={action.id} action={action} busy={busy} onConfirm={confirmAction} />)}
          </div>)}
          {busy && <div className="flex items-center gap-2 text-xs text-gray-500"><Loader2 size={16} className="animate-spin" /> Processando seu comando...</div>}
          <div ref={endRef} />
        </>}
      </div>
      {error && <p role="alert" className="text-xs text-red-700 bg-red-50 px-4 py-3 border-t border-red-100">{error}</p>}
      <form className="border-t border-gray-200 p-3" onSubmit={(event) => { event.preventDefault(); void send(draft); }}>
        <input ref={fileInputRef} type="file" multiple accept={ATTACHMENT_ACCEPT} className="hidden" aria-label="Anexar PDFs e imagens" onChange={(event) => { const files = Array.from(event.target.files || []); event.target.value = ""; void addAttachments(files); }} />
        {attachments.length > 0 && <div className="mb-2 max-h-28 overflow-y-auto space-y-2 rounded-xl border border-gray-200 p-2">
          {attachments.map((attachment, index) => <div key={index} className="flex items-center justify-between gap-2 text-gray-600"><AttachmentPreview attachment={attachment} /><button type="button" aria-label={`Remover ${attachment.name}`} disabled={busy || readingFiles || listening} onClick={() => setAttachments((current) => current.filter((_, i) => i !== index))} className="shrink-0 rounded p-1 hover:bg-gray-100"><X size={14} /></button></div>)}
        </div>}
        {readingFiles && <p className="mb-2 flex items-center gap-2 text-xs text-gray-500"><Loader2 size={14} className="animate-spin" /> Preparando anexos...</p>}
        <label htmlFor="assistant-command" className="sr-only">Seu comando</label>
        <textarea id="assistant-command" rows={2} maxLength={8000} value={draft} disabled={busy || configured === false} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !listening) { event.preventDefault(); void send(draft); } }}
          placeholder={listening ? "Ouvindo... fale seu comando" : "Digite ou fale seu comando..."} className="w-full resize-none rounded-xl bg-gray-100 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent disabled:opacity-50" />
        <div className="flex justify-between items-center gap-2 mt-2">
          <div className="flex items-center gap-1">
          <button type="button" aria-label="Anexar PDFs e imagens" title="PDFs e imagens · até 3 MB por conversa" disabled={busy || readingFiles || listening || configured === false} onClick={() => fileInputRef.current?.click()} className="rounded-lg px-2 py-2 bg-gray-100 text-gray-700 disabled:opacity-40"><Paperclip size={17} /></button>
          <button type="button" aria-label={listening ? "Terminar comando de voz" : "Falar um comando"} disabled={!voiceSupported || busy || readingFiles || configured === false} onClick={startVoice}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-40 ${listening ? "bg-red-50 text-red-700 animate-pulse" : "bg-gray-100 text-gray-700"}`}>{listening ? <MicOff size={17} /> : <Mic size={17} />}{listening ? "Terminar fala" : "Falar"}</button>
          </div>
          <button type="submit" disabled={busy || readingFiles || (!draft.trim() && !attachments.length) || configured === false || listening} className="flex items-center gap-2 bg-accent text-white rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-40"><Send size={15} /> Enviar</button>
        </div>
        <p className="text-[10px] text-gray-400 mt-2">PDF, JPG, PNG, GIF e WebP · até 3 MB por conversa. Texto, anexos e dados consultados são enviados ao Claude.{voiceSupported ? " Voz transcrita pelo navegador." : " Voz indisponível neste navegador."}</p>
      </form>
    </section>}
  </>;
}
