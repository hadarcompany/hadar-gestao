"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";
import { PageHeader } from "@/components/page-header";
import { SelectField } from "@/components/ui/select-field";
import { Avatar } from "@/components/ui/avatar";
import { Loader2, Shield, Users, Save } from "lucide-react";
import { useRouter } from "next/navigation";

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  image: string | null;
  permissions: Record<string, string> | null;
}

const MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "tarefas", label: "Tarefas" },
  { key: "meu-trabalho", label: "Meu Trabalho" },
  { key: "calendario", label: "Calendário" },
  { key: "clientes", label: "Clientes" },
  { key: "servicos", label: "Serviços" },
  { key: "nps", label: "NPS" },
  { key: "financeiro", label: "Financeiro" },
  { key: "minha-semana", label: "Minha Semana" },
  { key: "metas", label: "Metas" },
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
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Shield size={14} /> Apenas administradores
        </div>
      </PageHeader>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-accent-dark" />
        </div>
      ) : (
        <div className="space-y-6">
          {users.map((user) => {
            const isAdmin = user.role === "ADMIN";
            const perms = editPerms[user.id] || {};

            return (
              <div key={user.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {/* User header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-200">
                  <div className="flex items-center gap-4">
                    <Avatar name={user.name} image={user.image} size={40} className="text-sm" />
                    <div>
                      <h3 className="text-sm font-medium text-gray-700">{user.name}</h3>
                      <p className="text-xs text-gray-400">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full ${
                      isAdmin ? "bg-accent-dark/20 text-accent" : "bg-gray-100 text-gray-500"
                    }`}>
                      {isAdmin ? "Admin" : "Membro"}
                    </span>
                    {!isAdmin && (
                      <button onClick={() => savePermissions(user.id)} disabled={saving === user.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent hover:bg-accent-dark disabled:opacity-50 text-white rounded-lg transition-colors">
                        {saving === user.id ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        Salvar
                      </button>
                    )}
                  </div>
                </div>

                {/* Permissions grid */}
                <div className="p-5">
                  {isAdmin ? (
                    <p className="text-xs text-gray-400 text-center py-2">
                      Administradores tem acesso total a todos os modulos.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {MODULES.map((mod) => (
                        <div key={mod.key} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <span className="text-xs text-gray-600 font-medium flex-1">{mod.label}</span>
                          <select
                            value={perms[mod.key] || "none"}
                            onChange={(e) => updatePerm(user.id, mod.key, e.target.value)}
                            className="bg-gray-100 border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-700 outline-none focus:border-accent-dark/50"
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
