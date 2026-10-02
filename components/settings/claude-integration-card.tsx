"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, CheckCircle2, ClipboardPaste, Eye, EyeOff, Loader2, RefreshCw, Unplug } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DEFAULT_ASSISTANT_MODEL, type AssistantIntegrationStatus } from "@/lib/assistant/integration";

export function ClaudeIntegrationCard() {
  const [status, setStatus] = useState<AssistantIntegrationStatus | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [pasting, setPasting] = useState(false);
  const keyInput = useRef<HTMLInputElement>(null);
  const [model, setModel] = useState(DEFAULT_ASSISTANT_MODEL);
  const [workspaceId, setWorkspaceId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"save" | "test" | "remove" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [disconnect, setDisconnect] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/integrations/claude", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível consultar a integração Claude.");
      setStatus(body); setModel(body.model); setWorkspaceId(body.workspaceId || "");
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível consultar a integração Claude."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function pasteKey() {
    setError(""); setNotice(""); setPasting(true);
    try {
      if (!navigator.clipboard?.readText) throw new Error("Clipboard unavailable");
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) { setError("A área de transferência está vazia. Copie a chave e tente novamente."); return; }
      if (text.length > 510) { setError("O conteúdo copiado é muito longo. Copie apenas a chave API."); return; }
      setApiKey(text); setShowKey(false);
    } catch { setError("O navegador não permitiu a leitura. Clique no campo e use Ctrl+V (ou Colar no celular)."); }
    finally { setPasting(false); requestAnimationFrame(() => keyInput.current?.focus()); }
  }

  async function submit(action: "save" | "test" | "remove") {
    if (busy || pasting) return;
    setBusy(action); setError(""); setNotice(""); setDisconnect(false);
    try {
      const response = await fetch("/api/integrations/claude", {
        method: action === "save" ? "PUT" : action === "test" ? "POST" : "DELETE",
        ...(action !== "remove" ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}), model, workspaceId: workspaceId.trim() }) } : {}),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível atualizar a integração.");
      if (action === "test") setNotice("Conexão testada com sucesso. Clique em Salvar para aplicar a configuração no aplicativo.");
      else {
        setStatus(body); setModel(body.model); setWorkspaceId(body.workspaceId || ""); setApiKey(""); setShowKey(false);
        setNotice(action === "save" ? "Configuração salva. O Assistente já pode usar esta chave." : "Integração removida. O Assistente está desativado até uma nova configuração.");
        window.dispatchEvent(new CustomEvent("hadar:assistant-configured"));
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível atualizar a integração."); }
    finally { setBusy(null); }
  }

  return <div className="bg-white border border-gray-200 rounded-2xl p-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex gap-3"><div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center"><Bot size={20} /></div><div><h2 className="font-semibold text-gray-900">Claude · Assistente de IA</h2><p className="text-xs text-gray-400 mt-1">Comandos por texto ou voz, com PDFs e imagens como contexto.</p></div></div>
      {status?.configured && <span className="flex items-center gap-1.5 text-xs text-emerald-700"><CheckCircle2 size={14} /> Configurado</span>}
    </div>
    {loading ? <div className="py-6 flex justify-center"><Loader2 className="animate-spin text-accent" size={20} /></div> : <form method="post" autoComplete="off" data-1p-ignore="true" className="mt-5 space-y-4 border-t border-gray-100 pt-4" onSubmit={(event) => { event.preventDefault(); void submit("save"); }}>
      {!status && <button type="button" onClick={() => void load()} className="flex items-center gap-2 text-xs text-accent"><RefreshCw size={13} /> Tentar novamente</button>}
      {status && <>
        <div>
          <label htmlFor="claude-api-key" className="block text-xs font-semibold text-gray-700 mb-1.5">{status.configured ? "Substituir chave API" : "Chave API da Anthropic"}</label>
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[180px] flex-1">
              <input ref={keyInput} id="claude-api-key" name="claude-api-key" type={showKey ? "text" : "password"}
                autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                data-1p-ignore="true" data-lpignore="true" data-bwignore="true" data-form-type="other"
                maxLength={510} value={apiKey} disabled={!!busy || pasting}
                onChange={(event) => setApiKey(event.target.value)} onInput={(event) => setApiKey(event.currentTarget.value)}
                onPaste={(event) => {
                  const text = event.clipboardData.getData("text/plain");
                  if (!text) return;
                  event.preventDefault(); event.stopPropagation();
                  if (text.trim().length > 510) { setError("O conteúdo copiado é muito longo. Copie apenas a chave API."); return; }
                  setApiKey(text.trim()); setError(""); setNotice("");
                }}
                placeholder={status.configured ? "Chave já configurada. Deixe vazio para manter." : "Cole sua chave sk-ant-..."}
                className="w-full border border-gray-200 bg-white text-gray-900 rounded-xl pl-3 pr-11 py-2 text-sm outline-none focus:ring-1 focus:ring-accent disabled:opacity-50" />
              <button type="button" aria-label={showKey ? "Ocultar chave" : "Mostrar chave"} aria-pressed={showKey} disabled={!!busy || pasting} onClick={() => setShowKey((current) => !current)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-gray-500 hover:text-gray-900 disabled:opacity-40">{showKey ? <EyeOff size={17} /> : <Eye size={17} />}</button>
            </div>
            <button type="button" disabled={!!busy || pasting} onClick={() => void pasteKey()} className="flex items-center gap-2 px-3 py-2 text-xs font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40">{pasting ? <Loader2 size={14} className="animate-spin" /> : <ClipboardPaste size={14} />} Colar chave</button>
          </div>
          {!!apiKey.trim() && <p role="status" className="mt-1.5 text-xs text-emerald-700">Chave preenchida. Você pode testar a conexão e salvar.</p>}
          <p className="mt-1.5 text-xs text-gray-400">A chave fica protegida no servidor e não será exibida novamente depois de salva.</p>
        </div>
        <div>
          <label htmlFor="claude-workspace" className="block text-xs font-semibold text-gray-700 mb-1.5">Workspace da Anthropic (se exigido pela chave)</label>
          <input id="claude-workspace" autoComplete="off" spellCheck={false} maxLength={107} value={workspaceId} disabled={!!busy || pasting} onChange={(event) => setWorkspaceId(event.target.value)} placeholder="wrkspc_..." className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent" />
          <p className="mt-1.5 text-xs text-gray-400">Chaves pessoais com acesso a vários workspaces precisam deste ID. Copie-o em Claude Console → Settings → Workspaces. Se a chave já foi criada para um workspace específico, deixe vazio.</p>
        </div>
        <details className="text-xs text-gray-500"><summary className="cursor-pointer">Modelo do Claude</summary><label htmlFor="claude-model" className="sr-only">Modelo do Claude</label><input id="claude-model" maxLength={107} value={model} disabled={!!busy} onChange={(event) => setModel(event.target.value)} className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent" /><p className="mt-1">Use um modelo disponível na sua conta Anthropic.</p></details>
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={!!busy || pasting || (!apiKey.trim() && !status.configured) || !model.trim()} className="px-4 py-2 text-xs font-semibold bg-accent text-white rounded-lg flex items-center gap-2 disabled:opacity-40">{busy === "save" && <Loader2 size={13} className="animate-spin" />} Salvar</button>
          <button type="button" disabled={!!busy || pasting || (!apiKey.trim() && !status.configured) || !model.trim()} onClick={() => void submit("test")} className="px-3 py-2 text-xs font-semibold border border-gray-200 rounded-lg flex items-center gap-2 hover:bg-gray-50 disabled:opacity-40">{busy === "test" && <Loader2 size={13} className="animate-spin" />} Testar conexão</button>
          {status.configured && <button type="button" disabled={!!busy || pasting} onClick={() => setDisconnect(true)} className="px-3 py-2 text-xs font-semibold text-red-600 border border-red-200 rounded-lg flex items-center gap-2 hover:bg-red-50 disabled:opacity-40"><Unplug size={13} /> Remover integração</button>}
        </div>
      </>}
    </form>}
    {notice && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">{notice}</p>}
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>}
    <ConfirmDialog open={disconnect} title="Remover integração Claude" message="A chave salva será removida e o Assistente deixará de responder até você configurar uma chave novamente." confirmLabel="Remover integração" cancelLabel="Cancelar" onConfirm={() => void submit("remove")} onCancel={() => setDisconnect(false)} />
  </div>;
}
