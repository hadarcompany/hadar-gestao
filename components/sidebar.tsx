"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CheckSquare,
  Briefcase,
  Calendar,
  Users,
  Wrench,
  Star,
  DollarSign,
  CalendarDays,
  Target,
  Filter,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { Logo } from "@/components/logo";
import { Avatar } from "@/components/ui/avatar";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  permKey?: string;
}

interface NavCategory {
  id: string;
  label: string;
  items: NavItem[];
}

const NAV_CATEGORIES: NavCategory[] = [
  {
    id: "inicio",
    label: "Início",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permKey: "dashboard" }],
  },
  {
    id: "operacao",
    label: "Operação",
    items: [
      { href: "/tarefas", label: "Tarefas", icon: CheckSquare, permKey: "tarefas" },
      { href: "/meu-trabalho", label: "Meu Trabalho", icon: Briefcase, permKey: "meu-trabalho" },
      { href: "/calendario", label: "Calendário", icon: Calendar, permKey: "calendario" },
      { href: "/minha-semana", label: "Minha Semana", icon: CalendarDays, permKey: "minha-semana" },
    ],
  },
  {
    id: "clientes",
    label: "Clientes",
    items: [
      { href: "/pipeline", label: "Pipeline", icon: Filter, permKey: "pipeline" },
      { href: "/clientes", label: "Clientes", icon: Users, permKey: "clientes" },
      { href: "/servicos", label: "Serviços", icon: Wrench, permKey: "servicos" },
      { href: "/nps", label: "NPS", icon: Star, permKey: "nps" },
    ],
  },
  {
    id: "gestao",
    label: "Gestão",
    items: [
      { href: "/financeiro", label: "Financeiro", icon: DollarSign, permKey: "financeiro" },
      { href: "/metas", label: "Metas", icon: Target, permKey: "metas" },
    ],
  },
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
  pipeline: "none",
};

export function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  const visibleCategories = useMemo(() => {
    const isAdmin = user?.role === "ADMIN";
    const perms = (user?.permissions as Record<string, string>) || DEFAULT_PERMISSIONS;

    return NAV_CATEGORIES.map((cat) => ({
      ...cat,
      items: cat.items.filter((item) => {
        if (isAdmin) return true;
        if (!item.permKey) return true;
        const level = perms[item.permKey] || "none";
        return level !== "none";
      }),
    })).filter((cat) => cat.items.length > 0);
  }, [user]);

  const activeCategoryId = useMemo(() => {
    for (const cat of visibleCategories) {
      if (cat.items.some((item) => pathname === item.href || pathname?.startsWith(item.href + "/"))) return cat.id;
    }
    return null;
  }, [pathname, visibleCategories]);

  useEffect(() => {
    if (activeCategoryId) setOpenCategories((prev) => ({ ...prev, [activeCategoryId]: true }));
  }, [activeCategoryId]);

  function toggleCategory(id: string) {
    setOpenCategories((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const isConfigActive = pathname === "/configuracoes" || pathname?.startsWith("/configuracoes/");

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-sidebar border-r border-gray-200 flex flex-col transition-all duration-300 z-50",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
        {!collapsed && <Logo width={110} height={33} className="text-accent-dark" />}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md hover:bg-sidebar-hover text-gray-500 hover:text-gray-600 transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {visibleCategories.map((cat) => {
          const isOpen = collapsed || (openCategories[cat.id] ?? false);
          const isCatActive = activeCategoryId === cat.id;
          return (
            <div key={cat.id}>
              {!collapsed && (
                <button
                  onClick={() => toggleCategory(cat.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-colors",
                    isCatActive ? "text-accent-dark" : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  {cat.label}
                  <ChevronDown size={13} className={cn("transition-transform", isOpen && "rotate-180")} />
                </button>
              )}
              {isOpen && (
                <div className="space-y-0.5 mt-0.5">
                  {cat.items.map((item) => {
                    const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150",
                          isActive ? "bg-sidebar-active text-accent-dark font-medium" : "text-gray-500 hover:text-gray-900 hover:bg-sidebar-hover"
                        )}
                        title={collapsed ? item.label : undefined}
                      >
                        <item.icon size={18} className={cn("shrink-0", isActive ? "text-accent-dark" : "text-gray-400")} />
                        {!collapsed && <span>{item.label}</span>}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Configurações — entrada única, sem subitens */}
        <div className="pt-2">
          <Link
            href="/configuracoes"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150",
              isConfigActive ? "bg-sidebar-active text-accent-dark font-medium" : "text-gray-500 hover:text-gray-900 hover:bg-sidebar-hover"
            )}
            title={collapsed ? "Configurações" : undefined}
          >
            <Settings size={18} className={cn("shrink-0", isConfigActive ? "text-accent-dark" : "text-gray-400")} />
            {!collapsed && <span>Configurações</span>}
          </Link>
        </div>
      </nav>

      {/* User section */}
      <div className="border-t border-gray-200 p-3">
        <div className="flex items-center gap-3">
          <Avatar name={user?.name} image={user?.image} size={32} className="text-xs" />
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-700 truncate">{user?.name}</p>
              <p className="text-xs text-gray-400 truncate">{user?.role === "ADMIN" ? "Admin" : "Membro"}</p>
            </div>
          )}
          {!collapsed && (
            <button onClick={signOut} className="p-1.5 rounded-md hover:bg-sidebar-hover text-gray-400 hover:text-red-600 transition-colors" title="Sair">
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
