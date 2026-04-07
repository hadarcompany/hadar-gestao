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
  Shield,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Users2,
} from "lucide-react";
import { useState, useMemo } from "react";
import { Logo } from "@/components/logo";

const allNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permKey: "dashboard" },
  { href: "/tarefas", label: "Tarefas", icon: CheckSquare, permKey: "tarefas" },
  { href: "/meu-trabalho", label: "Meu Trabalho", icon: Briefcase, permKey: "meu-trabalho" },
  { href: "/calendario", label: "Calendario", icon: Calendar, permKey: "calendario" },
  { href: "/clientes", label: "Clientes", icon: Users, permKey: "clientes" },
  { href: "/servicos", label: "Servicos", icon: Wrench, permKey: "servicos" },
  { href: "/nps", label: "NPS", icon: Star, permKey: "nps" },
  { href: "/financeiro", label: "Financeiro", icon: DollarSign, permKey: "financeiro" },
  { href: "/minha-semana", label: "Minha Semana", icon: CalendarDays, permKey: "minha-semana" },
  { href: "/metas", label: "Metas", icon: Target, permKey: "metas" },
  { href: "/acessos", label: "Acessos", icon: Shield, permKey: "acessos" },
  { href: "/equipe", label: "Equipe", icon: Users2, permKey: "_admin" },
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

export function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const navItems = useMemo(() => {
    const isAdmin = user?.role === "ADMIN";
    if (isAdmin) return allNavItems;

    const perms = (user?.permissions as Record<string, string>) || DEFAULT_PERMISSIONS;

    return allNavItems.filter((item) => {
      if (item.permKey === "_admin") return false;
      const level = perms[item.permKey] || "none";
      return level !== "none";
    });
  }, [user]);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-sidebar border-r border-white/5 flex flex-col transition-all duration-300 z-50",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-white/5">
        {!collapsed && (
          <Logo width={110} height={33} className="text-amber-500" />
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md hover:bg-sidebar-hover text-white/40 hover:text-white/70 transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150",
                isActive
                  ? "bg-accent/10 text-accent-light font-medium"
                  : "text-white/50 hover:text-white/80 hover:bg-sidebar-hover"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon
                size={18}
                className={cn(
                  "shrink-0",
                  isActive ? "text-accent-light" : ""
                )}
              />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-white/5 p-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent-light text-xs font-bold shrink-0">
            {user?.name?.[0] ?? "?"}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white/80 truncate">
                {user?.name}
              </p>
              <p className="text-xs text-white/30 truncate">
                {user?.role === "ADMIN" ? "Admin" : "Membro"}
              </p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={signOut}
              className="p-1.5 rounded-md hover:bg-sidebar-hover text-white/30 hover:text-red-400 transition-colors"
              title="Sair"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
