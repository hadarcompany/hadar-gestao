"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/ui/select-field";
import { Avatar } from "@/components/ui/avatar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LEAD_STAGES, LEAD_ORIGINS, OPEN_STAGES, type LeadData, type LeadStage } from "@/lib/leads";
import { formatDateBR } from "@/lib/dates";
import { Plus, Loader2, Trash2, Mail, Phone, Building2, GripVertical, MessageCircle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const BRL = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface FormState {
  name: string; company: string; email: string; phone: string;
  origin: string; product: string; stage: LeadStage; value: string;
  notes: string; lostReason: string; ownerId: string;
}

const EMPTY_FORM: FormState = {
  name: "", company: "", email: "", phone: "", origin: "", product: "",
  stage: "NOVO", value: "", notes: "", lostReason: "", ownerId: "",
};

export default function PipelinePage() {
  const [leads, setLeads] = useState<LeadData[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; image?: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<LeadData | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<LeadStage | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<LeadData | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/leads");
      setLeads(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
    fetch("/api/users").then((r) => r.json()).then(setUsers);
  }, [fetchLeads]);

  const byStage = useMemo(() => {
    const map = {} as Record<LeadStage, LeadData[]>;
    LEAD_STAGES.forEach((s) => { map[s.value] = []; });
    leads.forEach((l) => { (map[l.stage] ??= []).push(l); });
    return map;
  }, [leads]);

  const openValue = useMemo(
    () => leads.filter((l) => OPEN_STAGES.includes(l.stage)).reduce((sum, l) => sum + (l.value ?? 0), 0),
    [leads]
  );
  const wonValue = useMemo(
    () => leads.filter((l) => l.stage === "FECHADO").reduce((sum, l) => sum + (l.value ?? 0), 0),
    [leads]
  );

  function openCreate(stage: LeadStage = "NOVO") {
    setEditing(null);
    setForm({ ...EMPTY_FORM, stage });
    setError(null);
    setShowForm(true);
  }

  function openEdit(lead: LeadData) {
    setEditing(lead);
    setForm({
      name: lead.name,
      company: lead.company ?? "",
      email: lead.email ?? "",
      phone: lead.phone ?? "",
      origin: lead.origin ?? "",
      product: lead.product ?? "",
      stage: lead.stage,
      value: lead.value != null ? String(lead.value) : "",
      notes: lead.notes ?? "",
      lostReason: lead.lostReason ?? "",
      ownerId: lead.ownerId ?? "",
    });
    setError(null);
    setShowForm(true);
  }

  async function save() {
    if (!form.name.trim()) { setError("Informe o nome do lead."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(editing ? `/api/leads/${editing.id}` : "/api/leads", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, value: form.value === "" ? null : Number(form.value) }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Falha ao salvar");
      const saved: LeadData = await res.json();
      setLeads((prev) => (editing ? prev.map((l) => (l.id === saved.id ? saved : l)) : [saved, ...prev]));
      setShowForm(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function moveTo(lead: LeadData, stage: LeadStage) {
    if (lead.stage === stage) return;
    const previous = leads;
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, stage } : l)));
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) throw new Error();
      const saved: LeadData = await res.json();
      setLeads((prev) => prev.map((l) => (l.id === saved.id ? saved : l)));
    } catch {
      setLeads(previous);
      setError("Não foi possível mover o lead.");
    }
  }

  async function remove(lead: LeadData) {
    setLeads((prev) => prev.filter((l) => l.id !== lead.id));
    setConfirmDelete(null);
    setShowForm(false);
    await fetch(`/api/leads/${lead.id}`, { method: "DELETE" }).catch(() => fetchLeads());
  }

  return (
    <div className="min-h-screen bg-transparent w-full pb-10">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-5 gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Pipeline</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {leads.filter((l) => OPEN_STAGES.includes(l.stage)).length} em aberto · {BRL(openValue)} em negociação · {BRL(wonValue)} fechado
          </p>
        </div>
        <button
          onClick={() => openCreate()}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-accent hover:bg-accent-dark text-white rounded-lg transition-colors self-start"
        >
          <Plus size={15} /> Novo Lead
        </button>
      </div>

      {error && !showForm && (
        <p className="mb-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-accent" /></div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {LEAD_STAGES.map((stage) => {
            const items = byStage[stage.value] ?? [];
            const total = items.reduce((sum, l) => sum + (l.value ?? 0), 0);
            return (
              <div
                key={stage.value}
                onDragOver={(e) => { e.preventDefault(); setDragOverStage(stage.value); }}
                onDragLeave={() => setDragOverStage((s) => (s === stage.value ? null : s))}
                onDrop={() => {
                  const lead = leads.find((l) => l.id === dragging);
                  if (lead) moveTo(lead, stage.value);
                  setDragging(null);
                  setDragOverStage(null);
                }}
                className={cn(
                  "w-64 shrink-0 rounded-xl border transition-colors",
                  dragOverStage === stage.value ? "border-accent bg-accent/5" : "border-gray-200 bg-gray-50/60"
                )}
              >
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200/70">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn("w-2 h-2 rounded-full shrink-0", stage.dot)} />
                    <span className="text-xs font-semibold text-gray-700 truncate">{stage.label}</span>
                    <span className="text-[10px] text-gray-400 shrink-0">({items.length})</span>
                  </div>
                  <button
                    onClick={() => openCreate(stage.value)}
                    title={`Novo lead em ${stage.label}`}
                    className="text-gray-300 hover:text-accent transition-colors shrink-0"
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {total > 0 && (
                  <p className="px-3 py-1.5 text-[11px] text-gray-400 border-b border-gray-200/70">{BRL(total)}</p>
                )}

                <div className="p-2 space-y-2 min-h-[120px]">
                  {items.length === 0 ? (
                    <p className="text-[11px] text-gray-300 text-center py-6">Arraste um lead para cá</p>
                  ) : (
                    items.map((lead) => (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={() => setDragging(lead.id)}
                        onDragEnd={() => { setDragging(null); setDragOverStage(null); }}
                        onClick={() => openEdit(lead)}
                        className={cn(
                          "group bg-white border border-gray-200 rounded-lg p-2.5 cursor-pointer hover:border-accent/40 transition-all",
                          dragging === lead.id && "opacity-40"
                        )}
                      >
                        <div className="flex items-start gap-1.5 mb-1">
                          <GripVertical size={12} className="text-gray-300 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <p className="flex-1 text-xs font-semibold text-gray-800 leading-snug">{lead.name}</p>
                        </div>
                        {lead.company && (
                          <p className="flex items-center gap-1 text-[11px] text-gray-400 mb-1">
                            <Building2 size={10} /> {lead.company}
                          </p>
                        )}
                        {lead.value != null && (
                          <p className="text-xs font-bold text-emerald-600 mb-1">{BRL(lead.value)}</p>
                        )}
                        <div className="flex items-center justify-between gap-2 mt-1.5">
                          {lead.origin ? (
                            <span className="text-[10px] text-gray-400 px-1.5 py-0.5 rounded bg-gray-100 truncate">{lead.origin}</span>
                          ) : <span />}
                          {lead.owner && <Avatar name={lead.owner.name} image={lead.owner.image} size={18} className="text-[8px] shrink-0" />}
                        </div>
                        {lead.whatsappConversations?.[0] && (
                          <Link
                            href={`/whatsapp?conversation=${lead.whatsappConversations[0].id}`}
                            onClick={(event) => event.stopPropagation()}
                            className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-emerald-600 hover:text-emerald-700"
                          >
                            <MessageCircle size={11} /> Abrir conversa
                          </Link>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? "Editar lead" : "Novo lead"}>
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="Nome *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Quem é o contato" />
            <Input label="Empresa" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            <Input label="E-mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Telefone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <SelectField
              label="Origem"
              value={form.origin}
              onChange={(v) => setForm({ ...form, origin: v })}
              placeholder="De onde veio"
              options={LEAD_ORIGINS.map((o) => ({ value: o, label: o }))}
            />
            <Input label="Produto / serviço" value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} placeholder="O que foi negociado" />
            <SelectField
              label="Etapa"
              value={form.stage}
              onChange={(v) => setForm({ ...form, stage: v as LeadStage })}
              options={LEAD_STAGES.map((s) => ({ value: s.value, label: s.label }))}
            />
            <Input label="Valor (R$)" type="number" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="0,00" />
            <SelectField
              label="Responsável"
              value={form.ownerId}
              onChange={(v) => setForm({ ...form, ownerId: v })}
              placeholder="Sem responsável"
              options={users.map((u) => ({ value: u.id, label: u.name }))}
            />
          </div>

          {form.stage === "PERDIDO" && (
            <Input label="Motivo da perda" value={form.lostReason} onChange={(e) => setForm({ ...form, lostReason: e.target.value })} placeholder="Preço, timing, concorrente..." />
          )}

          <Textarea label="Anotações" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />

          {editing && (
            <p className="text-[11px] text-gray-400">
              Criado em {formatDateBR(editing.createdAt)} · nesta etapa desde {formatDateBR(editing.stageChangedAt)}
            </p>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex items-center justify-between gap-2 pt-1">
            {editing ? (
              <button
                onClick={() => setConfirmDelete(editing)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 size={13} /> Excluir
              </button>
            ) : <span />}
            <div className="flex gap-2">
              {editing?.email && (
                <a href={`mailto:${editing.email}`} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors" title="Enviar e-mail">
                  <Mail size={15} />
                </a>
              )}
              {editing?.phone && (
                <a
                  href={`https://wa.me/${editing.phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
                  title="Abrir no WhatsApp"
                >
                  <Phone size={15} />
                </a>
              )}
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold text-white bg-accent hover:bg-accent-dark rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 size={13} className="inline animate-spin" /> : editing ? "Salvar" : "Criar lead"}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && remove(confirmDelete)}
        title="Excluir lead"
        message={`Excluir "${confirmDelete?.name}" do pipeline? Essa ação não pode ser desfeita.`}
      />
    </div>
  );
}
