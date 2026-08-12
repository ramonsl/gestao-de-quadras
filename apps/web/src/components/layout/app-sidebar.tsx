"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  Package,
  ShoppingCart,
  Calendar,
  CalendarDays,
  Wrench,
  Clock,
  GraduationCap,
  ShieldCheck,
  MessageSquare,
  Megaphone,
  Building2,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import type { WhatsAppConnectionStatus } from "@gestao-de-quadras/messaging";
import { WhatsAppStatusBadge } from "@/components/whatsapp/whatsapp-status-badge";

const LOCAL_STORAGE_KEY = "arena_sidebar_collapsed";

export interface AppSidebarProps {
  session: {
    username: string;
    role: string;
    tenantSlug: string;
    modulesAllowed: string[];
    isAdmin: boolean;
  };
  initialWhatsAppStatus: WhatsAppConnectionStatus;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

export function AppSidebar({ session, initialWhatsAppStatus }: AppSidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved === "true") {
      setIsCollapsed(true);
    }
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(LOCAL_STORAGE_KEY, String(next));
      return next;
    });
  };

  const isAdmin = session.isAdmin;
  const modules = session.modulesAllowed ?? [];
  const canAccess = (moduleName: string) => isAdmin || modules.includes(moduleName);

  const operacaoItems: NavItem[] = [
    ...(canAccess("crm")
      ? [{ href: "/customers", label: "Clientes", icon: Users }]
      : []),
    ...(canAccess("pdv")
      ? [
          { href: "/pdv", label: "PDV / Comandas", icon: ShoppingCart },
          { href: "/admin/produtos", label: "Produtos", icon: Package },
        ]
      : []),
    ...(canAccess("quadras")
      ? [
          { href: "/admin/quadras", label: "Quadras", icon: Calendar },
          { href: "/quadras/grade", label: "Grade de Locação", icon: CalendarDays },
          {
            href: "/admin/servicos-quadras",
            label: "Serviços de Quadra",
            icon: Wrench,
          },
          {
            href: "/admin/faixas-horarias",
            label: "Faixas Horárias",
            icon: Clock,
          },
          {
            href: "/admin/pacotes-aulas",
            label: "Pacotes de Aulas",
            icon: GraduationCap,
          },
        ]
      : []),
    ...(canAccess("publicidade")
      ? [
          {
            href: "/admin/publicidade/espacos",
            label: "Espaços Publicitários",
            icon: Megaphone,
          },
          {
            href: "/admin/publicidade/anunciantes",
            label: "Anunciantes",
            icon: Building2,
          },
        ]
      : []),
  ];

  const adminItems: NavItem[] = isAdmin
    ? [
        { href: "/usuarios", label: "Usuários & Permissões", icon: ShieldCheck },
        { href: "/whatsapp", label: "WhatsApp", icon: MessageSquare },
      ]
    : [];

  const renderLink = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = pathname === item.href;

    return (
      <Link
        key={item.href}
        href={item.href}
        title={isCollapsed ? item.label : undefined}
        className={`flex items-center gap-2.5 h-9 rounded-[var(--radius-control)] text-sm transition-all duration-[180ms] ${
          isCollapsed ? "justify-center px-0" : "px-2.5"
        } ${
          isActive
            ? "bg-[var(--sidebar-hover)] text-white font-medium border-l-2 border-[var(--accent-bright)]"
            : "text-white/80 hover:bg-[var(--sidebar-hover)] hover:text-white"
        }`}
      >
        <Icon className="w-4 h-4 shrink-0 opacity-90" />
        {!isCollapsed && <span className="truncate">{item.label}</span>}
      </Link>
    );
  };

  return (
    <aside
      className={`group shrink-0 flex flex-col text-white transition-[width] duration-300 ease-in-out select-none relative ${
        isCollapsed ? "w-[64px]" : "w-[216px]"
      }`}
      style={{ backgroundColor: "var(--sidebar-bg)" }}
    >
      {/* Header da Sidebar */}
      <div className="px-3 h-14 flex items-center justify-between border-b border-white/10">
        {!isCollapsed && (
          <div className="flex items-center gap-2.5 min-w-0 pr-1">
            <span
              className="inline-flex items-center justify-center w-7 h-7 rounded-[8px] font-bold text-sm shrink-0"
              style={{ backgroundColor: "var(--accent-bright)" }}
            >
              A
            </span>
            <span className="text-sm font-semibold truncate">
              {session.tenantSlug}
            </span>
          </div>
        )}

        {isCollapsed && (
          <span
            className="mx-auto inline-flex items-center justify-center w-7 h-7 rounded-[8px] font-bold text-sm shrink-0"
            style={{ backgroundColor: "var(--accent-bright)" }}
            title={session.tenantSlug}
          >
            A
          </span>
        )}

        <button
          type="button"
          onClick={toggleSidebar}
          title={isCollapsed ? "Expandir menu" : "Recolher menu"}
          className={`p-1.5 rounded-[var(--radius-control)] text-white/70 hover:text-white hover:bg-white/10 transition-colors ${
            isCollapsed ? "hidden group-hover:flex" : ""
          }`}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="w-4 h-4" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Indicador de Status do WhatsApp */}
      <div
        className={`py-2.5 border-b border-white/10 ${
          isCollapsed ? "px-0 text-center" : "px-4"
        }`}
      >
        <WhatsAppStatusBadge
          initialStatus={initialWhatsAppStatus}
          isAdmin={isAdmin}
          isCollapsed={isCollapsed}
        />
      </div>

      {/* Navegação Principal */}
      <nav className="flex-1 px-2 py-3 space-y-4 overflow-y-auto overflow-x-hidden">
        {operacaoItems.length > 0 && (
          <div>
            {!isCollapsed ? (
              <p className="px-2 pt-2 pb-1 text-[10px] font-bold tracking-[0.08em] text-white/40">
                CADASTROS & OPERAÇÃO
              </p>
            ) : (
              <div className="my-1.5 border-t border-white/10" />
            )}
            <div className="space-y-1">{operacaoItems.map(renderLink)}</div>
          </div>
        )}

        {adminItems.length > 0 && (
          <div>
            {!isCollapsed ? (
              <p className="px-2 pt-2 pb-1 text-[10px] font-bold tracking-[0.08em] text-white/40">
                CONFIGURAÇÃO
              </p>
            ) : (
              <div className="my-1.5 border-t border-white/10" />
            )}
            <div className="space-y-1">{adminItems.map(renderLink)}</div>
          </div>
        )}
      </nav>

      {/* Botão de Toggle visível ao passar o mouse ou no rodapé quando recolhido */}
      {isCollapsed && (
        <div className="px-2 py-2 border-t border-white/10 flex justify-center">
          <button
            type="button"
            onClick={toggleSidebar}
            title="Expandir menu"
            className="p-2 rounded-[var(--radius-control)] text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Rodapé do Usuário */}
      <div className="px-3 py-3 border-t border-white/10 text-xs text-white/60">
        {!isCollapsed ? (
          <div>
            <p className="truncate font-medium text-white/90">
              {session.username}
            </p>
            <p className="uppercase tracking-wide text-[10px] text-white/40">
              {session.role}
            </p>
          </div>
        ) : (
          <div
            className="flex justify-center"
            title={`${session.username} (${session.role})`}
          >
            <span className="w-7 h-7 rounded-full bg-white/15 text-white flex items-center justify-center font-semibold text-xs">
              {session.username.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}
