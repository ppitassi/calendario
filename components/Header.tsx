"use client";
/**
 * Cabeçalho superior global (Header):
 * - Nome do usuário logado
 * - Ícone de notificações com central de alertas
 * - Painel de opções de usuário (perfil, cargo e logout)
 * - Botão de modo noturno (Theme Toggle)
 * - Botão hamburger para abrir a sidebar no mobile
 */

import { useState, useRef, useEffect } from "react";
import {
  Bell,
  Sun,
  Moon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  Shield,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Calendar,
  Keyboard,
  Sliders,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { shiftMonth } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { SafeUser, Client } from "@/lib/types";
import styles from "./Header.module.css";

import { useNotifications } from "./hooks/useNotifications";

interface HeaderProps {
  currentUser: SafeUser;
  onLogout: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onOpenMobileMenu?: () => void;
  activeScreen?: string;
  activeClient?: Client | null;
  onNavigate?: (screen: string) => void;
  activeMonth?: Date;
  onMonthChange?: (month: Date) => void;
  onOpenSettings?: () => void;
}

export function Header({
  currentUser,
  onLogout,
  theme,
  onToggleTheme,
  onOpenMobileMenu,
  activeScreen,
  activeClient,
  onNavigate,
  activeMonth,
  onMonthChange,
  onOpenSettings,
}: HeaderProps) {
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const {
    notifications,
    unreadCount,
    markAllAsRead,
    clearAll,
  } = useNotifications();

  const userDropdownRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  // Fecha os menus dropdown ao clicar fora
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (userDropdownRef.current && !userDropdownRef.current.contains(target)) {
        setUserDropdownOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(target)) {
        setNotificationsOpen(false);
      }
    };

    if (userDropdownOpen || notificationsOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [userDropdownOpen, notificationsOpen]);

  // Iniciais do usuário logado
  const userInitials = currentUser?.name
    ? currentUser.name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0].toUpperCase())
        .join("")
    : "US";

  // Rótulo legível do papel
  const roleLabel =
    currentUser?.role === "admin"
      ? "Administrador"
      : currentUser?.role === "social_media"
      ? "Social Media"
      : "Designer";

  return (
    <header className={styles.header}>
      {/* Seção Esquerda: Hamburger mobile + Identidade da Marca + Breadcrumb */}
      <div className={styles.leftSection}>
        {onOpenMobileMenu && (
          <button
            type="button"
            className={styles.mobileMenuBtn}
            onClick={onOpenMobileMenu}
            title="Abrir menu lateral"
            aria-label="Abrir menu lateral"
          >
            <Menu size={18} />
          </button>
        )}

        <div
          className={cn(styles.brand, onNavigate && styles.brandClickable)}
          onClick={() => onNavigate && onNavigate("home")}
          role={onNavigate ? "button" : undefined}
          tabIndex={onNavigate ? 0 : undefined}
          title={onNavigate ? "Voltar ao Início" : undefined}
        >
          <div className={styles.brandLogo}>
            <Calendar size={18} strokeWidth={2.2} />
          </div>
          <div className={styles.brandText}>
            <span className={styles.brandTitle}>Calendário</span>
          </div>
        </div>

        <div className={styles.breadcrumb}>
          {activeClient && activeScreen === "planner" && (
            <span className={styles.clientBadge}>{activeClient.name}</span>
          )}
        </div>
      </div>

      {/* Seção Central: Navegador Mensal Centralizado */}
      {activeMonth && onMonthChange && (() => {
        const safeMonth = activeMonth instanceof Date && !isNaN(activeMonth.getTime()) ? activeMonth : new Date();
        return (
          <div className={styles.centerSection}>
            <div className={styles.monthSwitcher}>
              <button
                type="button"
                onClick={() => onMonthChange(shiftMonth(safeMonth, -1))}
                title="Mês anterior"
                aria-label="Mês anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <span className={styles.monthLabel}>
                {format(safeMonth, "MMMM 'de' yyyy", { locale: ptBR })}
              </span>
              <button
                type="button"
                onClick={() => onMonthChange(shiftMonth(safeMonth, 1))}
                title="Próximo mês"
                aria-label="Próximo mês"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        );
      })()}

      {/* Seção Direita: Notificações + Modo Noturno + Painel de Usuário */}
      <div className={styles.rightSection}>
        {/* 1. Botão de Notificações */}
        <div className={styles.dropdownWrapper} ref={notificationsRef}>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => {
              const next = !notificationsOpen;
              setNotificationsOpen(next);
              setUserDropdownOpen(false);
              if (next && unreadCount > 0) {
                markAllAsRead();
              }
            }}
            title={unreadCount > 0 ? `${unreadCount} nova(s) notificação(ões)` : "Notificações"}
            aria-label="Abrir notificações"
            aria-expanded={notificationsOpen}
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className={styles.notificationBadge}>{unreadCount}</span>
            )}
          </button>

          {notificationsOpen && (
            <div className={styles.dropdownMenu} style={{ width: 340, maxWidth: "90vw" }}>
              <div className={styles.dropdownHeader}>
                <span className={styles.dropdownTitle}>
                  Notificações {notifications.length > 0 ? `(${notifications.length})` : ""}
                </span>
                {notifications.length > 0 && (
                  <button
                    type="button"
                    className={styles.dropdownClearBtn}
                    onClick={() => clearAll()}
                    title="Limpar todas as notificações"
                  >
                    Limpar
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div className={styles.notificationEmpty}>
                  <CheckCircle2 size={24} color="#10b981" />
                  <p>Nenhuma notificação no momento.</p>
                </div>
              ) : (
                <div className={styles.menuItemList} style={{ padding: "0.5rem", maxHeight: 360, overflowY: "auto" }}>
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={styles.notificationItem}
                      style={{
                        background: n.is_read ? undefined : "rgba(227, 0, 47, 0.05)",
                        borderLeft: n.is_read ? "3px solid transparent" : "3px solid var(--tenant-primary, #e3002f)",
                        paddingLeft: "0.6rem",
                      }}
                    >
                      {n.type === "client_review" ? (
                        <CheckCircle2 size={16} color="#10b981" style={{ marginTop: 2, flexShrink: 0 }} />
                      ) : (
                        <Sparkles size={14} color="var(--tenant-primary, #e3002f)" style={{ marginTop: 2, flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: "0.75rem", color: "var(--ink, #0f172a)", marginBottom: 2 }}>
                          {n.title}
                        </div>
                        <div style={{ fontSize: "0.715rem", color: "var(--color-text-secondary, #475569)", lineHeight: 1.35 }}>
                          {n.message}
                        </div>
                        <div style={{ fontSize: "0.65rem", color: "var(--muted, #94a3b8)", marginTop: 4 }}>
                          {n.created_at ? format(new Date(n.created_at), "dd/MM 'às' HH:mm", { locale: ptBR }) : "Agora"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. Botão de Modo Noturno */}
        <button
          type="button"
          className={styles.actionBtn}
          onClick={onToggleTheme}
          title={theme === "dark" ? "Alternar para Modo Claro" : "Alternar para Modo Noturno"}
          aria-label="Alternar tema"
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* 3. Painel de Opções de Usuário com Nome Logado */}
        <div className={styles.dropdownWrapper} ref={userDropdownRef}>
          <button
            type="button"
            className={cn(styles.userTrigger, userDropdownOpen && styles.userTriggerActive)}
            onClick={() => {
              setUserDropdownOpen(!userDropdownOpen);
              setNotificationsOpen(false);
            }}
            title="Menu do usuário"
            aria-label="Opções de usuário"
            aria-expanded={userDropdownOpen}
          >
            <div className={styles.userAvatar}>
              {userInitials}
            </div>
            <span className={styles.userNameLabel}>{currentUser?.name || "Usuário"}</span>
            <ChevronDown
              size={14}
              className={cn(styles.userChevron, userDropdownOpen && styles.userChevronOpen)}
            />
          </button>

          {userDropdownOpen && (
            <div className={styles.dropdownMenu}>
              <div className={styles.userDropdownInfo}>
                <div className={styles.userAvatar} style={{ width: "2.25rem", height: "2.25rem", fontSize: "0.8125rem" }}>
                  {userInitials}
                </div>
                <div className={styles.userDropdownDetails}>
                  <strong className={styles.userDropdownName}>{currentUser?.name}</strong>
                  <span className={styles.userDropdownRole}>{roleLabel}</span>
                  {currentUser?.username && (
                    <span className={styles.userDropdownUsername}>@{currentUser.username}</span>
                  )}
                </div>
              </div>

              <div className={styles.menuItemList}>
                {onOpenSettings && (
                  <button
                    type="button"
                    className={styles.menuItemBtn}
                    onClick={() => {
                      setUserDropdownOpen(false);
                      onOpenSettings();
                    }}
                  >
                    <Keyboard size={15} />
                    <span>Atalhos & Configurações</span>
                  </button>
                )}

                <button
                  type="button"
                  className={styles.menuItemBtn}
                  onClick={() => {
                    onToggleTheme();
                    setUserDropdownOpen(false);
                  }}
                >
                  {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
                  <span>{theme === "dark" ? "Usar Modo Claro" : "Usar Modo Noturno"}</span>
                </button>

                <button
                  type="button"
                  className={cn(styles.menuItemBtn, styles.menuItemDanger)}
                  onClick={() => {
                    setUserDropdownOpen(false);
                    onLogout();
                  }}
                >
                  <LogOut size={15} />
                  <span>Sair da Conta</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
