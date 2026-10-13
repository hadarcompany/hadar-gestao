"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CreditCard, Eye, EyeOff, Loader2, RefreshCw, Unplug } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { AsaasEnvironment, AsaasIntegrationStatus } from "@/lib/asaas-integration";

type Status = AsaasIntegrationStatus & { webhookUrl: string };
export function AsaasIntegrationCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [environment, setEnvironment] = useState<AsaasEnvironment>("sandbox");
  const [apiKey, setApiKey] = useState("");
  const [webhookToken, setWebhookToken] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"save" | "test" | "remove" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [disconnect, setDisconnect] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/integrations/asaas", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível consultar o Asaas.");
      setStatus(body); setEnvironment(body.environment);
    } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível consultar o Asaas."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function submit(action: "save" | "test" | "remove") {
    if (busy) return;
    setBusy(action); setError(""); setNotice(""); setDisconnect(false);
    try {
      const response = await fetch("/api/integrations/asaas", {
        method: action === "save" ? "PUT" : action === "test" ? "POST" : "DELETE",
        ...(action !== "remove" ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ environment, ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}), ...(webhookToken.trim() ? { webhookToken: webhookToken.trim() } : {}) }) } : {}),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível configurar o Asaas.");
      if (action === "test") setNotice("Conexão testada com sucesso. Salve para aplicar os dados preenchidos.");
      else {
        setStatus(body); setEnvironment(body.environment); setApiKey(""); setWebhookToken(""); setShowKey(false); setShowToken(false);
        setNotice(action === "save" ? "Configuração salva para esta empresa." : "Asaas desconectado. Os registros financeiros foram preservados.");
      }
    } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível configurar o Asaas."); }
    finally { setBusy(null); }
  }

  const inputClass = "w-full border border-gray-200 bg-white text-gray-900 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent disabled:opacity-50";
  return <div className="bg-white border border-gray-200 rounded-2xl p-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex gap-3"><div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><CreditCard size={20} /></div><div><h2 className="font-semibold text-gray-900">Asaas</h2><p className="text-xs text-gray-400 mt-1">Cobranças e acompanhamento de pagamentos da sua empresa.</p></div></div>
      {status?.configured && <span className="flex items-center gap-1.5 text-xs text-emerald-700"><CheckCircle2 size={14} /> Configurado · {status.environment === "production" ? "Produção" : "Testes"}</span>}
    </div>
    {loading ? <div className="py-6 flex justify-center"><Loader2 className="animate-spin text-accent" size={20} /></div> : <form autoComplete="off" className="mt-5 space-y-4 border-t border-gray-100 pt-4" onSubmit={event => { event.preventDefault(); void submit("save"); }}>
      {!status && <button type="button" onClick={() => void load()} className="flex items-center gap-2 text-xs text-accent"><RefreshCw size={13} /> Tentar novamente</button>}
      {status && <>
        <div><label htmlFor="asaas-environment" className="block text-xs font-semibold text-gray-700 mb-1.5">Ambiente</label><select id="asaas-environment" value={environment} onChange={event => setEnvironment(event.target.value as AsaasEnvironment)} disabled={!!busy} className={inputClass}><option value="sandbox">Testes (Sandbox)</option><option value="production">Produção</option></select><p className="mt-1.5 text-xs text-gray-400">Use a chave correspondente ao ambiente. Produção permite cobranças reais.</p></div>
        <div>
          <label htmlFor="asaas-api-key" className="block text-xs font-semibold text-gray-700 mb-1.5">{status.configured ? "Substituir chave API do Asaas" : "Chave API do Asaas"}</label>
          <div className="relative"><input id="asaas-api-key" name="asaas-api-key" type={showKey ? "text" : "password"} autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} data-1p-ignore="true" data-lpignore="true" maxLength={1040} value={apiKey} onChange={event => setApiKey(event.target.value)} disabled={!!busy} placeholder={status.configured ? "Deixe vazio para manter a chave atual." : "Cole a chave da sua conta Asaas."} className={`${inputClass} pr-11`} /><button type="button" aria-label={showKey ? "Ocultar chave" : "Mostrar chave"} disabled={!!busy} onClick={() => setShowKey(current => !current)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500">{showKey ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
          <p className="mt-1.5 text-xs text-gray-400">A chave fica criptografada e não será exibida novamente depois de salva. <a href="https://docs.asaas.com/docs/api-keys" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Como obter a chave</a></p>
        </div>
        <details className="rounded-xl border border-gray-200 p-3 text-xs text-gray-500">
          <summary className="cursor-pointer font-semibold text-gray-700">Notificações de pagamento (webhook){status.webhookConfigured ? " · Token configurado" : " · Opcional"}</summary>
          <div className="mt-3 space-y-3">
            <div><label htmlFor="asaas-webhook-url" className="block font-semibold text-gray-700 mb-1.5">Endereço para cadastrar no Asaas</label><input id="asaas-webhook-url" readOnly value={status.webhookUrl} onFocus={event => event.target.select()} className={inputClass} /></div>
            <div><label htmlFor="asaas-webhook-token" className="block font-semibold text-gray-700 mb-1.5">Token de autenticação do webhook</label><div className="relative"><input id="asaas-webhook-token" type={showToken ? "text" : "password"} autoComplete="off" spellCheck={false} maxLength={255} value={webhookToken} disabled={!!busy} onChange={event => setWebhookToken(event.target.value)} placeholder={status.webhookConfigured ? "Deixe vazio para manter o token atual." : "Cole o token cadastrado no webhook do Asaas."} className={`${inputClass} pr-11`} /><button type="button" aria-label={showToken ? "Ocultar token" : "Mostrar token"} disabled={!!busy} onClick={() => setShowToken(current => !current)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500">{showToken ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></div>
            <p>Use o mesmo token no Asaas e neste campo, com 32 a 255 caracteres. Ele é diferente da chave API. <a href="https://docs.asaas.com/docs/create-new-webhook-via-web-application" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Como configurar</a></p>
          </div>
        </details>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={!!busy || (!status.configured && !apiKey.trim())} className="px-4 py-2 text-xs font-semibold text-white bg-accent rounded-lg flex items-center gap-2 disabled:opacity-50">{busy === "save" && <Loader2 size={13} className="animate-spin" />} Salvar</button>
          <button type="button" onClick={() => void submit("test")} disabled={!!busy || (!status.configured && !apiKey.trim())} className="px-3 py-2 text-xs font-semibold border border-gray-200 rounded-lg flex items-center gap-2 disabled:opacity-50">{busy === "test" ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Testar conexão</button>
          {status.configured && <button type="button" onClick={() => setDisconnect(true)} disabled={!!busy} className="px-3 py-2 text-xs font-semibold text-red-600 border border-red-200 rounded-lg flex items-center gap-2 disabled:opacity-50"><Unplug size={13} /> Desconectar</button>}
        </div>
      </>}
    </form>}
    {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
    {notice && <p role="status" className="mt-4 text-sm text-emerald-700">{notice}</p>}
    <ConfirmDialog open={disconnect} title="Desconectar Asaas" message="Cobranças e notificações deixarão de usar esta integração. Os registros financeiros serão preservados." confirmLabel="Desconectar" onConfirm={() => void submit("remove")} onCancel={() => setDisconnect(false)} />
  </div>;
}
