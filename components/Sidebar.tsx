"use client";
/**
 * Navegação lateral minimalista e focada em produtividade.
 * Estrutura: Home -> Tarefas -> Artes Extras -> Apresentação -> (Admin) -> [Separador] -> Calendário.
 */

import {
  Calendar,
  CalendarDays,
  MonitorPlay,
  Shield,
  ChevronLeft,
  ChevronRight,
  Users,
  ImagePlus,
  CheckSquare,
  Plus,
  Code2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Client, SafeUser } from "@/lib/types";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  activeScreen: string;
  activeViewMode?: "calendar" | "extras" | "kanban" | "list";
  onNavigate: (screen: string, viewMode?: "calendar" | "extras" | "kanban" | "list") => void;
  currentUser: SafeUser;
  clients: Client[];
  activeClient: Client | null;
  onSelectClient?: (client: Client) => void;
  isPinned: boolean;
  onTogglePin: () => void;
  onLogout?: () => void;
  theme?: "light" | "dark";
  onToggleTheme?: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  hasTopHeader?: boolean;
  onOpenCreateDemand?: () => void;
  onOpenDeveloperSettings?: () => void;
}

export function Sidebar({
  activeScreen,
  activeViewMode = "calendar",
  onNavigate,
  currentUser,
  clients,
  activeClient,
  isPinned,
  onTogglePin,
  mobileOpen,
  onCloseMobile,
  hasTopHeader = false,
  onOpenCreateDemand,
  onOpenDeveloperSettings,
}: SidebarProps) {
  /** Navega e fecha o menu mobile automaticamente. */
  const handleMobileNavigate = (
    screen: string,
    viewMode?: "calendar" | "extras" | "kanban" | "list"
  ) => {
    onNavigate(screen, viewMode);
    onCloseMobile();
  };

  /**
   * Recolhe a barra ao clicar em área neutra; preserva cliques em botões interativos.
   */
  const handleSidebarClick = (e: React.MouseEvent<HTMLElement>) => {
    if (!isPinned) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, select, textarea, [data-prevent-collapse]")) {
      return;
    }
    onTogglePin();
  };

  const hasClient = Boolean(activeClient || clients.length > 0);

  // Lista linear: Início (Home) -> Tarefas -> Clientes -> Demandas Extras -> Apresentação -> (Admin)
  const primaryNavItems = [
    {
      id: "home",
      label: "Início",
      icon: Users,
      isActive: activeScreen === "home",
      onClick: () => handleMobileNavigate("home"),
    },
    {
      id: "tasks",
      label: "Tarefas",
      icon: CheckSquare,
      isActive: activeScreen === "tasks",
      onClick: () => handleMobileNavigate("tasks"),
    },
    {
      id: "clients",
      label: "Controle de Clientes",
      icon: Users,
      isActive: activeScreen === "clients",
      onClick: () => handleMobileNavigate("clients"),
    },
    {
      id: "extras",
      label: "Demandas Extras",
      icon: ImagePlus,
      isActive: activeScreen === "planner" && activeViewMode === "extras",
      onClick: () => {
        if (!hasClient) {
          handleMobileNavigate("home");
        } else {
          handleMobileNavigate("planner", "extras");
        }
      },
    },
    {
      id: "presentations",
      label: "Apresentações",
      icon: MonitorPlay,
      isActive: activeScreen === "presentations" || activeScreen === "presentation",
      onClick: () => handleMobileNavigate("presentations"),
    },
    ...(currentUser.role === "admin"
      ? [
          {
            id: "admin_users",
            label: "Gestão de Usuários",
            icon: Shield,
            isActive: activeScreen === "admin_users",
            onClick: () => handleMobileNavigate("admin_users"),
          },
        ]
      : []),
  ];

  // O atalho do Calendário é o único que fica abaixo de todos com separador
  const calendarNavItem = {
    id: "calendar",
    label: "Calendário",
    icon: CalendarDays,
    isActive: activeScreen === "planner" && activeViewMode === "calendar",
    onClick: () => {
      if (!hasClient) {
        handleMobileNavigate("home");
      } else {
        handleMobileNavigate("planner", "calendar");
      }
    },
  };

  return (
    <aside
      className={cn(
        styles.sidebar,
        isPinned ? styles.open : styles.collapsed,
        mobileOpen && styles.mobileOpen
      )}
      aria-label="Navegação Principal"
      onClick={handleSidebarClick}
    >
      {/* UI: marca e logo quando não há cabeçalho fixado no topo */}
      {!hasTopHeader && (
        <div className={styles.brand}>
          <div className={styles.brandLogo}>
            <Calendar size={18} strokeWidth={2.2} />
          </div>
          {isPinned && (
            <div className={styles.brandText}>
              <span className={styles.brandTitle}>Calendário</span>
            </div>
          )}
        </div>
      )}

      {/* Navegação principal sem separadores intermediários */}
      <nav className={styles.navSection}>
        {primaryNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={cn(
                styles.navItem,
                item.isActive && styles.navItemActive,
                !isPinned && styles.navItemCollapsed
              )}
              onClick={item.onClick}
              title={item.label}
            >
              <Icon size={18} />
              {isPinned && <span>{item.label}</span>}
            </button>
          );
        })}

        {/* Botão de Nova Demanda para Administradores e Social Media */}
        {(currentUser.role === "admin" || currentUser.role === "social_media") && onOpenCreateDemand && (
          <button
            type="button"
            className={cn(
              styles.navItem,
              !isPinned && styles.navItemCollapsed
            )}
            onClick={() => {
              onOpenCreateDemand();
              onCloseMobile();
            }}
            title="Criar Nova Demanda"
            style={{
              color: "var(--primary, #0284c7)",
              fontWeight: 700,
            }}
          >
            <Plus size={18} />
            {isPinned && <span>+ Nova Demanda</span>}
          </button>
        )}

        {currentUser.role === "admin" && onOpenDeveloperSettings && (
          <button
            type="button"
            className={cn(styles.navItem, !isPinned && styles.navItemCollapsed)}
            onClick={() => {
              onOpenDeveloperSettings();
              onCloseMobile();
            }}
            title="Desenvolvedor"
          >
            <Code2 size={18} />
            {isPinned && <span>Desenvolvedor</span>}
          </button>
        )}

        {/* Separador único: o atalho do calendário fica destacado abaixo de todos */}
        <div className={styles.navDivider} />

        <button
          type="button"
          className={cn(
            styles.navItem,
            calendarNavItem.isActive && styles.navItemActive,
            !isPinned && styles.navItemCollapsed
          )}
          onClick={calendarNavItem.onClick}
          title={calendarNavItem.label}
        >
          <calendarNavItem.icon size={18} />
          {isPinned && <span>{calendarNavItem.label}</span>}
        </button>
      </nav>

      {/* Controle de expansão/recolhimento da barra lateral */}
      <div className={styles.bottomSection}>
        <button
          type="button"
          className={styles.collapseBtn}
          onClick={onTogglePin}
          title={isPinned ? "Recolher barra lateral" : "Expandir barra lateral"}
        >
          {isPinned ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          {isPinned && <span className={styles.collapseLabel}>Recolher</span>}
        </button>
      </div>
    </aside>
  );
}
