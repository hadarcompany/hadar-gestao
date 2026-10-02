"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ExternalLink, Loader2, Megaphone, MessageCircle, RefreshCw, Unplug } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ClaudeIntegrationCard } from "@/components/settings/claude-integration-card";

interface MetaStatus {
  configured: boolean; connected: boolean; accountCount: number;
  connection?: { metaUserName: string | null; tokenExpiresAt: string | null; updatedAt: string } | null;
}
interface WhatsAppStatus { configured: boolean; status: string; provider?: "WAHA" | "META_CLOUD"; session: string; me?: { pushName?: string; id?: string } | null }

export function IntegrationsPanel() {
  const [meta, setMeta] = useState<MetaStatus | null>(null);
  const [whatsapp, setWhatsapp] = useState<WhatsAppStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [disconnect, setDisconnect] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [metaResponse, whatsappResponse] = await Promise.all([
        fetch("/api/meta/status", { cache: "no-store" }),
        fetch("/api/whatsapp/session", { cache: "no-store" }),
      ]);
      if (metaResponse.ok) setMeta(await metaResponse.json());
      if (whatsappResponse.ok) setWhatsapp(await whatsappResponse.json());
    } catch { setNotice("Não foi possível atualizar o status de todas as integrações."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void load();
    const query = new URLSearchParams(window.location.search);
    if (query.get("meta_connected")) setNotice("Conta Meta conectada e contas de anúncios sincronizadas.");
    if (query.get("meta_error")) setNotice("A conexão com a Meta não foi concluída. Verifique as credenciais e tente novamente.");
  }, [load]);

  async function sync() {
    setSyncing(true); setNotice(null);
    const response = await fetch("/api/meta/accounts", { method: "POST" });
    const body = await response.json().catch(() => ({}));
    setNotice(response.ok ? `${body.synced ?? 0} conta(s) de anúncios sincronizada(s).` : body.error || "Falha ao sincronizar.");
    await load(); setSyncing(false);
  }

  async function removeConnection() {
    setDisconnect(false);
    await fetch("/api/meta/status", { method: "DELETE" });
    setNotice("Conexão Meta removida. Os vínculos locais foram preservados.");
    await load();
  }

  return <div className="space-y-5">
    <ClaudeIntegrationCard />
    {notice && <div className="p-3 text-sm bg-blue-50 border border-blue-200 text-blue-700 rounded-xl">{notice}</div>}
    {loading ? <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-accent" /></div> : <>
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex gap-3"><div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><Megaphone size={20} /></div><div><h2 className="font-semibold text-gray-900">Meta Ads</h2><p className="text-xs text-gray-400 mt-1">Campanhas e resultados do Facebook e Instagram.</p></div></div>
        <div className="flex flex-wrap gap-2">
          {meta?.connected ? <>
            <button onClick={sync} disabled={syncing} className="px-3 py-2 text-xs font-semibold border border-gray-200 rounded-lg flex items-center gap-2 hover:bg-gray-50 disabled:opacity-50">{syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Sincronizar</button>
            <Link href="/meta-ads" className="px-3 py-2 text-xs font-semibold text-white bg-accent rounded-lg flex items-center gap-2">Ver campanhas <ExternalLink size={12} /></Link>
            <button onClick={() => setDisconnect(true)} className="px-3 py-2 text-xs font-semibold text-red-600 border border-red-200 rounded-lg flex items-center gap-2 hover:bg-red-50"><Unplug size={13} /> Desconectar</button>
          </> : <a href="/api/meta/connect" className={`px-4 py-2 text-xs font-semibold text-white rounded-lg ${meta?.configured ? "bg-[#1877F2] hover:bg-blue-700" : "bg-gray-300 pointer-events-none"}`}>Conectar com a Meta</a>}
        </div>
      </div>
      <div className="mt-5 pt-4 border-t border-gray-100 text-xs">
        {meta?.connected ? <div className="flex flex-wrap gap-x-8 gap-y-2 text-gray-500"><span className="flex items-center gap-1.5 text-emerald-700"><CheckCircle2 size={14} /> Conectado como {meta.connection?.metaUserName || "usuário Meta"}</span><span>{meta.accountCount} conta(s) encontrada(s)</span>{meta.connection?.tokenExpiresAt && <span>Expira em {new Date(meta.connection.tokenExpiresAt).toLocaleDateString("pt-BR")}</span>}</div> : meta?.configured ? <p className="text-gray-500">Credenciais configuradas. Autorize a leitura das contas de anúncios para começar.</p> : <div className="text-gray-500 space-y-1"><p className="font-medium text-amber-700">Aguardando configuração na Vercel.</p><p>Variáveis: META_APP_ID, META_APP_SECRET, META_TOKEN_ENCRYPTION_KEY e META_OAUTH_REDIRECT_URI.</p></div>}
      </div>
    </div>

    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <div className="flex gap-3"><div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><MessageCircle size={20} /></div><div><h2 className="font-semibold text-gray-900">WhatsApp</h2><p className="text-xs text-gray-400 mt-1">Atendimento conectado ao pipeline comercial.</p></div></div>
      <div className="mt-5 pt-4 border-t border-gray-100 text-xs text-gray-500 space-y-2">
        <p><span className="font-semibold text-gray-700">Provedor atual:</span> {whatsapp?.provider === "META_CLOUD" ? "Cloud API oficial da Meta" : "WAHA (WhatsApp Web)"}</p>
        <p><span className="font-semibold text-gray-700">Status:</span> {whatsapp?.configured ? whatsapp.status : "Não configurado"}</p>
        {whatsapp?.provider === "META_CLOUD" ? <p className="text-emerald-700 flex items-center gap-1.5"><CheckCircle2 size={14} /> A aplicação está usando a integração oficial.</p> : <p>A migração para a API oficial será ativada ao definir WHATSAPP_PROVIDER=META_CLOUD e as credenciais da Cloud API na Vercel.</p>}
      </div>
    </div>
    <ConfirmDialog open={disconnect} title="Desconectar conta Meta" message="A aplicação deixará de consultar as campanhas até uma nova autorização. Os vínculos com clientes serão preservados." confirmLabel="Desconectar" cancelLabel="Cancelar" onConfirm={() => void removeConnection()} onCancel={() => setDisconnect(false)} />
    </>}
  </div>;
}
