"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/page-header";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/ui/select-field";
import {
  Plus, ExternalLink, Calendar, MessageSquare,
  ThumbsUp, ThumbsDown, AlertCircle, FileText, Loader2,
  Repeat, Briefcase, Copy, Type, Palette, Pencil, Trash2,
  Upload, Download, ImageOff
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

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
  ACTIVE: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  INACTIVE: "bg-red-500/10 text-red-400 border border-red-500/20",
  PROSPECT: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
};

const statusLabels: Record<string, string> = { ACTIVE: "Ativo", INACTIVE: "Inativo", PROSPECT: "Prospecto" };

const interactionIcons: Record<string, React.ReactNode> = {
  COMPLAINT: <ThumbsDown size={14} className="text-red-400" />,
  PRAISE: <ThumbsUp size={14} className="text-emerald-400" />,
  REQUEST: <AlertCircle size={14} className="text-amber-400" />,
  NOTE: <FileText size={14} className="text-blue-400" />,
};

const interactionLabels: Record<string, string> = {
  COMPLAINT: "Reclamação", PRAISE: "Elogio", REQUEST: "Solicitação", NOTE: "Observação",
};

export default function ClientesPage() {
  useSession();
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  
  // Controle de Abas no Modal de Detalhes
  const [activeTab, setActiveTab] = useState<"GERAL" | "SERVICOS" | "INTERACOES" | "BRANDING">("GERAL");

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
    setFormStartDate(""); setFormRenewalDate("");
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

  return (
    <div className="min-h-screen bg-transparent w-full pb-10">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2">
            Lista de Clientes 🍌
          </h1>
          <p className="text-zinc-500 mt-1">{clients.length} clientes na agência</p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={() => { resetForm(); setShowCreate(true); }}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-[#FF5A00] hover:bg-[#E04D00] text-white rounded-xl transition-colors shadow-lg shadow-[#FF5A00]/20"
          >
            <Plus size={18} />
            Novo Cliente
          </button>
        </div>
      </div>

      {renewalAlerts.length > 0 && (
        <div className="bg-[#FF5A00]/10 border border-[#FF5A00]/20 rounded-2xl p-4 mb-6 flex items-start gap-3 backdrop-blur-sm">
          <AlertCircle className="text-[#FF5A00] shrink-0 mt-0.5" size={18} />
          <div>
            <p className="text-sm text-[#FF5A00] font-bold mb-1">Renovações nos próximos 30 dias</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {renewalAlerts.map((c) => (
                <span key={c.id} className="text-xs text-orange-200 bg-[#FF5A00]/20 border border-[#FF5A00]/30 px-3 py-1 rounded-lg font-medium">
                  {c.name} — {new Date(c.renewalDate!).toLocaleDateString("pt-BR")}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 size={32} className="animate-spin text-[#FF5A00]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {clients.map((client) => (
            <div
              key={client.id}
              onClick={() => { fetchClientDetail(client.id); setShowDetail(true); }}
              className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60 rounded-2xl p-6 hover:border-[#FF5A00]/50 transition-all cursor-pointer group flex items-center gap-4"
            >
              <div className="w-14 h-14 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xl font-bold text-zinc-300 group-hover:text-[#FF5A00] transition-colors shrink-0 shadow-inner overflow-hidden">
                {client.logoUrl
                  ? <img src={client.logoUrl} alt={client.name} className="w-full h-full object-cover" />
                  : client.name.charAt(0).toUpperCase()
                }
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-white group-hover:text-[#FF5A00] transition-colors truncate">
                  {client.name}
                </h3>
                <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded mt-1.5 inline-block ${statusColors[client.status]}`}>
                  {statusLabels[client.status]}
                </span>
              </div>
            </div>
          ))}
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
          <div className="grid grid-cols-3 gap-4">
            <SelectField label="Status" value={formStatus} onChange={setFormStatus} options={[
              { value: "ACTIVE", label: "Ativo" }, { value: "INACTIVE", label: "Inativo" }, { value: "PROSPECT", label: "Prospecto" },
            ]} />
            <Input label="Início Contrato" type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} />
            <Input label="Data Renovação" type="date" value={formRenewalDate} onChange={(e) => setFormRenewalDate(e.target.value)} />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
            <button onClick={() => setShowCreate(false)} className="px-5 py-2.5 text-sm text-zinc-400 bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-colors font-medium">Cancelar</button>
            <button onClick={handleCreate} disabled={createLoading || !formName.trim()} className="px-6 py-2.5 text-sm bg-[#FF5A00] hover:bg-[#E04D00] disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-[#FF5A00]/20 transition-all">
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
            <div className="flex items-center gap-5 border-b border-zinc-800 pb-6">
              <div className="w-20 h-20 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center text-3xl font-bold text-zinc-300 shadow-inner overflow-hidden">
                {selectedClient.logoUrl
                  ? <img src={selectedClient.logoUrl} alt={selectedClient.name} className="w-full h-full object-cover" />
                  : selectedClient.name.charAt(0).toUpperCase()
                }
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white">{selectedClient.name}</h2>
                <div className="flex gap-3 mt-2">
                  <span className={`text-xs uppercase tracking-wider font-bold px-2.5 py-1 rounded-md ${statusColors[selectedClient.status]}`}>
                    {statusLabels[selectedClient.status]}
                  </span>
                  <span className="text-xs bg-zinc-800 text-zinc-300 px-2.5 py-1 rounded-md border border-zinc-700 font-medium">
                    {selectedClient._count.tasks} Tarefas Ativas
                  </span>
                </div>
              </div>
              <button onClick={() => setShowDeleteClientConfirm(true)}
                className="p-2 rounded-lg hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-colors" title="Excluir cliente">
                <Trash2 size={18} />
              </button>
            </div>

            {/* ABAS DE NAVEGAÇÃO */}
            <div className="flex gap-1 border-b border-zinc-800 overflow-x-auto pb-[1px]">
              {[
                { id: "GERAL", label: "Visão Geral", icon: FileText },
                { id: "SERVICOS", label: "Serviços", icon: Briefcase },
                { id: "INTERACOES", label: "Interações", icon: MessageSquare },
                { id: "BRANDING", label: "Identidade Visual", icon: Palette }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id 
                      ? "border-[#FF5A00] text-[#FF5A00]" 
                      : "border-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-700"
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
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#FF5A00] bg-[#FF5A00]/10 hover:bg-[#FF5A00]/20 rounded-lg transition-colors">
                          <Pencil size={12} /> Editar Cliente
                        </button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {selectedClient.email && (
                          <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50">
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Email</span>
                            <span className="text-sm text-zinc-200 font-medium">{selectedClient.email}</span>
                          </div>
                        )}
                        {selectedClient.phone && (
                          <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50">
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Telefone</span>
                            <span className="text-sm text-zinc-200 font-medium">{selectedClient.phone}</span>
                          </div>
                        )}
                        {selectedClient.contractStartDate && (
                          <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50">
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Início</span>
                            <span className="text-sm text-zinc-200 font-medium">{new Date(selectedClient.contractStartDate).toLocaleDateString("pt-BR")}</span>
                          </div>
                        )}
                        {selectedClient.renewalDate && (
                          <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50">
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Renovação</span>
                            <span className="text-sm text-zinc-200 font-medium">{new Date(selectedClient.renewalDate).toLocaleDateString("pt-BR")}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-3">
                        {selectedClient.driveLink && (
                          <a href={selectedClient.driveLink} target="_blank" rel="noreferrer"
                            className="flex items-center gap-2 text-sm font-medium text-white bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 px-4 py-2 rounded-xl transition-colors">
                            <ExternalLink size={16} className="text-blue-400" /> Google Drive
                          </a>
                        )}
                        {selectedClient.contractLink && (
                          <a href={selectedClient.contractLink} target="_blank" rel="noreferrer"
                            className="flex items-center gap-2 text-sm font-medium text-white bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 px-4 py-2 rounded-xl transition-colors">
                            <ExternalLink size={16} className="text-emerald-400" /> Ver Contrato
                          </a>
                        )}
                      </div>

                      {selectedClient.briefing && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                          <h3 className="text-xs text-zinc-500 font-bold uppercase tracking-wider mb-3">Briefing Inicial</h3>
                          <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{selectedClient.briefing}</p>
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
                      <div className="grid grid-cols-3 gap-4">
                        <SelectField label="Status" value={editStatus} onChange={setEditStatus} options={[
                          { value: "ACTIVE", label: "Ativo" }, { value: "INACTIVE", label: "Inativo" }, { value: "PROSPECT", label: "Prospecto" },
                        ]} />
                        <Input label="Início Contrato" type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} />
                        <Input label="Data Renovação" type="date" value={editRenewalDate} onChange={(e) => setEditRenewalDate(e.target.value)} />
                      </div>
                      <div className="flex justify-end gap-3 pt-2">
                        <button onClick={() => setEditMode(false)} className="px-4 py-2 text-sm text-zinc-400 bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-colors">Cancelar</button>
                        <button onClick={handleEditSave} disabled={editLoading || !editName.trim()}
                          className="px-6 py-2 text-sm bg-[#FF5A00] hover:bg-[#E04D00] disabled:opacity-50 text-white font-bold rounded-xl transition-colors">
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
                        <div key={svc.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors">
                          <div className="flex items-start sm:items-center gap-4">
                            <div className="mt-1 sm:mt-0">
                              {svc.type === "RECURRING" ? (
                                <div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-400"><Repeat size={16} /></div>
                              ) : (
                                <div className="bg-blue-500/10 p-2 rounded-lg text-blue-400"><Briefcase size={16} /></div>
                              )}
                            </div>
                            <div>
                              <p className="text-base font-semibold text-white">
                                {svc.type === "RECURRING"
                                  ? svc.name
                                  : svc.freelancerType === "OUTRO"
                                    ? svc.freelancerTypeCustom || "Outro"
                                    : ({ LANDING_PAGE: "Landing Page", GOOGLE_MEU_NEGOCIO: "Google Meu Negócio", VIDEO: "Vídeo", FOTO: "Foto" } as Record<string, string>)[svc.freelancerType || ""] || svc.freelancerType}
                              </p>
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {svc.metaAds && <span className="text-[10px] font-bold uppercase text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md">Meta Ads</span>}
                                {svc.googleAds && <span className="text-[10px] font-bold uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">Google Ads</span>}
                                {svc.deliveryTypes?.map((dt) => (
                                  <span key={dt} className="text-[10px] font-bold uppercase text-[#FF5A00] bg-[#FF5A00]/10 border border-[#FF5A00]/20 px-2 py-0.5 rounded-md">{dt}</span>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="mt-4 sm:mt-0 sm:text-right border-t sm:border-t-0 border-zinc-800 pt-3 sm:pt-0">
                            <p className="text-lg font-bold text-[#FF5A00]">
                              {svc.type === "RECURRING"
                                ? svc.monthlyValue ? `R$ ${svc.monthlyValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês` : "-"
                                : svc.totalValue ? `R$ ${svc.totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "-"}
                            </p>
                            {svc.nextRenewal && (
                              <p className="text-xs text-zinc-500 font-medium mt-1">
                                Renov. {new Date(svc.nextRenewal).toLocaleDateString("pt-BR")}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 bg-zinc-900 border border-zinc-800 border-dashed rounded-2xl">
                      <p className="text-zinc-500 text-sm">Nenhum serviço vinculado a este cliente.</p>
                    </div>
                  )}
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
                            ? "bg-[#FF5A00] text-white shadow-md shadow-[#FF5A00]/20" 
                            : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"
                        }`}
                      >
                        {t ? interactionLabels[t] : "Todos os Registros"}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-3 mb-6 bg-zinc-900 border border-zinc-800 p-2 rounded-xl">
                    <select
                      value={intType}
                      onChange={(e) => setIntType(e.target.value)}
                      className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-300 focus:outline-none focus:border-[#FF5A00]"
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
                      className="flex-1 px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#FF5A00]"
                    />
                    <button
                      onClick={addInteraction}
                      disabled={intLoading || !intContent.trim()}
                      className="px-5 bg-[#FF5A00] hover:bg-[#E04D00] text-white rounded-lg text-sm font-bold disabled:opacity-50 transition-colors"
                    >
                      {intLoading ? <Loader2 size={16} className="animate-spin" /> : "Salvar"}
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                    {filteredInteractions.length === 0 ? (
                      <p className="text-sm text-zinc-600 text-center py-10 border border-zinc-800 border-dashed rounded-xl">Nenhum registro encontrado.</p>
                    ) : (
                      filteredInteractions.map((int) => (
                        <div key={int.id} className="flex items-start gap-4 p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors">
                          <div className="mt-1 p-2 rounded-lg bg-zinc-950">{interactionIcons[int.type]}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-zinc-200 leading-relaxed">{int.content}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-[10px] font-bold text-zinc-500 uppercase bg-zinc-950 px-2 py-0.5 rounded">
                                {interactionLabels[int.type]}
                              </span>
                              <span className="text-[11px] text-zinc-500">
                                Por <strong className="text-zinc-400">{int.author.name}</strong> em {new Date(int.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })}
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
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
                      <ImageOff size={16} className="text-[#FF5A00]" /> Logo do Cliente
                    </h3>
                    <div className="flex items-center gap-6">
                      <div className="w-24 h-24 rounded-2xl bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center overflow-hidden shrink-0">
                        {selectedClient.logoUrl
                          ? <img src={selectedClient.logoUrl} alt={selectedClient.name} className="w-full h-full object-contain p-1" />
                          : <span className="text-3xl font-bold text-zinc-500">{selectedClient.name.charAt(0).toUpperCase()}</span>
                        }
                      </div>
                      <div className="flex flex-col gap-3">
                        <label className="flex items-center gap-2 px-4 py-2.5 bg-[#FF5A00]/10 hover:bg-[#FF5A00]/20 border border-[#FF5A00]/30 text-[#FF5A00] text-sm font-bold rounded-xl cursor-pointer transition-colors">
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
                              className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-sm font-medium rounded-xl transition-colors"
                            >
                              <Download size={16} /> Download Logo
                            </a>
                            <button
                              onClick={handleLogoRemove}
                              className="flex items-center gap-2 px-4 py-2 text-red-400 hover:text-red-300 text-xs font-medium transition-colors"
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
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
                        <Palette size={16} className="text-[#FF5A00]" /> Paleta de Cores
                      </h3>
                      <p className="text-xs text-zinc-500 mb-4">Clique para copiar, X para remover</p>

                      {brandColors.length > 0 ? (
                        <div className="grid grid-cols-3 gap-3 mb-4">
                          {brandColors.map((hex) => (
                            <div key={hex} className="flex flex-col items-center group relative">
                              <button
                                onClick={() => copyToClipboard(hex)}
                                className="w-full aspect-video rounded-xl shadow-inner border border-white/10 relative overflow-hidden flex items-center justify-center transition-transform hover:scale-105"
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
                              <span className="text-[11px] font-mono text-zinc-400 mt-2">{hex}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-600 mb-4">Nenhuma cor cadastrada.</p>
                      )}

                      <div className="flex items-center gap-2">
                        <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)}
                          className="w-10 h-10 rounded-lg border border-zinc-700 cursor-pointer bg-transparent" />
                        <input type="text" value={newColor} onChange={(e) => setNewColor(e.target.value)}
                          className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-[#FF5A00]/50"
                          placeholder="#000000" />
                        <button onClick={addBrandColor}
                          className="px-4 py-2 bg-[#FF5A00] hover:bg-[#E04D00] text-white text-sm font-bold rounded-lg transition-colors">
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>

                    {/* TIPOGRAFIA */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
                        <Type size={16} className="text-[#FF5A00]" /> Tipografia do Cliente
                      </h3>

                      <div className="space-y-4">
                        <div>
                          <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1.5">Fonte Primaria (Titulos)</label>
                          <input type="text" value={brandFontPrimary} onChange={(e) => setBrandFontPrimary(e.target.value)}
                            placeholder="Ex: Inter, Montserrat, Poppins..."
                            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white focus:outline-none focus:border-[#FF5A00]/50" />
                          {brandFontPrimary && (
                            <p className="text-lg text-zinc-400 mt-2" style={{ fontFamily: `${brandFontPrimary}, sans-serif` }}>
                              A raposa marrom salta rapido.
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1.5">Fonte Secundaria (Textos)</label>
                          <input type="text" value={brandFontSecondary} onChange={(e) => setBrandFontSecondary(e.target.value)}
                            placeholder="Ex: Poppins, Open Sans, Roboto..."
                            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white focus:outline-none focus:border-[#FF5A00]/50" />
                          {brandFontSecondary && (
                            <p className="text-sm text-zinc-500 mt-2" style={{ fontFamily: `${brandFontSecondary}, sans-serif` }}>
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
                      className="px-6 py-2.5 text-sm bg-[#FF5A00] hover:bg-[#E04D00] disabled:opacity-50 text-white font-bold rounded-xl transition-colors shadow-lg shadow-[#FF5A00]/20">
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