"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownUp, ExternalLink, Loader2, Megaphone, RefreshCw, TrendingUp, Users } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { ClientIdentity } from "@/components/clients/client-identity";

interface Account {
  id: string; externalId: string; accountId: string | null; name: string; currency: string | null;
  accountStatus: number | null; businessName: string | null; clientId: string | null;
  client: { id: string; name: string; logoUrl?: string | null } | null;
}
interface Campaign {
  id: string; name: string; status: string; effectiveStatus: string; objective: string | null;
  dailyBudget: number | null; lifetimeBudget: number | null; impressions: number; reach: number;
  clicks: number; spend: number; cpc: number; cpm: number; ctr: number; frequency: number;
  leads: number; costPerLead: number | null; purchases: number; purchaseValue: number; roas: number | null;
}
interface CampaignResponse {
  account: Account; since: string; until: string; rows: Campaign[];
  totals: { spend: number; impressions: number; reach: number; clicks: number; leads: number; purchases: number; purchaseValue: number; ctr: number; cpc: number; cpl: number | null; roas: number | null };
}

type SortKey = "name" | "effectiveStatus" | "spend" | "impressions" | "clicks" | "leads" | "costPerLead" | "roas";
const iso = (date: Date) => date.toISOString().slice(0, 10);
const money = (value: number, currency = "BRL") => new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value || 0);
const compact = (value: number) => new Intl.NumberFormat("pt-BR", { notation: value > 9999 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value || 0);
const statusLabel: Record<string, string> = { ACTIVE: "Ativa", PAUSED: "Pausada", ARCHIVED: "Arquivada", DELETED: "Excluída", CAMPAIGN_PAUSED: "Pausada", ADSET_PAUSED: "Conjunto pausado", IN_PROCESS: "Processando", WITH_ISSUES: "Com problemas" };

export default function MetaAdsPage() {
  const { user } = useAuth();
  const admin = user?.role === "ADMIN";
  const today = useMemo(() => new Date(), []);
  const initialSince = useMemo(() => { const date = new Date(today); date.setDate(date.getDate() - 29); return iso(date); }, [today]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [accountId, setAccountId] = useState("");
  const [since, setSince] = useState(initialSince);
  const [until, setUntil] = useState(iso(today));
  const [data, setData] = useState<CampaignResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "spend", direction: "desc" });

  const loadAccounts = useCallback(async () => {
    const response = await fetch("/api/meta/accounts", { cache: "no-store" });
    const body = await response.json().catch(() => []);
    if (!response.ok) { setError(body.error || "Não foi possível carregar as contas."); setLoading(false); return; }
    setAccounts(body);
    setAccountId((current) => current || body[0]?.id || "");
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAccounts();
    if (admin) fetch("/api/clients").then((response) => response.ok ? response.json() : []).then((items) => setClients(items.map((item: { id: string; name: string }) => ({ id: item.id, name: item.name }))));
  }, [admin, loadAccounts]);

  const loadCampaigns = useCallback(async () => {
    if (!accountId) { setData(null); return; }
    setLoading(true); setError(null);
    const query = new URLSearchParams({ accountId, since, until });
    const response = await fetch(`/api/meta/campaigns?${query}`, { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (response.ok) setData(body); else { setData(null); setError(body.error || "Não foi possível consultar as campanhas."); }
    setLoading(false);
  }, [accountId, since, until]);

  useEffect(() => { if (accountId) void loadCampaigns(); }, [accountId, loadCampaigns]);

  async function syncAccounts() {
    setSyncing(true); setError(null);
    const response = await fetch("/api/meta/accounts", { method: "POST" });
    const body = await response.json().catch(() => ({}));
    if (response.ok) await loadAccounts(); else setError(body.error || "Falha ao sincronizar contas.");
    setSyncing(false);
  }

  async function linkClient(clientId: string) {
    if (!accountId) return;
    const response = await fetch(`/api/meta/accounts/${accountId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId: clientId || null }) });
    if (response.ok) { await loadAccounts(); await loadCampaigns(); }
  }

  function toggleSort(key: SortKey) {
    setSort((current) => ({ key, direction: current.key === key && current.direction === "desc" ? "asc" : "desc" }));
  }
  const rows = useMemo(() => [...(data?.rows ?? [])].sort((a, b) => {
    const left = a[sort.key] ?? -1; const right = b[sort.key] ?? -1;
    const result = typeof left === "string" ? left.localeCompare(String(right), "pt-BR") : Number(left) - Number(right);
    return sort.direction === "asc" ? result : -result;
  }), [data, sort]);
  const currency = data?.account.currency || "BRL";

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div><h1 className="text-xl font-bold text-gray-900">Meta Ads</h1><p className="text-xs text-gray-400 mt-1">Campanhas do Facebook e Instagram vinculadas aos clientes.</p></div>
        <div className="flex flex-wrap gap-2">
          {admin && <button onClick={syncAccounts} disabled={syncing} className="flex items-center gap-2 px-3 py-2 text-xs font-semibold border border-gray-200 bg-white rounded-lg hover:bg-gray-50 disabled:opacity-50">{syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Sincronizar contas</button>}
          <Link href="/configuracoes?tab=integracoes" className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-white bg-accent rounded-lg hover:bg-accent-dark">Configurar Meta <ExternalLink size={13} /></Link>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <label className="md:col-span-2 text-[11px] font-semibold text-gray-500">Conta de anúncios
          <select value={accountId} onChange={(event) => setAccountId(event.target.value)} className="mt-1 w-full px-3 py-2 text-sm font-normal border border-gray-200 rounded-lg bg-white outline-none focus:border-accent">
            {accounts.length === 0 && <option value="">Nenhuma conta conectada</option>}
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}{account.client ? ` — ${account.client.name}` : ""}</option>)}
          </select>
        </label>
        <label className="text-[11px] font-semibold text-gray-500">De<input type="date" value={since} max={until} onChange={(event) => setSince(event.target.value)} className="mt-1 w-full px-3 py-2 text-sm font-normal border border-gray-200 rounded-lg outline-none focus:border-accent" /></label>
        <label className="text-[11px] font-semibold text-gray-500">Até<input type="date" value={until} min={since} max={iso(today)} onChange={(event) => setUntil(event.target.value)} className="mt-1 w-full px-3 py-2 text-sm font-normal border border-gray-200 rounded-lg outline-none focus:border-accent" /></label>
        {admin && accountId && <label className="md:col-span-2 text-[11px] font-semibold text-gray-500">Vincular esta conta ao cliente
          <select value={accounts.find((item) => item.id === accountId)?.clientId || ""} onChange={(event) => void linkClient(event.target.value)} className="mt-1 w-full px-3 py-2 text-sm font-normal border border-gray-200 rounded-lg bg-white outline-none focus:border-accent"><option value="">Sem cliente vinculado</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select>
        </label>}
        {data?.account.client && <div className="md:col-span-2 flex items-end pb-2"><span className="text-xs text-gray-500">Cliente: <ClientIdentity client={data.account.client} /></span></div>}
      </div>

      {error && <div className="p-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">{error}</div>}
      {!loading && accounts.length === 0 && <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center"><Megaphone className="mx-auto text-gray-300 mb-3" size={34} /><h2 className="font-semibold text-gray-800">Conecte sua conta Meta</h2><p className="text-sm text-gray-400 mt-1">Cadastre as credenciais em Configurações e autorize as contas de anúncios.</p></div>}

      {loading && <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-accent" /></div>}
      {!loading && data && <>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {[
            ["Investimento", money(data.totals.spend, currency), Megaphone], ["Impressões", compact(data.totals.impressions), TrendingUp],
            ["Alcance", compact(data.totals.reach), Users], ["Cliques", compact(data.totals.clicks), TrendingUp],
            ["Leads", compact(data.totals.leads), Users], ["CPL", data.totals.cpl === null ? "—" : money(data.totals.cpl, currency), TrendingUp],
          ].map(([label, value, Icon]) => <div key={String(label)} className="bg-white border border-gray-200 rounded-xl p-4"><div className="flex items-center gap-2 text-gray-400"><Icon size={14} /><span className="text-[10px] font-semibold uppercase">{String(label)}</span></div><p className="text-lg font-bold text-gray-900 mt-2">{String(value)}</p></div>)}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full min-w-[1050px] text-sm">
            <thead className="bg-gray-50 border-b border-gray-200"><tr>
              {([ ["name", "Campanha"], ["effectiveStatus", "Status"], ["spend", "Investimento"], ["impressions", "Impressões"], ["clicks", "Cliques"], ["leads", "Leads"], ["costPerLead", "CPL"], ["roas", "ROAS"] ] as [SortKey, string][]).map(([key, label]) => <th key={key} className="px-4 py-3 text-left text-[10px] uppercase text-gray-400 font-semibold"><button onClick={() => toggleSort(key)} className="inline-flex items-center gap-1 hover:text-gray-700">{label}<ArrowDownUp size={11} /></button></th>)}
            </tr></thead>
            <tbody>{rows.length === 0 ? <tr><td colSpan={8} className="py-16 text-center text-gray-400">Nenhuma campanha encontrada neste período.</td></tr> : rows.map((campaign) => <tr key={campaign.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
              <td className="px-4 py-3"><p className="font-medium text-gray-800 max-w-sm truncate">{campaign.name}</p><p className="text-[10px] text-gray-400 mt-0.5">{campaign.objective || "Sem objetivo"}</p></td>
              <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-[10px] font-semibold ${campaign.effectiveStatus === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : campaign.effectiveStatus.includes("ISSUE") ? "bg-red-50 text-red-700" : "bg-gray-100 text-gray-600"}`}>{statusLabel[campaign.effectiveStatus] || campaign.effectiveStatus}</span></td>
              <td className="px-4 py-3 font-semibold text-gray-800">{money(campaign.spend, currency)}</td><td className="px-4 py-3 text-gray-600">{compact(campaign.impressions)}</td><td className="px-4 py-3 text-gray-600">{compact(campaign.clicks)}</td><td className="px-4 py-3 text-gray-600">{compact(campaign.leads)}</td><td className="px-4 py-3 text-gray-600">{campaign.costPerLead === null ? "—" : money(campaign.costPerLead, currency)}</td><td className="px-4 py-3 text-gray-600">{campaign.roas === null ? "—" : `${campaign.roas.toFixed(2)}x`}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </>}
    </div>
  );
}
