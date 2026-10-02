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
  LogOut,
  Menu,
  Shield,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SafeUser, Client } from "@/lib/types";
import styles from "./Header.module.css";

interface HeaderProps {
  currentUser: SafeUser;
  onLogout: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onOpenMobileMenu?: () => void;
  activeScreen?: string;
  activeClient?: Client | null;
}

export function Header({
  currentUser,
  onLogout,
  theme,
  onToggleTheme,
  onOpenMobileMenu,
  activeScreen,
  activeClient,
}: HeaderProps) {
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Array<{ id: string; message: string; date: string }>>([
    {
      id: "1",
      message: "Sistema pronto e sincronizado com a nuvem.",
      date: "Agora",
    },
  ]);

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

  // Rótulo da tela atual
  const screenTitle =
    activeScreen === "planner"
      ? "Planejador de Conteúdo"
      : activeScreen === "presentation"
      ? "Apresentação"
      : activeScreen === "admin_users"
      ? "Gestão de Usuários"
      : "Controle de Clientes";

  return (
    <header className={styles.header}>
      {/* Seção Esquerda: Hamburger mobile + Breadcrumb / Identificador de Contexto */}
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

        <div className={styles.breadcrumb}>
          <span className={styles.screenBadge}>{screenTitle}</span>
          {activeClient && activeScreen === "planner" && (
            <>
              <span style={{ color: "var(--muted, #94a3b8)", fontSize: "0.8rem" }}>/</span>
              <span className={styles.clientBadge}>{activeClient.name}</span>
            </>
          )}
        </div>
      </div>

      {/* Seção Direita: Notificações + Modo Noturno + Painel de Usuário */}
      <div className={styles.rightSection}>
        {/* 1. Botão de Notificações */}
        <div className={styles.dropdownWrapper} ref={notificationsRef}>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => {
              setNotificationsOpen(!notificationsOpen);
              setUserDropdownOpen(false);
            }}
            title="Notificações"
            aria-label="Abrir notificações"
            aria-expanded={notificationsOpen}
          >
            <Bell size={16} />
            {notifications.length > 0 && (
              <span className={styles.notificationBadge}>{notifications.length}</span>
            )}
          </button>

          {notificationsOpen && (
            <div className={styles.dropdownMenu}>
              <div className={styles.dropdownHeader}>
                <span className={styles.dropdownTitle}>Notificações</span>
                {notifications.length > 0 && (
                  <button
                    type="button"
                    className={styles.dropdownClearBtn}
                    onClick={() => setNotifications([])}
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
                <div className={styles.menuItemList} style={{ padding: "0.5rem" }}>
                  {notifications.map((n) => (
                    <div key={n.id} className={styles.notificationItem}>
                      <Sparkles size={14} color="var(--tenant-primary, #e3002f)" style={{ marginTop: 2, flexShrink: 0 }} />
                      <div>
                        <div>{n.message}</div>
                        <div style={{ fontSize: "0.65rem", color: "var(--muted, #94a3b8)", marginTop: 2 }}>{n.date}</div>
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
