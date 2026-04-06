"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";
import { PageHeader } from "@/components/page-header";
import { SelectField } from "@/components/ui/select-field";
import { Loader2, Shield, Users, Save } from "lucide-react";
import { useRouter } from "next/navigation";

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: Record<string, string> | null;
}

const MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "tarefas", label: "Tarefas" },
  { key: "meu-trabalho", label: "Meu Trabalho" },
  { key: "calendario", label: "Calendario" },
  { key: "clientes", label: "Clientes" },
  { key: "servicos", label: "Servicos" },
  { key: "nps", label: "NPS" },
  { key: "financeiro", label: "Financeiro" },
  { key: "minha-semana", label: "Minha Semana" },
  { key: "metas", label: "Metas" },
  { key: "acessos", label: "Acessos" },
];

const PERMISSION_OPTIONS = [
  { value: "none", label: "Sem Acesso" },
  { value: "view", label: "Apenas Visualizar" },
  { value: "edit", label: "Visualizar e Editar" },
];

const DEFAULT_PERMISSIONS: Record<string, string> = {
  dashboard: "none",
  tarefas: "edit",
  "meu-trabalho": "edit",
  calendario: "none",
  clientes: "none",
  servicos: "none",
  nps: "none",
  financeiro: "none",
  "minha-semana": "none",
  metas: "none",
  acessos: "none",
};

function getUserPermissions(user: UserData): Record<string, string> {
  if (user.role === "ADMIN") {
    return Object.fromEntries(MODULES.map((m) => [m.key, "edit"]));
  }
  return (user.permissions as Record<string, string>) || { ...DEFAULT_PERMISSIONS };
}

export default function EquipePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editPerms, setEditPerms] = useState<Record<string, Record<string, string>>>({});

  // Redirect non-admins
  useEffect(() => {
    if (user && user.role !== "ADMIN") {
      router.push("/dashboard");
    }
  }, [user, router]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      setUsers(data);
      const perms: Record<string, Record<string, string>> = {};
      data.forEach((u: UserData) => {
        perms[u.id] = getUserPermissions(u);
      });
      setEditPerms(perms);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  function updatePerm(userId: string, moduleKey: string, value: string) {
    setEditPerms((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], [moduleKey]: value },
    }));
  }

  async function savePermissions(userId: string) {
    setSaving(userId);
    try {
      await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: editPerms[userId] }),
      });
      fetchUsers();
    } finally {
      setSaving(null);
    }
  }

  if (user?.role !== "ADMIN") return null;

  return (
    <div>
      <PageHeader title="Equipe" description="Gerenciamento de membros e permissoes.">
        <div className="flex items-center gap-2 text-xs text-white/40">
          <Shield size={14} /> Apenas administradores
        </div>
      </PageHeader>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-amber-500" />
        </div>
      ) : (
        <div className="space-y-6">
          {users.map((user) => {
            const isAdmin = user.role === "ADMIN";
            const perms = editPerms[user.id] || {};

            return (
              <div key={user.id} className="bg-white/[0.03] border border-white/5 rounded-xl overflow-hidden">
                {/* User header */}
                <div className="flex items-center justify-between p-5 border-b border-white/5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-sm">
                      {user.name[0]}
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-white/80">{user.name}</h3>
                      <p className="text-xs text-white/30">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full ${
                      isAdmin ? "bg-amber-500/20 text-amber-400" : "bg-white/5 text-white/40"
                    }`}>
                      {isAdmin ? "Admin" : "Membro"}
                    </span>
                    {!isAdmin && (
                      <button onClick={() => savePermissions(user.id)} disabled={saving === user.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg transition-colors">
                        {saving === user.id ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        Salvar
                      </button>
                    )}
                  </div>
                </div>

                {/* Permissions grid */}
                <div className="p-5">
                  {isAdmin ? (
                    <p className="text-xs text-white/30 text-center py-2">
                      Administradores tem acesso total a todos os modulos.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {MODULES.map((mod) => (
                        <div key={mod.key} className="flex items-center gap-3 bg-white/[0.02] border border-white/5 rounded-lg p-3">
                          <span className="text-xs text-white/60 font-medium flex-1">{mod.label}</span>
                          <select
                            value={perms[mod.key] || "none"}
                            onChange={(e) => updatePerm(user.id, mod.key, e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white/80 outline-none focus:border-amber-500/50"
                          >
                            {PERMISSION_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
