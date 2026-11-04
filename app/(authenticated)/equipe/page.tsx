"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { MODULE_KEYS } from "@/lib/permissions";
import { Loader2, Shield, Save, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";

interface UserData {
  id: string; name: string; email: string; role: string;
  image: string | null; permissions: Record<string, string> | null;
}

const LABELS: Record<string, string> = {
  dashboard: "Dashboard", tarefas: "Tarefas", "meu-trabalho": "Meu Trabalho",
  calendario: "Calendário", publicacoes: "Publicações", pipeline: "Pipeline",
  "meta-ads": "Meta Ads", clientes: "Clientes", servicos: "Serviços", nps: "NPS",
  financeiro: "Financeiro", "minha-semana": "Minha Semana", metas: "Metas",
};
const MODULES = MODULE_KEYS.map(key => ({ key, label: LABELS[key] ?? key }));
const PERMISSION_OPTIONS = [
  { value: "none", label: "Sem acesso" },
  { value: "view", label: "Apenas visualizar" },
  { value: "edit", label: "Visualizar e editar" },
];
const newPermissions = () => Object.fromEntries(MODULE_KEYS.map(key => [key, ["tarefas", "meu-trabalho"].includes(key) ? "edit" : "none"]));
const emptyForm = () => ({ name: "", email: "", password: "", confirmation: "", permissions: newPermissions() });
function getUserPermissions(user: UserData): Record<string, string> {
  return Object.fromEntries(MODULE_KEYS.map(key => [key, user.role === "ADMIN" ? "edit" : user.permissions?.[key] ?? "none"]));
}

function PermissionsGrid({ values, onChange, prefix }: { values: Record<string, string>; onChange: (key: string, value: string) => void; prefix: string }) {
  return <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
    {MODULES.map(mod => <div key={mod.key} className="flex flex-wrap items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
      <label htmlFor={`${prefix}-${mod.key}`} className="text-sm text-gray-600 font-medium flex-1">{mod.label}</label>
      <select id={`${prefix}-${mod.key}`} value={values[mod.key] ?? "none"} onChange={event => onChange(mod.key, event.target.value)}
        className="min-h-10 max-w-full bg-gray-100 border border-gray-200 rounded-lg px-2 py-1 text-sm text-gray-700 outline-none focus:border-accent-dark/50 focus:ring-1 focus:ring-accent-dark/20">
        {PERMISSION_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>)}
  </div>;
}

export default function EquipePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editPerms, setEditPerms] = useState<Record<string, Record<string, string>>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => { if (user && user.role !== "ADMIN") router.push("/dashboard"); }, [user, router]);
  const fetchUsers = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/users", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data)) throw new Error(data.error || "Não foi possível carregar a equipe.");
      setUsers(data);
      setEditPerms(Object.fromEntries(data.map((member: UserData) => [member.id, getUserPermissions(member)])));
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível carregar a equipe."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (user?.role === "ADMIN") fetchUsers(); }, [fetchUsers, user?.role]);

  async function savePermissions(member: UserData) {
    setSaving(member.id); setError(""); setSuccess("");
    try {
      const response = await fetch(`/api/users/${member.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ permissions: editPerms[member.id] }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar as permissões.");
      setUsers(current => current.map(item => item.id === member.id ? data : item));
      setEditPerms(current => ({ ...current, [member.id]: getUserPermissions(data) }));
      setSuccess(`Permissões de ${member.name} salvas.`);
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível salvar as permissões."); }
    finally { setSaving(null); }
  }

  async function createUser(event: React.FormEvent) {
    event.preventDefault(); setCreateError(""); setSuccess("");
    if (form.password !== form.confirmation) { setCreateError("As senhas não coincidem. Confira os dois campos."); return; }
    setCreating(true);
    try {
      const response = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name, email: form.email, password: form.password, permissions: form.permissions }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível cadastrar o usuário.");
      setUsers(current => [...current.filter(item => item.id !== data.id), data].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
      setEditPerms(current => ({ ...current, [data.id]: getUserPermissions(data) }));
      setSuccess(`${data.name} cadastrado. Compartilhe o endereço do Gestão, o e-mail e a senha inicial com essa pessoa.`);
      setForm(emptyForm()); setShowCreate(false);
    } catch (err) { setCreateError(err instanceof Error ? err.message : "Não foi possível cadastrar o usuário. Atualize a lista antes de tentar novamente."); }
    finally { setCreating(false); }
  }

  if (user?.role !== "ADMIN") return null;
  return <div className="min-w-0 space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div><h2 className="text-2xl font-bold text-gray-900">Equipe</h2><p className="text-sm text-gray-500 mt-1">Gerenciamento de membros e permissões.</p></div>
      <div className="flex flex-wrap items-center gap-3"><span className="flex items-center gap-2 text-xs text-gray-500"><Shield size={14} /> Apenas administradores</span>
        <button type="button" disabled={showCreate} onClick={() => { setForm(emptyForm()); setCreateError(""); setSuccess(""); setShowCreate(true); }} className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-accent hover:bg-accent-dark text-white rounded-xl disabled:opacity-50"><UserPlus size={16} /> Novo usuário</button>
      </div>
    </div>
    {success && <p role="status" className="text-sm text-emerald-700">{success}</p>}
    {error && <p role="alert" className="text-sm text-red-600">{error} <button type="button" className="underline" onClick={fetchUsers}>Atualizar lista</button></p>}
    {showCreate && <form onSubmit={createUser} className="bg-white border border-gray-200 rounded-xl p-5 space-y-5" aria-label="Cadastrar novo usuário">
      <div><h3 className="font-semibold text-gray-900">Novo usuário</h3><p className="mt-1 text-sm text-gray-500">A conta será de membro da equipe. Escolha o acesso de cada área e compartilhe a senha inicial após o cadastro.</p></div>
      <fieldset disabled={creating} className="space-y-5">
        <legend className="sr-only">Dados e permissões do novo usuário</legend>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Input label="Nome" aria-label="Nome do novo usuário" autoComplete="off" autoFocus required maxLength={120} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
          <Input label="E-mail" aria-label="E-mail do novo usuário" autoComplete="off" type="email" required maxLength={254} value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} />
          <Input label="Senha inicial" aria-label="Senha inicial do novo usuário" autoComplete="new-password" type="password" required minLength={12} maxLength={72} value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} />
          <Input label="Confirmar senha inicial" aria-label="Confirmar senha inicial do novo usuário" autoComplete="new-password" type="password" required minLength={12} maxLength={72} value={form.confirmation} onChange={event => setForm({ ...form, confirmation: event.target.value })} />
        </div>
        <p className="text-xs text-gray-500">Use uma senha de pelo menos 12 caracteres. Nenhum convite será enviado por e-mail.</p>
        <fieldset className="space-y-3"><legend className="text-sm font-semibold text-gray-700 mb-3">Permissões do novo usuário</legend><PermissionsGrid prefix="new-member" values={form.permissions} onChange={(key, value) => setForm(current => ({ ...current, permissions: { ...current.permissions, [key]: value } }))} /></fieldset>
      </fieldset>
      {createError && <p role="alert" className="text-sm text-red-600">{createError}</p>}
      <div className="flex flex-wrap justify-end gap-3 border-t border-gray-200 pt-4">
        <button type="button" disabled={creating} onClick={() => { setShowCreate(false); setForm(emptyForm()); setCreateError(""); }} className="px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50">Cancelar</button>
        <button type="submit" disabled={creating} className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-accent hover:bg-accent-dark text-white rounded-xl disabled:opacity-50">{creating && <Loader2 size={16} className="animate-spin" />}{creating ? "Cadastrando..." : "Cadastrar usuário"}</button>
      </div>
    </form>}
    {loading ? <div className="flex items-center justify-center py-20" role="status" aria-label="Carregando equipe"><Loader2 size={24} className="animate-spin text-accent-dark" /></div> : <div className="space-y-6">
      {!users.length && !error && <p className="text-sm text-gray-500">Nenhum membro cadastrado. Use “Novo usuário” para adicionar a equipe.</p>}
      {users.map(member => <div key={member.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-b border-gray-200">
          <div className="flex items-center gap-4 min-w-0"><Avatar name={member.name} image={member.image} size={40} className="text-sm shrink-0" /><div className="min-w-0"><h3 className="text-sm font-medium text-gray-700 break-words">{member.name}</h3><p className="text-xs text-gray-500 break-all">{member.email}</p></div></div>
          <div className="flex items-center gap-3"><span className={`text-xs px-2.5 py-1 rounded-full ${member.role === "ADMIN" ? "bg-accent-dark/20 text-accent" : "bg-gray-100 text-gray-500"}`}>{member.role === "ADMIN" ? "Admin" : "Membro"}</span>
            {member.role !== "ADMIN" && <button type="button" onClick={() => savePermissions(member)} disabled={saving === member.id} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-accent hover:bg-accent-dark disabled:opacity-50 text-white rounded-lg">{saving === member.id ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Salvar permissões</button>}
          </div>
        </div>
        <div className="p-5">{member.role === "ADMIN" ? <p className="text-xs text-gray-500 text-center py-2">Administradores têm acesso total a todos os módulos.</p> : <PermissionsGrid prefix={`member-${member.id}`} values={editPerms[member.id] ?? {}} onChange={(key, value) => { setSuccess(""); setEditPerms(current => ({ ...current, [member.id]: { ...current[member.id], [key]: value } })); }} />}</div>
      </div>)}
    </div>}
  </div>;
}
