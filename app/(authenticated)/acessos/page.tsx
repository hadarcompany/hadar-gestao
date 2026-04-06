"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";
import { PageHeader } from "@/components/page-header";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Eye, EyeOff, Copy, Check, ExternalLink, Shield, Trash2, Loader2, Search,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface AccessData {
  id: string;
  platform: string;
  url: string | null;
  email: string | null;
  password: string | null;
  observations: string | null;
  clientId: string;
  client: { id: string; name: string };
}

export default function AcessosPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [accesses, setAccesses] = useState<AccessData[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [filterClient, setFilterClient] = useState("");

  // Visibility state per row
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteAccessId, setDeleteAccessId] = useState<string | null>(null);

  // Create form
  const [formPlatform, setFormPlatform] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formObs, setFormObs] = useState("");
  const [formClient, setFormClient] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  const fetchAccesses = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterClient) params.set("clientId", filterClient);
    try {
      const res = await fetch(`/api/accesses?${params}`);
      setAccesses(await res.json());
    } finally { setLoading(false); }
  }, [filterClient]);

  useEffect(() => {
    fetchAccesses();
    fetch("/api/clients").then((r) => r.json()).then((d) =>
      setClients(d.map((c: Record<string, string>) => ({ id: c.id, name: c.name })))
    );
  }, [fetchAccesses]);

  function togglePassword(id: string) {
    setVisiblePasswords((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function copyPassword(id: string, password: string) {
    await navigator.clipboard.writeText(password);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function deleteAccess(id: string) {
    await fetch(`/api/accesses/${id}`, { method: "DELETE" });
    fetchAccesses();
  }

  async function handleCreate() {
    if (!formPlatform.trim() || !formClient) return;
    setCreateLoading(true);
    try {
      await fetch("/api/accesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: formPlatform, url: formUrl || null, email: formEmail || null,
          password: formPassword || null, observations: formObs || null, clientId: formClient,
        }),
      });
      setFormPlatform(""); setFormUrl(""); setFormEmail(""); setFormPassword(""); setFormObs(""); setFormClient("");
      setShowCreate(false);
      fetchAccesses();
    } finally { setCreateLoading(false); }
  }

  const filtered = accesses.filter((a) =>
    a.platform.toLowerCase().includes(search.toLowerCase()) ||
    a.client.name.toLowerCase().includes(search.toLowerCase()) ||
    (a.email || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader title="Acessos" description="Credenciais e acessos das plataformas.">
        {isAdmin && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors"
          >
            <Plus size={16} />
            Novo Acesso
          </button>
        )}
      </PageHeader>

      {!isAdmin && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">
          <p className="text-xs text-amber-400 flex items-center gap-2">
            <Shield size={14} />
            Somente administradores podem ver/editar senhas.
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar plataforma, cliente..."
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/20 focus:outline-none focus:border-amber-500/50"
          />
        </div>
        <div className="w-48">
          <SelectField
            value={filterClient}
            onChange={setFilterClient}
            placeholder="Todos os clientes"
            options={clients.map((c) => ({ value: c.id, label: c.name }))}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-amber-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Shield size={32} className="text-white/10 mb-4" />
          <h3 className="text-sm font-medium text-white/50 mb-1">Nenhum acesso cadastrado</h3>
          <p className="text-xs text-white/25">Cadastre credenciais de plataformas aqui.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((access) => (
            <div key={access.id} className="bg-white/[0.03] border border-white/5 rounded-xl p-4 hover:border-white/10 transition-colors">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 text-xs font-bold shrink-0">
                  {access.platform.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-medium text-white/80">{access.platform}</h3>
                    <span className="text-[10px] text-white/20 bg-white/5 px-2 py-0.5 rounded">{access.client.name}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                    {access.url && (
                      <a href={access.url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-white/30 hover:text-amber-400 transition-colors truncate">
                        <ExternalLink size={10} /> {access.url}
                      </a>
                    )}
                    {access.email && (
                      <p className="text-xs text-white/40 truncate">📧 {access.email}</p>
                    )}
                    {isAdmin && access.password && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white/40 font-mono">
                          {visiblePasswords.has(access.id) ? access.password : "••••••••"}
                        </span>
                        <button
                          onClick={() => togglePassword(access.id)}
                          className="p-1 rounded hover:bg-white/5 text-white/20 hover:text-white/50 transition-colors"
                          title={visiblePasswords.has(access.id) ? "Ocultar" : "Exibir"}
                        >
                          {visiblePasswords.has(access.id) ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                        <button
                          onClick={() => copyPassword(access.id, access.password!)}
                          className="p-1 rounded hover:bg-white/5 text-white/20 hover:text-white/50 transition-colors"
                          title="Copiar"
                        >
                          {copiedId === access.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        </button>
                      </div>
                    )}
                  </div>
                  {access.observations && (
                    <p className="text-xs text-white/20 mt-2">{access.observations}</p>
                  )}
                </div>
                {isAdmin && (
                  <button
                    onClick={() => setDeleteAccessId(access.id)}
                    className="p-2 rounded-lg hover:bg-red-500/10 text-white/15 hover:text-red-400 transition-colors shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Access Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Novo Acesso" size="md">
        <div className="space-y-4">
          <SelectField
            label="Cliente"
            value={formClient}
            onChange={setFormClient}
            placeholder="Selecione..."
            options={clients.map((c) => ({ value: c.id, label: c.name }))}
          />
          <Input label="Plataforma" value={formPlatform} onChange={(e) => setFormPlatform(e.target.value)} placeholder="Ex: Instagram, Meta Ads..." />
          <Input label="Link" value={formUrl} onChange={(e) => setFormUrl(e.target.value)} placeholder="https://..." />
          <Input label="E-mail" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="email@plataforma.com" />
          <Input label="Senha" type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} placeholder="Senha de acesso" />
          <Textarea label="Observações" value={formObs} onChange={(e) => setFormObs(e.target.value)} placeholder="Notas adicionais..." />
          <div className="flex justify-end gap-3 pt-2 border-t border-white/5">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-white/50 bg-white/5 rounded-lg">Cancelar</button>
            <button
              onClick={handleCreate}
              disabled={createLoading || !formPlatform.trim() || !formClient}
              className="px-6 py-2 text-sm bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-medium rounded-lg"
            >
              {createLoading ? "Criando..." : "Criar Acesso"}
            </button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog
        open={!!deleteAccessId}
        title="Excluir Acesso"
        message="Tem certeza que deseja excluir este acesso? Esta ação é irreversível."
        confirmLabel="Sim, excluir"
        cancelLabel="Cancelar"
        onConfirm={() => { const id = deleteAccessId!; setDeleteAccessId(null); deleteAccess(id); }}
        onCancel={() => setDeleteAccessId(null)}
      />
    </div>
  );
}
