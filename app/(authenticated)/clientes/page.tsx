"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/ui/select-field";
import {
  Plus, ExternalLink, Calendar, MessageSquare,
  ThumbsUp, ThumbsDown, AlertCircle, FileText, Loader2,
  Repeat, Briefcase, Copy, Type, Palette, Pencil, Trash2,
  Upload, Download, ImageOff, ChevronRight, CalendarClock, MessageCircle,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatDateBR } from "@/lib/dates";
import { WeeklyDemandPanel } from "@/components/clients/weekly-demand-panel";
import { ClientChatPanel } from "@/components/clients/client-chat-panel";

interface ServiceData {
  id: string;
  type: "RECURRING" | "FREELANCER";
  name: string | null;
  monthlyValue: number | null;
  totalValue: number | null;
  status: string;
  freelancerType: string | null;
  freelancerTypeCustom: string | null;
  metaAds: boolean;
  googleAds: boolean;
  deliveryTypes: string[];
  nextRenewal: string | null;
}

interface ClientData {
  id: string; name: string; email?: string; phone?: string;
  driveLink?: string; contractLink?: string; briefing?: string;
  status: string; contractStartDate?: string; renewalDate?: string;
  classification?: "MRR" | "FREELA" | null;
  brandColors?: string[];
  brandFontPrimary?: string | null;
  brandFontSecondary?: string | null;
  logoUrl?: string | null;
  _count: { tasks: number };
  interactions: Array<{
    id: string; type: string; content: string; date: string;
    author: { id: string; name: string };
  }>;
  services?: ServiceData[];
}

// Cores atualizadas para o Dark Mode Hadar
const statusColors: Record<string, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20",
  INACTIVE: "bg-red-500/10 text-red-600 border border-red-500/20",
  PROSPECT: "bg-blue-500/10 text-blue-600 border border-blue-500/20",
};

const statusLabels: Record<string, string> = { ACTIVE: "Ativo", INACTIVE: "Inativo", PROSPECT: "Prospecto" };

const interactionIcons: Record<string, React.ReactNode> = {
  COMPLAINT: <ThumbsDown size={14} className="text-red-600" />,
  PRAISE: <ThumbsUp size={14} className="text-emerald-600" />,
  REQUEST: <AlertCircle size={14} className="text-accent" />,
  NOTE: <FileText size={14} className="text-blue-600" />,
};

const interactionLabels: Record<string, string> = {
  COMPLAINT: "Reclamação", PRAISE: "Elogio", REQUEST: "Solicitação", NOTE: "Observação",
};

export default function ClientesPage() {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  // Controle de Abas no Modal de Detalhes
  const [activeTab, setActiveTab] = useState<"GERAL" | "SERVICOS" | "DEMANDA" | "CHAT" | "INTERACOES" | "BRANDING">("GERAL");

  // Create form
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formDrive, setFormDrive] = useState("");
  const [formContract, setFormContract] = useState("");
  const [formBriefing, setFormBriefing] = useState("");
  const [formStatus, setFormStatus] = useState("ACTIVE");
  const [formStartDate, setFormStartDate] = useState("");
  const [formRenewalDate, setFormRenewalDate] = useState("");
  const [formClassification, setFormClassification] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  // Interaction form
  const [intType, setIntType] = useState("NOTE");
  const [intContent, setIntContent] = useState("");
  const [intFilter, setIntFilter] = useState("");
  const [intLoading, setIntLoading] = useState(false);

  // Edit client
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editDrive, setEditDrive] = useState("");
  const [editContract, setEditContract] = useState("");
  const [editBriefing, setEditBriefing] = useState("");
  const [editStatus, setEditStatus] = useState("ACTIVE");
  const [editStartDate, setEditStartDate] = useState("");
  const [editRenewalDate, setEditRenewalDate] = useState("");
  const [editClassification, setEditClassification] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Branding edit
  const [brandColors, setBrandColors] = useState<string[]>([]);
  const [brandFontPrimary, setBrandFontPrimary] = useState("");
  const [brandFontSecondary, setBrandFontSecondary] = useState("");
  const [newColor, setNewColor] = useState("#FF5A00");
  const [brandSaving, setBrandSaving] = useState(false);

  // Estado para feedback visual de cópia da cor
  const [copiedColor, setCopiedColor] = useState<string | null>(null);

  // Logo
  const [logoUploading, setLogoUploading] = useState(false);
  const [showDeleteClientConfirm, setShowDeleteClientConfirm] = useState(false);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/clients");
      setClients(await res.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  async function fetchClientDetail(id: string) {
    const res = await fetch(`/api/clients/${id}`);
    const data = await res.json();
    setSelectedClient(data);
    setActiveTab("GERAL");
    setEditMode(false);
    setBrandColors(data.brandColors || []);
    setBrandFontPrimary(data.brandFontPrimary || "");
    setBrandFontSecondary(data.brandFontSecondary || "");
  }

  function resetForm() {
    setFormName(""); setFormEmail(""); setFormPhone(""); setFormDrive("");
    setFormContract(""); setFormBriefing(""); setFormStatus("ACTIVE");
    setFormStartDate(""); setFormRenewalDate(""); setFormClassification("");
  }

  async function handleCreate() {
    if (!formName.trim()) return;
    setCreateLoading(true);
    try {
      await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName, email: formEmail || null, phone: formPhone || null,
          driveLink: formDrive || null, contractLink: formContract || null,
          briefing: formBriefing || null, status: formStatus,
          contractStartDate: formStartDate || null, renewalDate: formRenewalDate || null,
          classification: formClassification || null,
        }),
      });
      resetForm();
      setShowCreate(false);
      fetchClients();
    } finally { setCreateLoading(false); }
  }

  async function addInteraction() {
    if (!intContent.trim() || !selectedClient) return;
    setIntLoading(true);
    try {
      await fetch(`/api/clients/${selectedClient.id}/interactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: intType, content: intContent }),
      });
      setIntContent("");
      fetchClientDetail(selectedClient.id);
    } finally { setIntLoading(false); }
  }

  const copyToClipboard = (hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedColor(hex);
    setTimeout(() => setCopiedColor(null), 2000);
  };

  function startEditClient() {
    if (!selectedClient) return;
    setEditName(selectedClient.name);
    setEditEmail(selectedClient.email || "");
    setEditPhone(selectedClient.phone || "");
    setEditDrive(selectedClient.driveLink || "");
    setEditContract(selectedClient.contractLink || "");
    setEditBriefing(selectedClient.briefing || "");
    setEditStatus(selectedClient.status);
    setEditStartDate(selectedClient.contractStartDate ? selectedClient.contractStartDate.slice(0, 10) : "");
    setEditRenewalDate(selectedClient.renewalDate ? selectedClient.renewalDate.slice(0, 10) : "");
    setEditClassification(selectedClient.classification || "");
    setEditMode(true);
  }

  async function handleEditSave() {
    if (!selectedClient || !editName.trim()) return;
    setEditLoading(true);
    try {
      await fetch(`/api/clients/${selectedClient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName, email: editEmail || null, phone: editPhone || null,
          driveLink: editDrive || null, contractLink: editContract || null,
          briefing: editBriefing || null, status: editStatus,
          contractStartDate: editStartDate || null, renewalDate: editRenewalDate || null,
          classification: editClassification || null,
        }),
      });
      setEditMode(false);
      fetchClientDetail(selectedClient.id);
      fetchClients();
    } finally { setEditLoading(false); }
  }

  async function handleDeleteClient() {
    if (!selectedClient) return;
    try {
      await fetch(`/api/clients/${selectedClient.id}`, { method: "DELETE" });
      setShowDetail(false);
      setSelectedClient(null);
      fetchClients();
    } catch (e) {
      console.error("Error deleting client:", e);
    }
  }

  async function handleSaveBrand() {
    if (!selectedClient) return;
    setBrandSaving(true);
    try {
      await fetch(`/api/clients/${selectedClient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandColors,
          brandFontPrimary: brandFontPrimary || null,
          brandFontSecondary: brandFontSecondary || null,
        }),
      });
      fetchClientDetail(selectedClient.id);
    } finally { setBrandSaving(false); }
  }

  async function handleLogoUpload(file: File) {
    if (!selectedClient) return;
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await fetch(`/api/clients/${selectedClient.id}/logo`, { method: "POST", body: fd });
      fetchClientDetail(selectedClient.id);
      fetchClients();
    } finally { setLogoUploading(false); }
  }

  async function handleLogoRemove() {
    if (!selectedClient) return;
    await fetch(`/api/clients/${selectedClient.id}/logo`, { method: "DELETE" });
    fetchClientDetail(selectedClient.id);
    fetchClients();
  }

  function addBrandColor() {
    if (newColor && !brandColors.includes(newColor)) {
      setBrandColors([...brandColors, newColor]);
    }
  }

  function removeBrandColor(hex: string) {
    setBrandColors(brandColors.filter((c) => c !== hex));
  }

  const filteredInteractions = selectedClient?.interactions.filter(
    (i) => !intFilter || i.type === intFilter
  ) || [];

  const renewalAlerts = clients.filter((c) => {
    if (!c.renewalDate) return false;
    const diff = new Date(c.renewalDate).getTime() - Date.now();
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
  });
  const activeClientsWithoutEmail = clients.filter((c) => c.status === "ACTIVE" && !c.email);

  return (
    <div className="min-h-screen bg-transparent w-full pb-10">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            Lista de Clientes
          </h1>
          <p className="text-gray-400 mt-1">{clients.length} clientes na agência</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => { resetForm(); setShowCreate(true); }}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-accent hover:bg-accent-dark text-white rounded-xl transition-colors shadow-lg shadow-[#FF5A00]/20"
          >
            <Plus size={18} />
            Novo Cliente
          </button>
        </div>
      </div>

      {renewalAlerts.length > 0 && (
        <div className="bg-accent/10 border border-accent/20 rounded-2xl p-4 mb-6 flex items-start gap-3 backdrop-blur-sm">
          <AlertCircle className="text-accent shrink-0 mt-0.5" size={18} />
          <div>
            <p className="text-sm text-accent font-bold mb-1">Renovações nos próximos 30 dias</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {renewalAlerts.map((c) => (
                <span key={c.id} className="text-xs text-accent-dark bg-accent/20 border border-accent/30 px-3 py-1 rounded-lg font-medium">
                  {c.name} — {formatDateBR(c.renewalDate)}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeClientsWithoutEmail.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={18} />
          <div>
            <p className="text-sm text-amber-800 font-bold">{activeClientsWithoutEmail.length} cliente(s) ativo(s) sem e-mail</p>
            <p className="mt-1 text-xs text-amber-700">Abra o cliente, clique em Editar Cliente e informe o mesmo e-mail cadastrado no Asaas para permitir o vínculo automático.</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 size={32} className="animate-spin text-accent" />
        </div>
      ) : clients.length === 0 ? (
        <div className="text-center py-20 bg-white border border-gray-200 border-dashed rounded-xl">
          <p className="text-sm text-gray-400">Nenhum cliente cadastrado ainda.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <ClientTable
            title="Clientes MRR"
            subtitle="Ativos · contratos recorrentes/mensais"
            clients={clients.filter((c) => c.status === "ACTIVE" && c.classification === "MRR")}
            onSelect={(c) => { fetchClientDetail(c.id); setShowDetail(true); }}
          />
          <ClientTable
            title="Clientes Freela"
            subtitle="Ativos · trabalhos pontuais"
            clients={clients.filter((c) => c.status === "ACTIVE" && c.classification === "FREELA")}
            onSelect={(c) => { fetchClientDetail(c.id); setShowDetail(true); }}
          />
          <ClientTable
            title="Sem classificação"
            subtitle="Ativos ainda não classificados como MRR ou Freela"
            clients={clients.filter((c) => c.status === "ACTIVE" && !c.classification)}
            onSelect={(c) => { fetchClientDetail(c.id); setShowDetail(true); }}
            hideIfEmpty
          />
          <ClientTable
            title="Prospectos"
            subtitle="Ainda não fecharam contrato"
            clients={clients.filter((c) => c.status === "PROSPECT")}
            onSelect={(c) => { fetchClientDetail(c.id); setShowDetail(true); }}
            hideIfEmpty
          />
          {clients.some((c) => c.status === "INACTIVE") && (
            <details className="group">
              <summary className="cursor-pointer list-none flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-800 mb-3 select-none">
                <ChevronRight size={15} className="transition-transform group-open:rotate-90" />
                Clientes inativos ({clients.filter((c) => c.status === "INACTIVE").length})
              </summary>
              <ClientTable
                title="Inativos"
                subtitle="Contratos encerrados ou pausados"
                clients={clients.filter((c) => c.status === "INACTIVE")}
                onSelect={(c) => { fetchClientDetail(c.id); setShowDetail(true); }}
              />
            </details>
          )}
        </div>
      )}

      {/* CREATE MODAL - Atualizado para IDV */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Novo Cliente" size="lg">
        <div className="space-y-4">
          <Input label="Nome do Cliente" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Nome da empresa" required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Email" type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
            <Input label="Telefone" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Link Google Drive" value={formDrive} onChange={(e) => setFormDrive(e.target.value)} placeholder="https://drive.google.com/..." />
            <Input label="Link Contrato" value={formContract} onChange={(e) => setFormContract(e.target.value)} placeholder="https://..." />
          </div>
          <Textarea label="Briefing" value={formBriefing} onChange={(e) => setFormBriefing(e.target.value)} placeholder="Informações do briefing..." />
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Status" value={formStatus} onChange={setFormStatus} options={[
              { value: "ACTIVE", label: "Ativo" }, { value: "INACTIVE", label: "Inativo" }, { value: "PROSPECT", label: "Prospecto" },
            ]} />
            <SelectField label="Classificação" value={formClassification} onChange={setFormClassification} placeholder="Sem classificação" options={[
              { value: "MRR", label: "MRR (recorrente)" }, { value: "FREELA", label: "Freela (pontual)" },
            ]} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Início Contrato" type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} />
            <Input label="Data Renovação" type="date" value={formRenewalDate} onChange={(e) => setFormRenewalDate(e.target.value)} />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button onClick={() => setShowCreate(false)} className="px-5 py-2.5 text-sm text-gray-500 bg-white hover:bg-gray-100 rounded-xl transition-colors font-medium">Cancelar</button>
            <button onClick={handleCreate} disabled={createLoading || !formName.trim()} className="px-6 py-2.5 text-sm bg-accent hover:bg-accent-dark disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-[#FF5A00]/20 transition-all">
              {createLoading ? "Criando..." : "Criar Cliente"}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={showDeleteClientConfirm}
        title="Excluir Cliente"
        message={`Tem certeza que deseja excluir o cliente "${selectedClient?.name}"? Esta ação é irreversível e removerá todos os dados vinculados.`}
        confirmLabel="Sim, excluir"
        cancelLabel="Cancelar"
        onConfirm={() => { setShowDeleteClientConfirm(false); handleDeleteClient(); }}
        onCancel={() => setShowDeleteClientConfirm(false)}
      />

      {/* DETAIL MODAL COM ABAS */}
      <Modal
        open={showDetail && !!selectedClient}
        onClose={() => { setShowDetail(false); setSelectedClient(null); }}
        title=""
        size="xl"
      >
        {selectedClient && (
          <div className="space-y-6">

            {/* CABEÇALHO DO CLIENTE NO MODAL */}
            <div className="flex items-center gap-5 border-b border-gray-200 pb-6">
              <div className="w-20 h-20 rounded-full bg-gray-100 border-2 border-gray-300 flex items-center justify-center text-3xl font-bold text-gray-600 shadow-inner overflow-hidden">
                {selectedClient.logoUrl
                  ? <img src={selectedClient.logoUrl} alt={selectedClient.name} className="w-full h-full object-cover" />
                  : selectedClient.name.charAt(0).toUpperCase()
                }
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900">{selectedClient.name}</h2>
                <div className="flex gap-3 mt-2">
                  <span className={`text-xs uppercase tracking-wider font-bold px-2.5 py-1 rounded-md ${statusColors[selectedClient.status]}`}>
                    {statusLabels[selectedClient.status]}
                  </span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md border border-gray-300 font-medium">
                    {selectedClient._count.tasks} Tarefas Ativas
                  </span>
                </div>
              </div>
              <button onClick={() => setShowDeleteClientConfirm(true)}
                className="p-2 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-600 transition-colors" title="Excluir cliente">
                <Trash2 size={18} />
              </button>
            </div>

            {/* ABAS DE NAVEGAÇÃO */}
            <div className="flex gap-1 border-b border-gray-200 overflow-x-auto pb-[1px]">
              {[
                { id: "GERAL", label: "Visão Geral", icon: FileText },
                { id: "SERVICOS", label: "Serviços", icon: Briefcase },
                { id: "DEMANDA", label: "Demanda Semanal", icon: CalendarClock },
                { id: "CHAT", label: "Chat Interno", icon: MessageCircle },
                { id: "INTERACOES", label: "Interações", icon: MessageSquare },
                { id: "BRANDING", label: "Identidade Visual", icon: Palette }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? "border-accent text-accent"
                      : "border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <tab.icon size={16} /> {tab.label}
                </button>
              ))}
            </div>

            {/* CONTEÚDO DAS ABAS */}
            <div className="min-h-[300px] pb-4">

              {/* ABA: VISÃO GERAL */}
              {activeTab === "GERAL" && (
                <div className="space-y-6 animate-in fade-in">
                  {!editMode ? (
                    <>
                      <div className="flex justify-end">
                        <button onClick={startEditClient}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent bg-accent/10 hover:bg-accent/20 rounded-lg transition-colors">
                          <Pencil size={12} /> Editar Cliente
                        </button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {selectedClient.email && (
                          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200/50">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Email</span>
                            <span className="text-sm text-gray-800 font-medium">{selectedClient.email}</span>
                          </div>
                        )}
                        {selectedClient.phone && (
                          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200/50">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Telefone</span>
                            <span className="text-sm text-gray-800 font-medium">{selectedClient.phone}</span>
                          </div>
                        )}
                        {selectedClient.contractStartDate && (
                          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200/50">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Início</span>
                            <span className="text-sm text-gray-800 font-medium">{formatDateBR(selectedClient.contractStartDate)}</span>
                          </div>
                        )}
                        {selectedClient.renewalDate && (
                          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200/50">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Renovação</span>
                            <span className="text-sm text-gray-800 font-medium">{formatDateBR(selectedClient.renewalDate)}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-3">
                        {selectedClient.driveLink && (
                          <a href={selectedClient.driveLink} target="_blank" rel="noreferrer"
                            className="flex items-center gap-2 text-sm font-medium text-gray-900 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 px-4 py-2 rounded-xl transition-colors">
                            <ExternalLink size={16} className="text-blue-600" /> Google Drive
                          </a>
                        )}
                        {selectedClient.contractLink && (
                          <a href={selectedClient.contractLink} target="_blank" rel="noreferrer"
                            className="flex items-center gap-2 text-sm font-medium text-gray-900 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 px-4 py-2 rounded-xl transition-colors">
                            <ExternalLink size={16} className="text-emerald-600" /> Ver Contrato
                          </a>
                        )}
                      </div>

                      {selectedClient.briefing && (
                        <div className="bg-white border border-gray-200 rounded-2xl p-5">
                          <h3 className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-3">Briefing Inicial</h3>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{selectedClient.briefing}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="space-y-4">
                      <Input label="Nome do Cliente" value={editName} onChange={(e) => setEditName(e.target.value)} />
                      <div className="grid grid-cols-2 gap-4">
                        <Input label="Email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                        <Input label="Telefone" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <Input label="Link Google Drive" value={editDrive} onChange={(e) => setEditDrive(e.target.value)} />
                        <Input label="Link Contrato" value={editContract} onChange={(e) => setEditContract(e.target.value)} />
                      </div>
                      <Textarea label="Briefing" value={editBriefing} onChange={(e) => setEditBriefing(e.target.value)} />
                      <div className="grid grid-cols-2 gap-4">
                        <SelectField label="Status" value={editStatus} onChange={setEditStatus} options={[
                          { value: "ACTIVE", label: "Ativo" }, { value: "INACTIVE", label: "Inativo" }, { value: "PROSPECT", label: "Prospecto" },
                        ]} />
                        <SelectField label="Classificação" value={editClassification} onChange={setEditClassification} placeholder="Sem classificação" options={[
                          { value: "MRR", label: "MRR (recorrente)" }, { value: "FREELA", label: "Freela (pontual)" },
                        ]} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <Input label="Início Contrato" type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} />
                        <Input label="Data Renovação" type="date" value={editRenewalDate} onChange={(e) => setEditRenewalDate(e.target.value)} />
                      </div>
                      <div className="flex justify-end gap-3 pt-2">
                        <button onClick={() => setEditMode(false)} className="px-4 py-2 text-sm text-gray-500 bg-white hover:bg-gray-100 rounded-xl transition-colors">Cancelar</button>
                        <button onClick={handleEditSave} disabled={editLoading || !editName.trim()}
                          className="px-6 py-2 text-sm bg-accent hover:bg-accent-dark disabled:opacity-50 text-white font-bold rounded-xl transition-colors">
                          {editLoading ? "Salvando..." : "Salvar Alterações"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ABA: SERVIÇOS */}
              {activeTab === "SERVICOS" && (
                <div className="animate-in fade-in">
                  {selectedClient.services && selectedClient.services.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3">
                      {selectedClient.services.map((svc) => (
                        <div key={svc.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-white border border-gray-200 hover:border-gray-300 transition-colors">
                          <div className="flex items-start sm:items-center gap-4">
                            <div className="mt-1 sm:mt-0">
                              {svc.type === "RECURRING" ? (
                                <div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-600"><Repeat size={16} /></div>
                              ) : (
                                <div className="bg-blue-500/10 p-2 rounded-lg text-blue-600"><Briefcase size={16} /></div>
                              )}
                            </div>
                            <div>
                              <p className="text-base font-semibold text-gray-900">
                                {svc.type === "RECURRING"
                                  ? svc.name
                                  : svc.freelancerType === "OUTRO"
                                    ? svc.freelancerTypeCustom || "Outro"
                                    : ({ LANDING_PAGE: "Landing Page", GOOGLE_MEU_NEGOCIO: "Google Meu Negócio", VIDEO: "Vídeo", FOTO: "Foto" } as Record<string, string>)[svc.freelancerType || ""] || svc.freelancerType}
                              </p>
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {svc.metaAds && <span className="text-[10px] font-bold uppercase text-blue-600 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md">Meta Ads</span>}
                                {svc.googleAds && <span className="text-[10px] font-bold uppercase text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">Google Ads</span>}
                                {svc.deliveryTypes?.map((dt) => (
                                  <span key={dt} className="text-[10px] font-bold uppercase text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded-md">{dt}</span>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="mt-4 sm:mt-0 sm:text-right border-t sm:border-t-0 border-gray-200 pt-3 sm:pt-0">
                            <p className="text-lg font-bold text-accent">
                              {svc.type === "RECURRING"
                                ? svc.monthlyValue ? `R$ ${svc.monthlyValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês` : "-"
                                : svc.totalValue ? `R$ ${svc.totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "-"}
                            </p>
                            {svc.nextRenewal && (
                              <p className="text-xs text-gray-400 font-medium mt-1">
                                Renov. {formatDateBR(svc.nextRenewal)}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 bg-white border border-gray-200 border-dashed rounded-2xl">
                      <p className="text-gray-400 text-sm">Nenhum serviço vinculado a este cliente.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ABA: DEMANDA SEMANAL */}
              {activeTab === "DEMANDA" && (
                <div className="animate-in fade-in">
                  <WeeklyDemandPanel clientId={selectedClient.id} />
                </div>
              )}

              {/* ABA: CHAT INTERNO */}
              {activeTab === "CHAT" && (
                <div className="animate-in fade-in">
                  <ClientChatPanel clientId={selectedClient.id} />
                </div>
              )}

              {/* ABA: INTERAÇÕES */}
              {activeTab === "INTERACOES" && (
                <div className="animate-in fade-in">
                  <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
                    {["", "COMPLAINT", "PRAISE", "REQUEST", "NOTE"].map((t) => (
                      <button
                        key={t}
                        onClick={() => setIntFilter(t)}
                        className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                          intFilter === t
                            ? "bg-accent text-white shadow-md shadow-[#FF5A00]/20"
                            : "bg-white border border-gray-200 text-gray-500 hover:text-gray-900"
                        }`}
                      >
                        {t ? interactionLabels[t] : "Todos os Registros"}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-3 mb-6 bg-white border border-gray-200 p-2 rounded-xl">
                    <select
                      value={intType}
                      onChange={(e) => setIntType(e.target.value)}
                      className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:border-accent"
                    >
                      <option value="NOTE">Observação</option>
                      <option value="COMPLAINT">Reclamação</option>
                      <option value="PRAISE">Elogio</option>
                      <option value="REQUEST">Solicitação</option>
                    </select>
                    <input
                      value={intContent}
                      onChange={(e) => setIntContent(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") addInteraction(); }}
                      placeholder="Registrar nova interação com o cliente..."
                      className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-accent"
                    />
                    <button
                      onClick={addInteraction}
                      disabled={intLoading || !intContent.trim()}
                      className="px-5 bg-accent hover:bg-accent-dark text-white rounded-lg text-sm font-bold disabled:opacity-50 transition-colors"
                    >
                      {intLoading ? <Loader2 size={16} className="animate-spin" /> : "Salvar"}
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                    {filteredInteractions.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-10 border border-gray-200 border-dashed rounded-xl">Nenhum registro encontrado.</p>
                    ) : (
                      filteredInteractions.map((int) => (
                        <div key={int.id} className="flex items-start gap-4 p-4 rounded-xl bg-white border border-gray-200 hover:border-gray-300 transition-colors">
                          <div className="mt-1 p-2 rounded-lg bg-gray-50">{interactionIcons[int.type]}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-800 leading-relaxed">{int.content}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-[10px] font-bold text-gray-400 uppercase bg-gray-50 px-2 py-0.5 rounded">
                                {interactionLabels[int.type]}
                              </span>
                              <span className="text-[11px] text-gray-400">
                                Por <strong className="text-gray-500">{int.author.name}</strong> em {new Date(int.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* ABA: IDENTIDADE VISUAL (Branding Client) */}
              {activeTab === "BRANDING" && (
                <div className="animate-in fade-in space-y-5">
                  {/* LOGO */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6">
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-4">
                      <ImageOff size={16} className="text-accent" /> Logo do Cliente
                    </h3>
                    <div className="flex items-center gap-6">
                      <div className="w-24 h-24 rounded-2xl bg-gray-100 border-2 border-gray-300 flex items-center justify-center overflow-hidden shrink-0">
                        {selectedClient.logoUrl
                          ? <img src={selectedClient.logoUrl} alt={selectedClient.name} className="w-full h-full object-contain p-1" />
                          : <span className="text-3xl font-bold text-gray-400">{selectedClient.name.charAt(0).toUpperCase()}</span>
                        }
                      </div>
                      <div className="flex flex-col gap-3">
                        <label className="flex items-center gap-2 px-4 py-2.5 bg-accent/10 hover:bg-accent/20 border border-accent/30 text-accent text-sm font-bold rounded-xl cursor-pointer transition-colors">
                          {logoUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                          {logoUploading ? "Enviando..." : "Subir Logo"}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }}
                          />
                        </label>
                        {selectedClient.logoUrl && (
                          <>
                            <a
                              href={selectedClient.logoUrl}
                              download={`logo-${selectedClient.name.toLowerCase().replace(/\s/g, "-")}.png`}
                              className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-600 text-sm font-medium rounded-xl transition-colors"
                            >
                              <Download size={16} /> Download Logo
                            </a>
                            <button
                              onClick={handleLogoRemove}
                              className="flex items-center gap-2 px-4 py-2 text-red-600 hover:text-red-700 text-xs font-medium transition-colors"
                            >
                              <Trash2 size={13} /> Remover Logo
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* PALETA DE CORES */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-6">
                      <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-1">
                        <Palette size={16} className="text-accent" /> Paleta de Cores
                      </h3>
                      <p className="text-xs text-gray-400 mb-4">Clique para copiar, X para remover</p>

                      {brandColors.length > 0 ? (
                        <div className="grid grid-cols-3 gap-3 mb-4">
                          {brandColors.map((hex) => (
                            <div key={hex} className="flex flex-col items-center group relative">
                              <button
                                onClick={() => copyToClipboard(hex)}
                                className="w-full aspect-video rounded-xl shadow-inner border border-gray-200 relative overflow-hidden flex items-center justify-center transition-transform hover:scale-105"
                                style={{ backgroundColor: hex }}
                              >
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  {copiedColor === hex ? (
                                    <span className="text-white text-xs font-bold">Copiado!</span>
                                  ) : (
                                    <Copy size={16} className="text-white" />
                                  )}
                                </div>
                              </button>
                              <button onClick={() => removeBrandColor(hex)}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                X
                              </button>
                              <span className="text-[11px] font-mono text-gray-500 mt-2">{hex}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 mb-4">Nenhuma cor cadastrada.</p>
                      )}

                      <div className="flex items-center gap-2">
                        <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)}
                          className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer bg-transparent" />
                        <input type="text" value={newColor} onChange={(e) => setNewColor(e.target.value)}
                          className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 font-mono focus:outline-none focus:border-accent/50"
                          placeholder="#000000" />
                        <button onClick={addBrandColor}
                          className="px-4 py-2 bg-accent hover:bg-accent-dark text-white text-sm font-bold rounded-lg transition-colors">
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>

                    {/* TIPOGRAFIA */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-6">
                      <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-4">
                        <Type size={16} className="text-accent" /> Tipografia do Cliente
                      </h3>

                      <div className="space-y-4">
                        <div>
                          <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1.5">Fonte Primaria (Titulos)</label>
                          <input type="text" value={brandFontPrimary} onChange={(e) => setBrandFontPrimary(e.target.value)}
                            placeholder="Ex: Inter, Montserrat, Poppins..."
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-accent/50" />
                          {brandFontPrimary && (
                            <p className="text-lg text-gray-500 mt-2" style={{ fontFamily: `${brandFontPrimary}, sans-serif` }}>
                              A raposa marrom salta rapido.
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1.5">Fonte Secundaria (Textos)</label>
                          <input type="text" value={brandFontSecondary} onChange={(e) => setBrandFontSecondary(e.target.value)}
                            placeholder="Ex: Poppins, Open Sans, Roboto..."
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-accent/50" />
                          {brandFontSecondary && (
                            <p className="text-sm text-gray-400 mt-2" style={{ fontFamily: `${brandFontSecondary}, sans-serif` }}>
                              A rapida raposa marrom salta sobre o cao preguicoso.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Save button */}
                  <div className="flex justify-end">
                    <button onClick={handleSaveBrand} disabled={brandSaving}
                      className="px-6 py-2.5 text-sm bg-accent hover:bg-accent-dark disabled:opacity-50 text-white font-bold rounded-xl transition-colors shadow-lg shadow-[#FF5A00]/20">
                      {brandSaving ? "Salvando..." : "Salvar Identidade Visual"}
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </Modal>
    </div>
  );
}

function ClientTable({
  title, subtitle, clients, onSelect, hideIfEmpty,
}: {
  title: string;
  subtitle: string;
  clients: ClientData[];
  onSelect: (c: ClientData) => void;
  hideIfEmpty?: boolean;
}) {
  if (hideIfEmpty && clients.length === 0) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
          <p className="text-[11px] text-gray-400">{subtitle}</p>
        </div>
        <span className="text-xs text-gray-400">{clients.length}</span>
      </div>
      {clients.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-8">Nenhum cliente nesta categoria.</p>
      ) : (
        <div>
          {clients.map((client) => (
            <button
              key={client.id}
              onClick={() => onSelect(client)}
              className="w-full flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0 overflow-hidden">
                {client.logoUrl ? <img src={client.logoUrl} alt={client.name} className="w-full h-full object-cover" /> : client.name.charAt(0).toUpperCase()}
              </div>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-gray-800 truncate">{client.name}</span>
                <span className={`block text-[11px] truncate ${client.email ? "text-gray-400" : "text-amber-600"}`}>{client.email || "E-mail não cadastrado"}</span>
              </span>
              <span className={`text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded shrink-0 ${statusColors[client.status]}`}>
                {statusLabels[client.status]}
              </span>
              <span className="text-xs text-gray-400 shrink-0 hidden sm:inline">{client._count.tasks} tarefas</span>
              <ChevronRight size={14} className="text-gray-300 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
