"use client";

import { ClientIdentity } from "@/components/clients/client-identity";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import {
  Plus, Loader2, Repeat, Briefcase, Trash2, Calendar,
  CheckSquare, Square, DollarSign, Pencil, ReceiptText, CircleCheckBig, Clock3, TriangleAlert, ExternalLink,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface ServiceData {
  id: string;
  type: "RECURRING" | "FREELANCER";
  name: string | null;
  contractMonths: number | null;
  monthlyValue: number | null;
  startDate: string | null;
  nextRenewal: string | null;
  metaAds: boolean;
  googleAds: boolean;
  deliveriesPerWeek: number | null;
  deliveryTypes: string[];
  freelancerType: string | null;
  freelancerTypeCustom: string | null;
  totalValue: number | null;
  paymentMethod: string | null;
  installments: number | null;
  status: string;
  dataPrimeiraParcela: string | null;
  clientId: string;
  client: { id: string; name: string; logoUrl?: string | null };
  createdAt: string;
  asaas: {
    billed: number;
    paid: number;
    pending: number;
    overdue: number;
    chargeCount: number;
    invoiceUrl: string | null;
    status: "PAID" | "PENDING" | "OVERDUE" | "NOT_FOUND";
    contracted: number;
    difference: number;
  };
}

interface ClientOption {
  id: string;
  name: string;
}

const freelancerTypeLabels: Record<string, string> = {
  LANDING_PAGE: "Landing Page",
  GOOGLE_MEU_NEGOCIO: "Google Meu Negocio",
  VIDEO: "Video",
  FOTO: "Foto",
  OUTRO: "Outro",
};

const statusLabels: Record<string, string> = {
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluido",
  CANCELLED: "Cancelado",
  CHURN: "Churn",
};

const statusColors: Record<string, string> = {
  IN_PROGRESS: "bg-blue-500/20 text-blue-600",
  COMPLETED: "bg-emerald-500/20 text-emerald-600",
  CANCELLED: "bg-red-500/20 text-red-600",
  CHURN: "bg-orange-500/20 text-orange-600",
};

const STATUS_OPTIONS_RECURRING = [
  { value: "IN_PROGRESS", label: "Em andamento" },
  { value: "CANCELLED", label: "Cancelado" },
  { value: "CHURN", label: "Churn (Rescisao)" },
];

const STATUS_OPTIONS_FREELANCER = [
  { value: "IN_PROGRESS", label: "Em andamento" },
  { value: "COMPLETED", label: "Concluido" },
  { value: "CANCELLED", label: "Cancelado" },
];

const DELIVERY_TYPE_OPTIONS = ["Reels", "Carrossel", "Post", "Stories", "Video", "Foto"];

const asaasStatus = {
  PAID: { label: "Pago", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  PENDING: { label: "Aguardando", className: "bg-amber-50 text-amber-700 border-amber-200" },
  OVERDUE: { label: "Vencido", className: "bg-red-50 text-red-700 border-red-200" },
  NOT_FOUND: { label: "Sem cobrança", className: "bg-gray-50 text-gray-500 border-gray-200" },
};

function currency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function AsaasStatus({ service }: { service: ServiceData }) {
  const status = asaasStatus[service.asaas.status];
  const hasDifference = service.type === "RECURRING" && service.status === "IN_PROGRESS" && Math.abs(service.asaas.difference) >= 0.01;
  return (
    <div className="min-w-[145px]">
      <div className="flex items-center gap-2">
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${status.className}`}>{status.label}</span>
        {service.asaas.billed > 0 && <span className="text-xs font-semibold text-gray-700">{currency(service.asaas.billed)}</span>}
      </div>
      {hasDifference && (
        <p className="mt-1 text-[10px] font-medium text-orange-600">
          {service.asaas.billed === 0 ? "Serviço ativo sem cobrança neste mês" : `Diferença de ${currency(Math.abs(service.asaas.difference))}`}
        </p>
      )}
    </div>
  );
}

export default function ServicosPage() {
  const [services, setServices] = useState<ServiceData[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"RECURRING" | "FREELANCER">("RECURRING");
  const [showCreate, setShowCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [deleteServiceId, setDeleteServiceId] = useState<string | null>(null);
  const [period, setPeriod] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });
  const [financial, setFinancial] = useState({ contracted: 0, billed: 0, paid: 0, pending: 0, overdue: 0, discrepancies: 0 });

  // Edit state
  const [showEdit, setShowEdit] = useState(false);
  const [editService, setEditService] = useState<ServiceData | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  // Shared form fields
  const [fName, setFName] = useState("");
  const [fClient, setFClient] = useState("");
  const [fMonths, setFMonths] = useState("");
  const [fMonthlyValue, setFMonthlyValue] = useState("");
  const [fStartDate, setFStartDate] = useState("");
  const [fMetaAds, setFMetaAds] = useState(false);
  const [fGoogleAds, setFGoogleAds] = useState(false);
  const [fDeliveriesPerWeek, setFDeliveriesPerWeek] = useState("");
  const [fDeliveryTypes, setFDeliveryTypes] = useState<string[]>([]);
  const [fFreelancerType, setFFreelancerType] = useState("LANDING_PAGE");
  const [fFreelancerCustom, setFFreelancerCustom] = useState("");
  const [fTotalValue, setFTotalValue] = useState("");
  const [fPaymentMethod, setFPaymentMethod] = useState("A_VISTA");
  const [fInstallments, setFInstallments] = useState("");
  const [fStatus, setFStatus] = useState("IN_PROGRESS");
  const [fDataPrimeiraParcela, setFDataPrimeiraParcela] = useState("");

  const fetchServices = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await fetch("/api/services", { cache: "no-store" });
      const data = await res.json();
      setServices(data.services || []);
      if (data.asaasSummary) setFinancial(data.asaasSummary);
      if (data.period) setPeriod(data.period);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  const fetchClients = useCallback(async () => {
    const res = await fetch("/api/clients");
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setClients(data.map((c: any) => ({ id: c.id, name: c.name })));
  }, []);

  useEffect(() => {
    fetchServices();
    fetchClients();
    const timer = window.setInterval(() => fetchServices(true), 30_000);
    return () => window.clearInterval(timer);
  }, [fetchServices, fetchClients]);

  function resetForm() {
    setFName(""); setFClient(""); setFMonths(""); setFMonthlyValue("");
    setFStartDate(""); setFMetaAds(false); setFGoogleAds(false);
    setFDeliveriesPerWeek(""); setFDeliveryTypes([]);
    setFFreelancerType("LANDING_PAGE"); setFFreelancerCustom("");
    setFTotalValue(""); setFPaymentMethod("A_VISTA"); setFInstallments("");
    setFStatus("IN_PROGRESS"); setFDataPrimeiraParcela("");
  }

  function openEdit(s: ServiceData) {
    setEditService(s);
    setFName(s.name || "");
    setFClient(s.clientId);
    setFMonths(s.contractMonths ? String(s.contractMonths) : "");
    setFMonthlyValue(s.monthlyValue ? String(s.monthlyValue) : "");
    setFStartDate(s.startDate ? s.startDate.slice(0, 10) : "");
    setFMetaAds(s.metaAds);
    setFGoogleAds(s.googleAds);
    setFDeliveriesPerWeek(s.deliveriesPerWeek ? String(s.deliveriesPerWeek) : "");
    setFDeliveryTypes(s.deliveryTypes || []);
    setFFreelancerType(s.freelancerType || "LANDING_PAGE");
    setFFreelancerCustom(s.freelancerTypeCustom || "");
    setFTotalValue(s.totalValue ? String(s.totalValue) : "");
    setFPaymentMethod(s.paymentMethod || "A_VISTA");
    setFInstallments(s.installments ? String(s.installments) : "");
    setFStatus(s.status);
    setFDataPrimeiraParcela(s.dataPrimeiraParcela ? s.dataPrimeiraParcela.slice(0, 10) : "");
    setShowEdit(true);
  }

  async function handleCreate() {
    if (!fClient) return;
    setCreateLoading(true);
    try {
      const body: Record<string, unknown> = { type: activeTab, clientId: fClient };

      if (activeTab === "RECURRING") {
        if (!fName.trim()) return;
        Object.assign(body, {
          name: fName, contractMonths: fMonths, monthlyValue: fMonthlyValue,
          startDate: fStartDate || null, metaAds: fMetaAds, googleAds: fGoogleAds,
          deliveriesPerWeek: fDeliveriesPerWeek, deliveryTypes: fDeliveryTypes,
        });
      } else {
        Object.assign(body, {
          freelancerType: fFreelancerType,
          freelancerTypeCustom: fFreelancerType === "OUTRO" ? fFreelancerCustom : null,
          totalValue: fTotalValue, paymentMethod: fPaymentMethod,
          installments: fPaymentMethod === "PARCELADO" ? fInstallments : null,
          status: fStatus,
          dataPrimeiraParcela: fDataPrimeiraParcela || null,
        });
      }

      await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      resetForm();
      setShowCreate(false);
      fetchServices();
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleEdit() {
    if (!editService) return;
    setEditLoading(true);
    try {
      const body: Record<string, unknown> = {};

      if (editService.type === "RECURRING") {
        Object.assign(body, {
          name: fName, contractMonths: fMonths, monthlyValue: fMonthlyValue,
          startDate: fStartDate || null, metaAds: fMetaAds, googleAds: fGoogleAds,
          deliveriesPerWeek: fDeliveriesPerWeek, deliveryTypes: fDeliveryTypes,
          status: fStatus,
        });
      } else {
        Object.assign(body, {
          freelancerType: fFreelancerType,
          freelancerTypeCustom: fFreelancerType === "OUTRO" ? fFreelancerCustom : null,
          totalValue: fTotalValue, paymentMethod: fPaymentMethod,
          installments: fPaymentMethod === "PARCELADO" ? fInstallments : null,
          status: fStatus,
          dataPrimeiraParcela: fDataPrimeiraParcela || null,
        });
      }

      await fetch(`/api/services/${editService.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      setShowEdit(false);
      setEditService(null);
      fetchServices();
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleteLoading(id);
    try {
      await fetch(`/api/services/${id}`, { method: "DELETE" });
      fetchServices();
    } finally {
      setDeleteLoading(null);
    }
  }

  function toggleDeliveryType(type: string) {
    setFDeliveryTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  const filtered = services.filter((s) => s.type === activeTab);

  const recurringServices = services.filter((s) => s.type === "RECURRING" && s.status === "IN_PROGRESS");

  // Shared form component
  function renderServiceForm(type: "RECURRING" | "FREELANCER", isEdit: boolean) {
    const statusOptions = type === "RECURRING" ? STATUS_OPTIONS_RECURRING : STATUS_OPTIONS_FREELANCER;

    return (
      <>
        {!isEdit && (
          <SelectField label="Cliente" value={fClient} onChange={setFClient}
            placeholder="Selecione o cliente" options={clients.map((c) => ({ value: c.id, label: c.name }))} />
        )}

        {type === "RECURRING" ? (
          <>
            <Input label="Nome do Servico" value={fName} onChange={(e) => setFName(e.target.value)} placeholder="Ex: Gestao de Redes Sociais" />
            <div className="grid grid-cols-3 gap-4">
              <Input label="Duracao (meses)" type="number" value={fMonths} onChange={(e) => setFMonths(e.target.value)} placeholder="12" />
              <Input label="Valor Mensal (R$)" type="number" value={fMonthlyValue} onChange={(e) => setFMonthlyValue(e.target.value)} placeholder="2500.00" />
              <Input label="Inicio do Contrato" type="date" value={fStartDate} onChange={(e) => setFStartDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-wider font-medium mb-2">Trafego Pago</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 hover:text-gray-700" onClick={() => setFMetaAds(!fMetaAds)}>
                  {fMetaAds ? <CheckSquare size={16} className="text-accent-dark" /> : <Square size={16} className="text-gray-400" />}
                  Meta Ads
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 hover:text-gray-700" onClick={() => setFGoogleAds(!fGoogleAds)}>
                  {fGoogleAds ? <CheckSquare size={16} className="text-accent-dark" /> : <Square size={16} className="text-gray-400" />}
                  Google Ads
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Entregas por semana" type="number" value={fDeliveriesPerWeek} onChange={(e) => setFDeliveriesPerWeek(e.target.value)} placeholder="3" />
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider font-medium mb-2">Tipos de Entrega</label>
                <div className="flex flex-wrap gap-2">
                  {DELIVERY_TYPE_OPTIONS.map((dt) => (
                    <button key={dt} type="button" onClick={() => toggleDeliveryType(dt)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                        fDeliveryTypes.includes(dt) ? "bg-accent-dark/20 border-accent-dark/30 text-accent" : "bg-gray-100 border-gray-200 text-gray-400 hover:text-gray-500"
                      }`}>
                      {dt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {isEdit && (
              <SelectField label="Status" value={fStatus} onChange={setFStatus} options={statusOptions} />
            )}
          </>
        ) : (
          <>
            <SelectField label="Tipo de Servico" value={fFreelancerType} onChange={setFFreelancerType}
              options={[
                { value: "LANDING_PAGE", label: "Landing Page" },
                { value: "GOOGLE_MEU_NEGOCIO", label: "Google Meu Negocio" },
                { value: "VIDEO", label: "Video" },
                { value: "FOTO", label: "Foto" },
                { value: "OUTRO", label: "Outro" },
              ]} />
            {fFreelancerType === "OUTRO" && (
              <Input label="Especifique o tipo" value={fFreelancerCustom} onChange={(e) => setFFreelancerCustom(e.target.value)} placeholder="Descreva o servico" />
            )}
            <div className="grid grid-cols-2 gap-4">
              <Input label="Valor Total (R$)" type="number" value={fTotalValue} onChange={(e) => setFTotalValue(e.target.value)} placeholder="1500.00" />
              <SelectField label="Forma de Pagamento" value={fPaymentMethod} onChange={setFPaymentMethod}
                options={[{ value: "A_VISTA", label: "A vista" }, { value: "PARCELADO", label: "Parcelado" }]} />
            </div>
            {fPaymentMethod === "PARCELADO" && (
              <div className="grid grid-cols-2 gap-4">
                <Input label="Numero de Parcelas" type="number" value={fInstallments} onChange={(e) => setFInstallments(e.target.value)} placeholder="3" />
                <Input label="Data da 1a Parcela" type="date" value={fDataPrimeiraParcela} onChange={(e) => setFDataPrimeiraParcela(e.target.value)} />
              </div>
            )}
            <SelectField label="Status" value={fStatus} onChange={setFStatus} options={statusOptions} />
          </>
        )}
      </>
    );
  }

  return (
    <div>
      <PageHeader title="Servicos" description="Gerenciamento de servicos recorrentes e avulsos.">
        <Link href="/financeiro" className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-accent hover:text-accent">
          <ReceiptText size={16} /> Cobranças Asaas
        </Link>
        <button onClick={() => { resetForm(); setShowCreate(true); }}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-accent hover:bg-accent-dark text-white rounded-lg transition-colors">
          <Plus size={16} /> Novo Servico
        </button>
      </PageHeader>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={16} className="text-emerald-600" />
            <span className="text-xs text-gray-500">MRR contratado</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{currency(financial.contracted)}</p>
          <p className="text-xs text-gray-400 mt-1">{recurringServices.length} contratos ativos</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <ReceiptText size={16} className="text-blue-600" />
            <span className="text-xs text-gray-500">Cobrado no Asaas</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">{currency(financial.billed)}</p>
          <p className={`text-xs mt-1 ${financial.discrepancies ? "text-orange-600" : "text-gray-400"}`}>{financial.discrepancies ? `${financial.discrepancies} cliente(s) com divergência` : `Competência ${String(period.month).padStart(2, "0")}/${period.year}`}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <CircleCheckBig size={16} className="text-emerald-600" />
            <span className="text-xs text-gray-500">Recebido no Asaas</span>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{currency(financial.paid)}</p>
          <p className="text-xs text-gray-400 mt-1">Pagamento confirmado</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2"><Clock3 size={16} className="text-amber-600" /><span className="text-xs text-gray-500">A receber</span></div>
          <p className="text-2xl font-bold text-amber-600">{currency(financial.pending)}</p>
          <p className="text-xs text-gray-400 mt-1">Aguardando pagamento</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2"><TriangleAlert size={16} className="text-red-600" /><span className="text-xs text-gray-500">Inadimplente</span></div>
          <p className="text-2xl font-bold text-red-600">{currency(financial.overdue)}</p>
          <p className="text-xs text-gray-400 mt-1">Cobranças vencidas</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-50 border border-gray-200 rounded-xl p-1 w-fit">
        <button onClick={() => setActiveTab("RECURRING")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${activeTab === "RECURRING" ? "bg-accent/20 text-accent" : "text-gray-500 hover:text-gray-600"}`}>
          <Repeat size={14} /> Recorrentes
        </button>
        <button onClick={() => setActiveTab("FREELANCER")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${activeTab === "FREELANCER" ? "bg-accent/20 text-accent" : "text-gray-500 hover:text-gray-600"}`}>
          <Briefcase size={14} /> Freelancer / Avulso
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-accent-dark" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">
          Nenhum servico {activeTab === "RECURRING" ? "recorrente" : "avulso"} cadastrado.
        </div>
      ) : activeTab === "RECURRING" ? (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left text-xs text-gray-400 font-medium px-5 py-3 uppercase tracking-wider">Servico</th>
                <th className="text-left text-xs text-gray-400 font-medium px-5 py-3 uppercase tracking-wider">Cliente</th>
                <th className="text-left text-xs text-gray-400 font-medium px-5 py-3 uppercase tracking-wider">Valor contratado</th>
                <th className="text-left text-xs text-gray-400 font-medium px-5 py-3 uppercase tracking-wider">Duracao</th>
                <th className="text-left text-xs text-gray-400 font-medium px-5 py-3 uppercase tracking-wider">Status</th>
                <th className="text-left text-xs text-gray-400 font-medium px-5 py-3 uppercase tracking-wider">Asaas · mês</th>
                <th className="text-left text-xs text-gray-400 font-medium px-5 py-3 uppercase tracking-wider">Ads</th>
                <th className="text-right text-xs text-gray-400 font-medium px-5 py-3 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-5 py-3.5 text-sm text-gray-700">{s.name}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-600"><ClientIdentity client={s.client} /></td>
                  <td className="px-5 py-3.5 text-sm text-emerald-600">
                    {s.monthlyValue ? `R$ ${s.monthlyValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "-"}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-500">{s.contractMonths ? `${s.contractMonths} meses` : "-"}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[s.status] || ""}`}>
                      {statusLabels[s.status] || s.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5"><AsaasStatus service={s} /></td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-1.5">
                      {s.metaAds && <span className="text-[10px] text-blue-600/80 bg-blue-500/10 px-1.5 py-0.5 rounded">Meta</span>}
                      {s.googleAds && <span className="text-[10px] text-emerald-600/80 bg-emerald-500/10 px-1.5 py-0.5 rounded">Google</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(s)}
                        className="p-1.5 rounded-lg hover:bg-accent-dark/10 text-gray-400 hover:text-accent transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setDeleteServiceId(s.id)} disabled={deleteLoading === s.id}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-600 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <div key={s.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-medium text-gray-700">
                    {s.freelancerType === "OUTRO"
                      ? s.freelancerTypeCustom || "Outro"
                      : freelancerTypeLabels[s.freelancerType || ""] || s.freelancerType}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5"><ClientIdentity client={s.client} /></p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[s.status]}`}>
                  {statusLabels[s.status]}
                </span>
              </div>
              <p className="text-xl font-bold text-accent-dark mb-2">
                {s.totalValue ? `R$ ${s.totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "-"}
              </p>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  {s.paymentMethod === "A_VISTA" ? "A vista" : `Parcelado ${s.installments || "?"}x`}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(s)}
                    className="p-1.5 rounded-lg hover:bg-accent-dark/10 text-gray-400 hover:text-accent transition-colors">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => setDeleteServiceId(s.id)} disabled={deleteLoading === s.id}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-600 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                <AsaasStatus service={s} />
                {s.asaas.invoiceUrl && <a href={s.asaas.invoiceUrl} target="_blank" rel="noreferrer" title="Abrir cobrança no Asaas" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-accent"><ExternalLink size={14} /></a>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Novo Servico" size="lg">
        <div className="space-y-5">
          <div className="flex gap-1 bg-gray-50 border border-gray-200 rounded-xl p-1">
            <button onClick={() => setActiveTab("RECURRING")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${activeTab === "RECURRING" ? "bg-accent/20 text-accent" : "text-gray-500 hover:text-gray-600"}`}>
              <Repeat size={14} /> Recorrente
            </button>
            <button onClick={() => setActiveTab("FREELANCER")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${activeTab === "FREELANCER" ? "bg-accent/20 text-accent" : "text-gray-500 hover:text-gray-600"}`}>
              <Briefcase size={14} /> Freelancer / Avulso
            </button>
          </div>

          {renderServiceForm(activeTab, false)}

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-200">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancelar</button>
            <button onClick={handleCreate} disabled={createLoading || !fClient || (activeTab === "RECURRING" && !fName.trim())}
              className="px-6 py-2 text-sm bg-accent hover:bg-accent-dark disabled:opacity-50 text-white font-medium rounded-lg">
              {createLoading ? "Criando..." : "Criar Servico"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal open={showEdit} onClose={() => { setShowEdit(false); setEditService(null); }}
        title={`Editar Servico${editService ? ` - ${editService.name || editService.freelancerType}` : ""}`} size="lg">
        <div className="space-y-5">
          {editService && renderServiceForm(editService.type, true)}

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-200">
            <button onClick={() => { setShowEdit(false); setEditService(null); }}
              className="px-4 py-2 text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancelar</button>
            <button onClick={handleEdit} disabled={editLoading}
              className="px-6 py-2 text-sm bg-accent hover:bg-accent-dark disabled:opacity-50 text-white font-medium rounded-lg">
              {editLoading ? "Salvando..." : "Salvar Alteracoes"}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteServiceId}
        title="Excluir Serviço"
        message="Tem certeza que deseja excluir este serviço? Esta ação é irreversível."
        confirmLabel="Sim, excluir"
        cancelLabel="Cancelar"
        onConfirm={() => { const id = deleteServiceId!; setDeleteServiceId(null); handleDelete(id); }}
        onCancel={() => setDeleteServiceId(null)}
      />
    </div>
  );
}
