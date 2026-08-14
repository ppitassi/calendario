import {
  LayoutDashboard,
  Users,
  GalleryHorizontalEnd,
  MessageSquare,
  Shield,
  Compass,
  User,
  CalendarDays,
  Eye,
  Settings,
  Palette,
  ListTodo,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { ClientData, ROLE_PERMISSIONS, UserRole } from "../../types";
import { ClientSwitcher } from "../ClientSwitcher";
import styles from "./MainLayoutSidebar.module.css";
import type { ButtonHTMLAttributes } from "react";

function SidebarButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  // style-architecture-button-exception: sidebar destinations are feature-specific navigation rows.
  return <button type="button" {...props} />;
}

type MainLayoutSidebarProps = {
  activeScreen: string;
  onNavigate: (screen: string) => void;
  currentClient: any;
  isPinned: boolean;
  togglePin: () => void;
  isMobileOpen: boolean;
  userRole: string;
  user: any;
  clients: ClientData[];
  clientsLoading: boolean;
  clientsError: boolean;
  recentClientIds: string[];
  openClientSelector: boolean;
  onSelectClient: (client: ClientData) => void;
  onClientDestination: (client: ClientData, destination: any) => void;
};

export function MainLayoutSidebar({
  activeScreen,
  onNavigate,
  currentClient,
  isPinned,
  togglePin,
  isMobileOpen,
  userRole,
  user,
  clients,
  clientsLoading,
  clientsError,
  recentClientIds,
  openClientSelector,
  onSelectClient,
  onClientDestination,
}: MainLayoutSidebarProps) {
  const canViewProductionGallery =
    user?.permissions?.canViewProductionGallery ??
    ROLE_PERMISSIONS[userRole as UserRole]?.canViewProductionGallery ??
    false;

  const isOpen = isPinned;
  const navClass = (active: boolean) =>
    cn(
      styles.navItem,
      isOpen ? styles.navItemOpen : styles.navItemCollapsed,
      active && styles.navItemActive,
    );

  return (
    <aside
      id="app-sidebar"
      aria-label="Navegação principal"
      onPointerUp={(event) => {
        if (window.innerWidth < 768) return;
        const target = event.target as HTMLElement;
        if (
          target.closest(
            "button, a, input, select, textarea, summary, label, [role='dialog'], [role='menu']",
          )
        )
          return;
        togglePin();
      }}
      className={cn(
        styles.sidebar,
        isMobileOpen ? styles.mobileOpen : styles.mobileClosed,
        isOpen ? styles.open : styles.collapsed,
      )}
    >
      <div className={styles.groups}>
        {/* Global navigation */}
        <div className={styles.group}>
          {isOpen ? (
            <span className={styles.label}>
              Navegação Geral
            </span>
          ) : (
            <div className={styles.groupSeparator} />
          )}

          <SidebarButton
            onClick={() => onNavigate("home")}
            className={navClass(activeScreen === "home")}
            aria-label="Dashboard"
            data-sidebar-tooltip="Dashboard"
          >
            <LayoutDashboard />
            {isOpen && <span>Dashboard</span>}
          </SidebarButton>

          <SidebarButton
            onClick={() => onNavigate("client_management")}
            className={navClass(activeScreen === "client_management")}
            aria-label="Clientes"
            data-sidebar-tooltip="Clientes"
          >
            <Users />
            {isOpen && <span>Clientes</span>}
          </SidebarButton>

          <SidebarButton
            onClick={() => onNavigate("operations")}
            className={navClass(activeScreen === "operations")}
            aria-label="Operações"
            data-sidebar-tooltip="Operações"
          >
            <ListTodo />
            {isOpen && <span>Operações</span>}
          </SidebarButton>

          {canViewProductionGallery && (
            <SidebarButton
              onClick={() => onNavigate("production_gallery")}
              className={navClass(activeScreen === "production_gallery")}
              aria-label="Esteira Visual"
              data-sidebar-tooltip="Esteira Visual"
            >
              <GalleryHorizontalEnd />
              {isOpen && <span>Esteira Visual</span>}
            </SidebarButton>
          )}

          <SidebarButton
            onClick={() => onNavigate("leia_chat")}
            className={navClass(activeScreen === "leia_chat")}
            aria-label="Chat LeIA"
            data-sidebar-tooltip="Chat LeIA"
          >
            <MessageSquare />
            {isOpen && <span>Chat LeIA</span>}
          </SidebarButton>

          {(userRole === "admin" || userRole === "gerente") && (
            <SidebarButton
              onClick={() => onNavigate("admin_roles")}
              className={navClass(
                activeScreen === "admin_roles" || activeScreen === "users",
              )}
              aria-label="Equipe"
              data-sidebar-tooltip="Equipe"
            >
              <Shield />
              {isOpen && <span>Equipe</span>}
            </SidebarButton>
          )}

          {userRole === "admin" && (
            <SidebarButton
              onClick={() => onNavigate("agency_setup")}
              className={navClass(activeScreen === "agency_setup")}
              aria-label="Aparência do Sistema"
              data-sidebar-tooltip="Aparência do Sistema"
            >
              <Palette />
              {isOpen && <span>Aparência do Sistema</span>}
            </SidebarButton>
          )}

          {(userRole === "admin" ||
            userRole === "gerente" ||
            userRole === "designer" ||
            userRole === "analista") && (
            <SidebarButton
              onClick={() => onNavigate("client_strategy")}
              className={navClass(activeScreen === "client_strategy")}
              aria-label="Gestão Estratégica"
              data-sidebar-tooltip="Gestão Estratégica"
            >
              <Compass />
              {isOpen && <span>Gestão Estratégica</span>}
            </SidebarButton>
          )}

          <SidebarButton
            onClick={() => onNavigate("user_setup")}
            className={navClass(activeScreen === "user_setup")}
            aria-label="Meu Perfil"
            data-sidebar-tooltip="Meu Perfil"
          >
            <User />
            {isOpen && <span>Meu Perfil</span>}
          </SidebarButton>
        </div>

        {/* Contextual Client Navigation */}
        <div className={cn(styles.group, styles.contextGroup)}>
          {isOpen ? (
            <span className={styles.label}>
              Área do Cliente
            </span>
          ) : (
            <div className={styles.separator} />
          )}

          <ClientSwitcher
            clients={clients}
            currentClient={currentClient}
            recentClientIds={recentClientIds}
            loading={clientsLoading}
            error={clientsError}
            variant="sidebar"
            expanded={isOpen}
            initiallyOpen={openClientSelector}
            onSelect={onSelectClient}
            onDestination={onClientDestination}
          />

          {currentClient && (
            <>
              {[
                {
                  id: "planner",
                  label: "Planejador de Calendários",
                  icon: CalendarDays,
                },
                { id: "viewer", label: "Modo Apresentação", icon: Eye },
                {
                  id: "client_setup",
                  label: "Configurar Marca",
                  icon: Settings,
                },
              ].map((item) => (
                <SidebarButton
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={navClass(activeScreen === item.id)}
                  aria-label={item.label}
                  data-sidebar-tooltip={item.label}
                >
                  <item.icon />
                  {isOpen && <span>{item.label}</span>}
                </SidebarButton>
              ))}
            </>
          )}
        </div>
      </div>
      <SidebarButton
        type="button"
        onClick={togglePin}
        aria-expanded={isPinned}
        aria-controls="app-sidebar"
        aria-label={
          isPinned ? "Recolher barra lateral" : "Expandir barra lateral"
        }
        className={cn("sidebar-dock-keyboard sr-only focus:not-sr-only", styles.keyboardToggle)}
      >
        <span className="sr-only">
          {isPinned ? "Recolher barra lateral" : "Expandir barra lateral"}
        </span>
      </SidebarButton>
    </aside>
  );
}
