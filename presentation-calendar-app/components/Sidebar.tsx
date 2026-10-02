"use client";
/** Navegação lateral, seletor do cliente ativo e controles da sessão. */


import { useState, useRef, useEffect } from "react";
import {
  Calendar,
  CalendarDays,
  MonitorPlay,
  Shield,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
  Users,
  Moon,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Client, SafeUser } from "@/lib/types";
import styles from "./Sidebar.module.css";

/** Estado controlado pelo AppShell e ações permitidas à barra lateral. */
interface SidebarProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
  currentUser: SafeUser;
  clients: Client[];
  activeClient: Client | null;
  onSelectClient: (client: Client) => void;
  isPinned: boolean;
  onTogglePin: () => void;
  onLogout: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  hasTopHeader?: boolean;
}

/** Renderiza a barra expandida ou recolhida sem manter uma segunda seleção de cliente. */
export function Sidebar({
  activeScreen,
  onNavigate,
  currentUser,
  clients,
  activeClient,
  onSelectClient,
  isPinned,
  onTogglePin,
  onLogout,
  theme,
  onToggleTheme,
  mobileOpen,
  onCloseMobile,
  hasTopHeader = false,
}: SidebarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Enquanto o menu está aberto, um clique fora fecha a lista; o cleanup remove o listener.
  useEffect(() => {
    /** Fecha o seletor somente quando o alvo está fora de seu contêiner. */
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [dropdownOpen]);

  const navItems = [
    {
      id: "home",
      label: "Controle de Clientes",
      icon: Users,
    },
    {
      id: "planner",
      label: "Planejador",
      icon: CalendarDays,
      requiresClient: true,
    },
    {
      id: "presentation",
      label: "Apresentação",
      icon: MonitorPlay,
      requiresClient: true,
    },
  ];

  if (currentUser.role === "admin") {
    navItems.push({
      id: "admin_users",
      label: "Gestão de Usuários",
      icon: Shield,
      requiresClient: false,
    });
  }

  const clientInitials = activeClient
    ? activeClient.name.slice(0, 2).toUpperCase()
    : "CP";

  /**
   * Recolhe a barra ao clicar em área neutra; preserva controles interativos e,
   * se o seletor estiver aberto, o primeiro clique apenas fecha o menu.
   */
  const handleSidebarClick = (e: React.MouseEvent<HTMLElement>) => {
    // A barra já recolhida não reage a cliques em sua área vazia.
    if (!isPinned) return;

    const target = e.target as HTMLElement;

    // O seletor precisa receber o clique antes que a barra altere sua largura.
    if (dropdownRef.current && dropdownRef.current.contains(target)) {
      return;
    }

    // Botões e campos executam sua própria ação sem recolher a navegação.
    if (target.closest("button, a, input, select, textarea, [data-prevent-collapse]")) {
      return;
    }

    // Um clique neutro fecha primeiro o menu; outro clique poderá recolher a barra.
    if (dropdownOpen) {
      setDropdownOpen(false);
      return;
    }

    onTogglePin();
  };

  /** Navega e fecha o menu mobile automaticamente. */
  const handleMobileNavigate = (screen: string) => {
    onNavigate(screen);
    onCloseMobile();
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
      {/* UI: marca e nome do produto; exibido somente quando não há cabeçalho global no topo */}
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

      {/* UI: seletor do cliente; recolhido, o avatar volta ao catálogo. */}
      <div className={styles.clientSelectorSection} ref={dropdownRef}>
        {isPinned ? (
          <>
            {/* UI: cliente ativo abre uma lista das demais contas disponíveis. */}
            <button
              type="button"
              className={styles.clientCard}
              onClick={() => setDropdownOpen(!dropdownOpen)}
              title="Alternar cliente ativo"
            >
              <div
                className={styles.clientAvatar}
                style={{
                  background: activeClient?.logo_url ? "transparent" : (activeClient?.accent || "var(--tenant-primary)"),
                  padding: activeClient?.logo_url ? "0.2rem" : "0",
                }}
              >
                {activeClient?.logo_url ? (
                  <img src={activeClient.logo_url} alt={activeClient.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  clientInitials
                )}
              </div>
              <div className={styles.clientInfo}>
                <span className={styles.clientName}>
                  {activeClient ? activeClient.name : "Selecionar Cliente"}
                </span>
                <span className={styles.clientSegment}>
                  {activeClient?.segment || "Nenhum selecionado"}
                </span>
              </div>
              <ChevronDown size={14} className={styles.clientDropdownIcon} />
            </button>

            {dropdownOpen && (
              <div className={styles.clientDropdownMenu}>
                {clients.length === 0 ? (
                  <div
                    style={{
                      padding: "8px",
                      fontSize: "11px",
                      color: "#94a3b8",
                    }}
                  >
                    Nenhum cliente cadastrado
                  </div>
                ) : (
                  clients.map((client) => {
                    // Destaca o cliente atual sem remover os demais da lista.
                    const isSelected = activeClient?.id === client.id;
                    return (
                      <button
                        key={client.id}
                        type="button"
                        className={cn(
                          styles.clientDropdownItem,
                          isSelected && styles.clientDropdownItemActive
                        )}
                        onClick={() => {
                          onSelectClient(client);
                          setDropdownOpen(false);
                          onCloseMobile();
                        }}
                      >
                        <div
                          className={styles.clientAvatar}
                          style={{
                            width: "1.35rem",
                            height: "1.35rem",
                            fontSize: "0.625rem",
                            background: client.logo_url ? "transparent" : (client.accent || "#ef5d3d"),
                            padding: client.logo_url ? "0.1rem" : "0",
                          }}
                        >
                          {client.logo_url ? (
                            <img src={client.logo_url} alt={client.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                          ) : (
                            client.name.slice(0, 2).toUpperCase()
                          )}
                        </div>
                        <span>{client.name}</span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </>
        ) : (
          <button
            type="button"
            className={styles.clientCard}
            style={{ justifyContent: "center", padding: "0.4rem" }}
            onClick={() => handleMobileNavigate("home")}
            title={activeClient ? `Cliente: ${activeClient.name}` : "Selecionar Cliente"}
          >
            <div
              className={styles.clientAvatar}
              style={{
                background: activeClient?.logo_url ? "transparent" : (activeClient?.accent || "var(--tenant-primary)"),
                padding: activeClient?.logo_url ? "0.2rem" : "0",
              }}
            >
              {activeClient?.logo_url ? (
                <img src={activeClient.logo_url} alt={activeClient.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                clientInitials
              )}
            </div>
          </button>
        )}
      </div>

      {/* UI: rotas principais; editor e apresentação exigem um cliente ativo. */}
      <nav className={styles.navSection}>
        {isPinned && <span className={styles.navLabel}>Navegação</span>}

        {navItems.map((item) => {
          // O papel administrativo acrescenta sua rota antes desta renderização.
          const Icon = item.icon;
          const isActive = activeScreen === item.id;
          const disabled = item.requiresClient && !activeClient;

          return (
            <button
              key={item.id}
              type="button"
              className={cn(
                styles.navItem,
                isActive && styles.navItemActive,
                !isPinned && styles.navItemCollapsed
              )}
              onClick={() => {
                if (disabled) {
                  handleMobileNavigate("home");
                  return;
                }
                handleMobileNavigate(item.id);
              }}
              title={item.label}
            >
              <Icon />
              {isPinned && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* UI: controle de largura (expandir/recolher) para uma barra lateral limpa e minimalista. */}
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

