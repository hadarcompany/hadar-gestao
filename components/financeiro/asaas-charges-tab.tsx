"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle, CheckCircle2, Clock3, ExternalLink, Loader2, Plus,
  ReceiptText, RefreshCw, Search, TriangleAlert, WalletCards,
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
  client: { id: string; name: string; cpfCnpj?: string | null; logoUrl?: string | null };
};

type ClientOption = { id: string; name: string; cpfCnpj?: string | null };

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
      setClients(data.filter((client: { status: string }) => client.status === "ACTIVE"));
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
      const unmatched = data.unmatched ? ` ${data.unmatched} cobrança(s) não foram vinculadas; confira CPF/CNPJ ou e-mail dos clientes.` : "";
      setSyncMessage(`${data.imported} cobrança(s) importada(s) e ${data.updated} atualizada(s).${unmatched}`);
      await fetchCharges(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível sincronizar o Asaas.");
    } finally {
      setSyncingAll(false);
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
          <span>{syncMessage}</span><button onClick={() => setSyncMessage("")} className="font-bold">Fechar</button>
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
          <table className="w-full min-w-[940px]">
            <thead><tr className="border-b border-gray-200 bg-gray-50/70 text-left text-[11px] font-bold uppercase tracking-wider text-gray-400">
              <th className="px-5 py-3">Cliente</th><th className="px-5 py-3">Cobrança</th><th className="px-5 py-3">Vencimento</th><th className="px-5 py-3">Pagamento</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Ações</th>
            </tr></thead>
            <tbody>{charges.map((charge) => (
              <tr key={charge.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                <td className="px-5 py-4"><ClientIdentity client={charge.client} /></td>
                <td className="px-5 py-4"><p className="font-bold text-gray-800">{currency(charge.amount)}</p><p className="text-xs text-gray-400 mt-0.5">{charge.description || BILLING_LABELS[charge.billingType || ""] || "Cobrança"}</p></td>
                <td className="px-5 py-4 text-sm text-gray-600">{formatDateBR(charge.dueDate)}</td>
                <td className="px-5 py-4 text-sm text-gray-600">{charge.paidDate ? formatDateBR(charge.paidDate) : BILLING_LABELS[charge.billingType || ""] || "—"}</td>
                <td className="px-5 py-4"><StatusBadge status={charge.status} />{charge.asaasSyncError && <p className="mt-1 max-w-48 truncate text-xs text-red-600" title={charge.asaasSyncError}>Falha ao sincronizar</p>}</td>
                <td className="px-5 py-4"><div className="flex justify-end gap-2">
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
          <SelectField label="Cliente" value={form.clientId} onChange={chooseClient} options={clients.map((client) => ({ value: client.id, label: client.name }))} placeholder="Selecione um cliente" />
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
    </div>
  );
}
