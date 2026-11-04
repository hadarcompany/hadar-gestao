"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Users2, UserCircle, Plug } from "lucide-react";
import { cn } from "@/lib/utils";
import EquipePage from "@/app/(authenticated)/equipe/page";
import { MeuPerfilPanel } from "@/components/settings/meu-perfil-panel";
import { IntegrationsPanel } from "@/components/settings/integrations-panel";

type Tab = "perfil" | "equipe" | "integracoes";

export default function ConfiguracoesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [tab, setTab] = useState<Tab>("perfil");

  useEffect(() => {
    const selected = new URLSearchParams(window.location.search).get("tab");
    if (selected === "integracoes" || selected === "equipe" || selected === "perfil") setTab(selected);
  }, []);

  const tabs: { key: Tab; label: string; icon: typeof UserCircle; adminOnly?: boolean }[] = [
    { key: "perfil", label: "Meu Perfil", icon: UserCircle },
    { key: "equipe", label: "Equipe", icon: Users2, adminOnly: true },
    { key: "integracoes", label: "Integrações", icon: Plug, adminOnly: true },
  ];

  return (
    <div className="min-h-screen bg-transparent w-full min-w-0 pb-10">
      <h1 className="text-xl font-bold text-gray-900 tracking-tight mb-5">Configurações</h1>

      <div className="flex flex-col md:flex-row gap-6">
        <nav className="flex md:block w-full md:w-52 shrink-0 gap-1 md:space-y-1 overflow-x-auto" aria-label="Configurações">
          {tabs.filter((t) => !t.adminOnly || isAdmin).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "w-auto md:w-full shrink-0 flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
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
          {tab === "integracoes" && isAdmin && <IntegrationsPanel />}
        </div>
      </div>
    </div>
  );
}
