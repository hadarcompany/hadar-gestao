"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Users2, Shield, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import EquipePage from "@/app/(authenticated)/equipe/page";
import AcessosPage from "@/app/(authenticated)/acessos/page";
import { MeuPerfilPanel } from "@/components/settings/meu-perfil-panel";

type Tab = "perfil" | "equipe" | "acessos";

export default function ConfiguracoesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [tab, setTab] = useState<Tab>("perfil");

  const tabs: { key: Tab; label: string; icon: typeof UserCircle; adminOnly?: boolean }[] = [
    { key: "perfil", label: "Meu Perfil", icon: UserCircle },
    { key: "equipe", label: "Equipe", icon: Users2, adminOnly: true },
    { key: "acessos", label: "Acessos", icon: Shield, adminOnly: true },
  ];

  return (
    <div className="min-h-screen bg-transparent w-full pb-10">
      <h1 className="text-xl font-bold text-gray-900 tracking-tight mb-5">Configurações</h1>

      <div className="flex gap-6">
        <nav className="w-52 shrink-0 space-y-1">
          {tabs.filter((t) => !t.adminOnly || isAdmin).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left",
                tab === t.key ? "bg-accent/10 text-accent-dark" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <t.icon size={16} />
              {t.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 min-w-0">
          {tab === "perfil" && <MeuPerfilPanel />}
          {tab === "equipe" && isAdmin && <EquipePage />}
          {tab === "acessos" && isAdmin && <AcessosPage />}
        </div>
      </div>
    </div>
  );
}
