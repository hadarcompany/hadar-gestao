"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle, CalendarClock, CheckCircle2, Clock3, ExternalLink, Loader2, Plus,
  Link2, ReceiptText, RefreshCw, Search, TriangleAlert, WalletCards,
} from "lucide-react";
import { ClientIdentity } from "@/components/clients/client-identity";
import { FilterDialog } from "@/components/ui/filter-dialog";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { SelectField } from "@/components/ui/select-field";
import { formatDateBR } from "@/lib/dates";

type ChargeStatus = "PENDING" | "PAID" | "OVERDUE";
type BillingType = "UNDEFINED" | "BOLETO" | "PIX" | "CREDIT_CARD";

type Charge = {
  id: string;
  amount: number;
  dueDate: string;
  paidDate: string | null;
  status: ChargeStatus;
  description: string | null;
  billingType: BillingType | null;
  asaasStatus: string | null;
  asaasPaymentId: string | null;
  asaasInvoiceUrl: string | null;
  asaasBankSlipUrl: string | null;
  asaasSyncError: string | null;
  revenueCompetenceMonth: number | null;
  revenueCompetenceYear: number | null;
  competenceNote: string | null;
  competenceAdjustedAt: string | null;
  client: { id: string; name: string; cpfCnpj?: string | null; logoUrl?: string | null };
};

type ClientOption = { id: string; name: string; cpfCnpj?: string | null; status: string };
type UnmatchedCustomer = {
  asaasCustomerId: string;
  name: string;
  email: string | null;
  cpfCnpj: string | null;
  chargeCount: number;
};

const BILLING_OPTIONS = [
  { value: "UNDEFINED", label: "Cliente escolhe na fatura" },
  { value: "PIX", label: "Pix" },
  { value: "BOLETO", label: "Boleto" },
  { value: "CREDIT_CARD", label: "Cartão de crédito" },
];

const BILLING_LABELS: Record<string, string> = {
  UNDEFINED: "A definir", PIX: "Pix", BOLETO: "Boleto", CREDIT_CARD: "Cartão",
};

function currency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function StatusBadge({ status }: { status: ChargeStatus }) {
  const styles = {
    PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
    OVERDUE: "bg-red-50 text-red-700 border-red-200",
    PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  };
  const labels = { PAID: "Pago", OVERDUE: "Vencido", PENDING: "Pendente" };
  return <span className={`inline-flex px-2.5 py-1 rounded-full border text-[11px] font-bold uppercase tracking-wide ${styles[status]}`}>{labels[status]}</span>;
}

function SummaryCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white/80 border border-gray-200/60 rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
          <p className={`text-2xl font-bold mt-2 ${color}`}>{currency(value)}</p>
        </div>
        <div className={`w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center ${color}`}>{icon}</div>
      </div>
    </div>
  );
}

export function AsaasChargesTab({ month, year, setMonth, setYear }: {
  month: number;
  year: number;
  setMonth: (month: number) => void;
  setYear: (year: number) => void;
}) {
  const [charges, setCharges] = useState<Charge[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [summary, setSummary] = useState({ total: 0, paid: 0, pending: 0, overdue: 0 });
  const [configured, setConfigured] = useState(true);
  const [environment, setEnvironment] = useState<"sandbox" | "production">("sandbox");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [unmatchedCustomers, setUnmatchedCustomers] = useState<UnmatchedCustomer[]>([]);
  const [linkSelections, setLinkSelections] = useState<Record<string, string>>({});
  const [linking, setLinking] = useState(false);
  const [competenceCharge, setCompetenceCharge] = useState<Charge | null>(null);
  const [competenceMonth, setCompetenceMonth] = useState("");
  const [competenceReason, setCompetenceReason] = useState("");
  const [savingCompetence, setSavingCompetence] = useState(false);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [syncMessage, setSyncMessage] = useState("");
  const [form, setForm] = useState({
    clientId: "", cpfCnpj: "", amount: "", dueDate: "", billingType: "UNDEFINED" as BillingType, description: "",
  });

  const fetchCharges = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const params = new URLSearchParams({ month: String(month), year: String(year) });
      if (status) params.set("status", status);
      if (search.trim()) params.set("search", search.trim());
      const response = await fetch(`/api/asaas/charges?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar as cobranças.");
      setCharges(data.charges);
      setSummary(data.summary);
      setConfigured(data.integration.configured);
      setEnvironment(data.integration.environment);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar as cobranças.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [month, year, status, search]);

  useEffect(() => {
    fetchCharges();
    const timer = window.setInterval(() => fetchCharges(true), 30_000);
    return () => window.clearInterval(timer);
  }, [fetchCharges]);

  useEffect(() => {
    fetch("/api/clients").then(async (response) => {
      if (!response.ok) return;
      const data = await response.json();
      setClients(data);
    });
  }, []);

  const selectedClient = useMemo(() => clients.find((client) => client.id === form.clientId), [clients, form.clientId]);

  function chooseClient(clientId: string) {
    const client = clients.find((item) => item.id === clientId);
    setForm((current) => ({ ...current, clientId, cpfCnpj: client?.cpfCnpj || "" }));
  }

  async function createCharge() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/asaas/charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível criar a cobrança.");
      setShowModal(false);
      setForm({ clientId: "", cpfCnpj: "", amount: "", dueDate: "", billingType: "UNDEFINED", description: "" });
      await fetchCharges();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar a cobrança.");
      setShowModal(false);
      await fetchCharges(true);
    } finally {
      setSaving(false);
    }
  }

  async function retrySync(id: string) {
    setSyncingId(id);
    setError("");
    try {
      const response = await fetch(`/api/asaas/charges/${id}/sync`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível sincronizar a cobrança.");
      await fetchCharges(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível sincronizar a cobrança.");
    } finally {
      setSyncingId(null);
    }
  }

  async function syncFromAsaas() {
    setSyncingAll(true);
    setError("");
    setSyncMessage("");
    try {
      const response = await fetch("/api/asaas/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível sincronizar o Asaas.");
      const pendingLinks = (data.unmatchedCustomers || []) as UnmatchedCustomer[];
      setUnmatchedCustomers(pendingLinks);
      const unmatched = data.unmatched ? ` ${data.unmatched} cobrança(s) aguardam vínculo com ${pendingLinks.length} cliente(s) do Asaas.` : "";
      setSyncMessage(`${data.imported} cobrança(s) importada(s) e ${data.updated} atualizada(s).${unmatched}`);
      if (pendingLinks.length > 0) setShowLinkModal(true);
      await fetchCharges(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível sincronizar o Asaas.");
    } finally {
      setSyncingAll(false);
    }
  }

  async function linkCustomers() {
    const mappings = unmatchedCustomers
      .map((customer) => ({ asaasCustomerId: customer.asaasCustomerId, clientId: linkSelections[customer.asaasCustomerId] }))
      .filter((mapping) => Boolean(mapping.clientId));
    if (mappings.length === 0) return;
    setLinking(true);
    setError("");
    try {
      const response = await fetch("/api/asaas/customers/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível vincular os clientes.");
      setShowLinkModal(false);
      setLinkSelections({});
      setSyncMessage(`${data.linked} cliente(s) vinculado(s). Sincronizando as cobranças...`);
      await syncFromAsaas();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível vincular os clientes.");
    } finally {
      setLinking(false);
    }
  }

  function openCompetence(charge: Charge) {
    const paymentDate = charge.paidDate ? new Date(charge.paidDate) : new Date();
    const month = charge.revenueCompetenceMonth || paymentDate.getUTCMonth() + 1;
    const year = charge.revenueCompetenceYear || paymentDate.getUTCFullYear();
    setCompetenceCharge(charge);
    setCompetenceMonth(`${year}-${String(month).padStart(2, "0")}`);
    setCompetenceReason("");
  }

  async function saveCompetence() {
    if (!competenceCharge || !competenceMonth) return;
    const [targetYear, targetMonth] = competenceMonth.split("-").map(Number);
    setSavingCompetence(true);
    setError("");
    try {
      const response = await fetch(`/api/asaas/charges/${competenceCharge.id}/competence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: targetMonth, year: targetYear, reason: competenceReason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível ajustar a competência.");
      setCompetenceCharge(null);
      setCompetenceReason("");
      setSyncMessage("Competência ajustada. Dashboard, metas e pró-labore já considerarão o mês escolhido.");
      await fetchCharges(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível ajustar a competência.");
    } finally {
      setSavingCompetence(false);
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      {environment === "sandbox" && (
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div><strong>Ambiente de testes.</strong> Nenhuma cobrança desta tela movimenta dinheiro real enquanto o Asaas estiver em Sandbox.</div>
        </div>
      )}
      {!configured && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <TriangleAlert size={18} className="mt-0.5 shrink-0" />
          <div><strong>Integração não ativada.</strong> Configure ASAAS_API_KEY, ASAAS_ENVIRONMENT e ASAAS_WEBHOOK_TOKEN no servidor.</div>
        </div>
      )}
      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span><button onClick={() => setError("")} className="font-bold">Fechar</button>
        </div>
      )}
      {syncMessage && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <span>{syncMessage}</span>
          <div className="flex items-center gap-3">
            {unmatchedCustomers.length > 0 && <button onClick={() => setShowLinkModal(true)} className="inline-flex items-center gap-1.5 font-bold"><Link2 size={15} /> Vincular clientes</button>}
            <button onClick={() => setSyncMessage("")} className="font-bold">Fechar</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryCard label="Cobrado no mês" value={summary.total} icon={<ReceiptText size={20} />} color="text-gray-800" />
        <SummaryCard label="Recebido" value={summary.paid} icon={<CheckCircle2 size={20} />} color="text-emerald-600" />
        <SummaryCard label="A receber" value={summary.pending} icon={<Clock3 size={20} />} color="text-amber-600" />
        <SummaryCard label="Inadimplente" value={summary.overdue} icon={<TriangleAlert size={20} />} color="text-red-600" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <FilterDialog month={month} year={year} onApply={(nextMonth, nextYear) => { setMonth(nextMonth); setYear(nextYear); }} />
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cliente"
              className="h-10 w-52 rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-accent" />
          </div>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-600 outline-none focus:border-accent">
            <option value="">Todos os status</option><option value="PAID">Pagos</option><option value="PENDING">Pendentes</option><option value="OVERDUE">Vencidos</option>
          </select>
          <button onClick={() => fetchCharges()} className="h-10 w-10 inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 hover:text-accent" title="Atualizar agora">
            <RefreshCw size={16} />
          </button>
          <button onClick={syncFromAsaas} disabled={!configured || syncingAll} className="h-10 inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-gray-600 hover:border-accent hover:text-accent disabled:opacity-40">
            {syncingAll ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Sincronizar Asaas
          </button>
        </div>
        <button onClick={() => setShowModal(true)} disabled={!configured} className="h-10 inline-flex items-center gap-2 rounded-xl bg-accent px-5 text-sm font-bold text-white shadow-lg shadow-[#FF5A00]/20 disabled:cursor-not-allowed disabled:opacity-40">
          <Plus size={16} /> Gerar cobrança
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200/60 bg-white/80">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-accent" /></div>
        ) : charges.length === 0 ? (
          <div className="py-20 text-center"><WalletCards className="mx-auto mb-3 text-gray-300" size={34} /><p className="text-sm text-gray-400">Nenhuma cobrança neste período.</p></div>
        ) : (
          <table className="w-full min-w-[1080px]">
            <thead><tr className="border-b border-gray-200 bg-gray-50/70 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">
              <th className="px-5 py-3">Cliente</th><th className="px-5 py-3">Cobrança</th><th className="px-5 py-3">Vencimento</th><th className="px-5 py-3">Pagamento</th><th className="px-5 py-3">Competência</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Ações</th>
            </tr></thead>
            <tbody>{charges.map((charge) => (
              <tr key={charge.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                <td className="px-5 py-4"><ClientIdentity client={charge.client} /></td>
                <td className="px-5 py-4"><p className="font-bold text-gray-800">{currency(charge.amount)}</p><p className="text-xs text-gray-400 mt-0.5">{charge.description || BILLING_LABELS[charge.billingType || ""] || "Cobrança"}</p></td>
                <td className="px-5 py-4 text-sm text-gray-600">{formatDateBR(charge.dueDate)}</td>
                <td className="px-5 py-4 text-sm text-gray-600">{charge.paidDate ? formatDateBR(charge.paidDate) : BILLING_LABELS[charge.billingType || ""] || "—"}</td>
                <td className="px-5 py-4 text-sm text-gray-600">
                  {charge.paidDate ? (
                    <div title={charge.competenceNote || undefined}>
                      <span className={charge.revenueCompetenceMonth ? "font-bold text-blue-700" : ""}>{String(charge.revenueCompetenceMonth || new Date(charge.paidDate).getUTCMonth() + 1).padStart(2, "0")}/{charge.revenueCompetenceYear || new Date(charge.paidDate).getUTCFullYear()}</span>
                      {charge.revenueCompetenceMonth && <span className="block text-[10px] font-bold uppercase text-blue-500">Ajustada</span>}
                    </div>
                  ) : "—"}
                </td>
                <td className="px-5 py-4"><StatusBadge status={charge.status} />{charge.asaasSyncError && <p className="mt-1 max-w-48 truncate text-xs text-red-600" title={charge.asaasSyncError}>Falha ao sincronizar</p>}</td>
                <td className="px-5 py-4"><div className="flex justify-end gap-2">
                  {charge.status === "PAID" && <button onClick={() => openCompetence(charge)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 hover:border-blue-300 hover:text-blue-700"><CalendarClock size={13} /> Competência</button>}
                  {charge.asaasSyncError && <button onClick={() => retrySync(charge.id)} disabled={syncingId === charge.id} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50">{syncingId === charge.id ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Tentar novamente</button>}
                  {charge.asaasInvoiceUrl && <a href={charge.asaasInvoiceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 hover:border-accent hover:text-accent"><ExternalLink size={13} /> Abrir fatura</a>}
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>

      <Modal open={showModal} onClose={() => !saving && setShowModal(false)} title="Gerar cobrança no Asaas">
        <div className="space-y-4">
          <SelectField label="Cliente" value={form.clientId} onChange={chooseClient} options={clients.filter((client) => client.status === "ACTIVE").map((client) => ({ value: client.id, label: client.name }))} placeholder="Selecione um cliente" />
          <Input label="CPF ou CNPJ" value={form.cpfCnpj} onChange={(event) => setForm({ ...form, cpfCnpj: event.target.value })} placeholder="Obrigatório no primeiro vínculo" disabled={Boolean(selectedClient?.cpfCnpj)} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Valor (R$)" type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
            <Input label="Vencimento" type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
          </div>
          <SelectField label="Forma de pagamento" value={form.billingType} onChange={(value) => setForm({ ...form, billingType: value as BillingType })} options={BILLING_OPTIONS} />
          <Input label="Descrição" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Ex.: Mensalidade de setembro" />
          <p className="rounded-xl bg-gray-50 p-3 text-xs leading-relaxed text-gray-500">O cliente será vinculado ao Asaas uma única vez. A fatura gerada poderá ser aberta e enviada pela coluna de ações.</p>
          <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
            <button onClick={() => setShowModal(false)} disabled={saving} className="rounded-xl px-5 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100">Cancelar</button>
            <button onClick={createCharge} disabled={saving || !form.clientId || !form.cpfCnpj || !form.amount || !form.dueDate} className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-2 text-sm font-bold text-white disabled:opacity-40">
              {saving && <Loader2 size={15} className="animate-spin" />}{saving ? "Gerando..." : "Gerar cobrança"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showLinkModal} onClose={() => !linking && setShowLinkModal(false)} title="Vincular clientes do Asaas" size="xl">
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-gray-600">Selecione qual cliente já cadastrado no Hadar corresponde a cada cadastro do Asaas. O vínculo é salvo uma única vez e as cobranças passam a entrar automaticamente.</p>
          <div className="divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200">
            {unmatchedCustomers.map((customer) => (
              <div key={customer.asaasCustomerId} className="grid gap-3 p-4 md:grid-cols-[1fr_1.2fr] md:items-center">
                <div className="min-w-0">
                  <p className="font-bold text-gray-900">{customer.name}</p>
                  <p className="mt-1 truncate text-xs text-gray-500">{customer.email || customer.cpfCnpj || "Sem e-mail/CPF cadastrado"} · {customer.chargeCount} cobrança(s)</p>
                </div>
                <SelectField
                  value={linkSelections[customer.asaasCustomerId] || ""}
                  onChange={(clientId) => setLinkSelections((current) => ({ ...current, [customer.asaasCustomerId]: clientId }))}
                  options={clients.map((client) => ({ value: client.id, label: client.name }))}
                  placeholder="Selecione o cliente correspondente"
                />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-gray-200 pt-4">
            <p className="text-xs text-gray-400">Você pode vincular apenas os que reconhecer agora e voltar depois para os demais.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowLinkModal(false)} disabled={linking} className="rounded-xl px-5 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100">Cancelar</button>
              <button onClick={linkCustomers} disabled={linking || !Object.values(linkSelections).some(Boolean)} className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-2 text-sm font-bold text-white disabled:opacity-40">
                {linking ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />} Vincular selecionados
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(competenceCharge)} onClose={() => !savingCompetence && setCompetenceCharge(null)} title="Ajustar competência da receita" size="sm">
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
            A data real do pagamento continuará igual à registrada no Asaas. Apenas o mês usado no Dashboard, metas e pró-labore será alterado.
          </div>
          {competenceCharge && <div className="text-sm text-gray-600"><strong>{competenceCharge.client.name}</strong> · {currency(competenceCharge.amount)} · pago em {formatDateBR(competenceCharge.paidDate)}</div>}
          <Input label="Mês de competência" type="month" value={competenceMonth} onChange={(event) => setCompetenceMonth(event.target.value)} />
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-gray-500">Motivo do ajuste</label>
            <textarea value={competenceReason} onChange={(event) => setCompetenceReason(event.target.value)} placeholder="Ex.: Receita referente à prestação de contas de agosto"
              className="min-h-24 w-full rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-900 outline-none focus:border-accent-dark/50 focus:ring-1 focus:ring-accent-dark/20" />
          </div>
          <p className="text-xs text-gray-400">Cada alteração fica registrada com mês anterior, novo mês, motivo, usuário e data.</p>
          <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
            <button onClick={() => setCompetenceCharge(null)} disabled={savingCompetence} className="rounded-xl px-5 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100">Cancelar</button>
            <button onClick={saveCompetence} disabled={savingCompetence || !competenceMonth || competenceReason.trim().length < 5} className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-2 text-sm font-bold text-white disabled:opacity-40">
              {savingCompetence && <Loader2 size={15} className="animate-spin" />} Salvar competência
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
