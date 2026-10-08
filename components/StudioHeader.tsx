"use client";
/**
 * Cabeçalho do Studio: retorno, identidade do cliente, navegação mensal,
 * seletor de visualização, ações globais, notificações e perfil do operador.
 */

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MonitorPlay,
  ArrowLeft,
  Bell,
  AlertCircle,
  X,
  Sun,
  Moon,
  LogOut,
  Shield,
  Kanban,
  List,
  Share2,
  FileText,
  CheckCircle2,
  Undo2,
  ImagePlus,
  Loader2,
  Check,
  Keyboard,
  Palette,
} from "lucide-react";
import type { CalendarRecord, SafeUser } from "../lib/types";
import { monthLabel, shiftMonth } from "../lib/date";
import { useRef, useEffect, useState } from "react";
import { useNotifications } from "./hooks/useNotifications";

export interface StudioHeaderProps {
  calendar: CalendarRecord;
  month: Date;
  viewMode: "calendar" | "extras" | "kanban" | "list";
  notifications: Array<{ id: string; message: string; timestamp: Date }>;
  isPreCalendarActive: boolean;
  currentUser?: SafeUser;
  theme?: "light" | "dark";
  saveStatus?: "idle" | "saving" | "saved" | "error";
  roleWorkspace?: "social_media" | "designer";
  onRoleWorkspaceChange?: (role: "social_media" | "designer") => void;
  onBack: () => void;
  onMonthChange: (month: Date) => void;
  onViewModeChange: (mode: "calendar" | "extras" | "kanban" | "list") => void;
  onTogglePreCalendar: () => void;
  onOpenShareModal: () => void;
  onOpenPresentation: () => void;
  onToggleTheme?: () => void;
  onLogout?: () => void;
  onClearNotifications: () => void;
  onRemoveNotification: (id: string) => void;
  onUnapprove?: () => void;
  onOpenSettings?: () => void;
  onOpenCalendarDrawer?: () => void;
}

/** Cabeçalho completo do Studio com identidade, navegação e ferramentas. */
export function StudioHeader({
  calendar,
  month,
  viewMode,
  notifications: localNotifications,
  isPreCalendarActive,
  currentUser,
  theme,
  saveStatus,
  roleWorkspace = "social_media",
  onRoleWorkspaceChange,
  onBack,
  onMonthChange,
  onViewModeChange,
  onTogglePreCalendar,
  onOpenShareModal,
  onOpenPresentation,
  onToggleTheme,
  onLogout,
  onClearNotifications: _onClearNotifications,
  onRemoveNotification: _onRemoveNotification,
  onUnapprove,
  onOpenSettings,
  onOpenCalendarDrawer,
}: StudioHeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  const {
    notifications: dbNotifications,
    unreadCount,
    markAllAsRead,
    clearAll: clearDbNotifications,
    removeNotification: removeDbNotification,
  } = useNotifications();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (notificationRef.current && !notificationRef.current.contains(target)) {
        setShowNotifications(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(target)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fStatus = calendar.client_feedback_status || calendar.clientFeedbackStatus;
  const isApproved = fStatus === "approve" || fStatus === "approved";
  const isApprovedWithNotes = fStatus === "approve_with_notes" || fStatus === "approved_with_notes";
  const isRejectedWithNotes = fStatus === "reject_with_notes" || fStatus === "rejected_with_notes";
  const isWaitingReview = !fStatus && Boolean(calendar.share_token || calendar.shareToken);

  return (
    <header className="appHeader">
      <div className="brandArea">
        <button className="backHomeBtn" onClick={onBack} title="Voltar ao início">
          <ArrowLeft size={16} />
          <span>Início</span>
        </button>
        {calendar.client_logo_url ? (
          <div className="logoMark" style={{ background: 'transparent', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={calendar.client_logo_url} alt={calendar.brand} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
        ) : (
          <div className="logoMark">
            {calendar.brand ? calendar.brand.slice(0, 2).toUpperCase() : "CP"}
          </div>
        )}
        <div className="brandCopy">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <strong>{calendar.brand}</strong>
            {isApproved && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  fontSize: "11px",
                  fontWeight: 700,
                  background: "rgba(16, 185, 129, 0.12)",
                  color: "#059669",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                }}
                title="Aprovado pelo cliente"
              >
                <CheckCircle2 size={12} />
                {isPreCalendarActive ? "Pré-Calendário Aprovado" : "Calendário Aprovado"}
              </span>
            )}
            {isApprovedWithNotes && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  fontSize: "11px",
                  fontWeight: 700,
                  background: "rgba(245, 158, 11, 0.12)",
                  color: "#d97706",
                  border: "1px solid rgba(245, 158, 11, 0.3)",
                }}
                title={calendar.client_feedback || calendar.clientFeedback || "Aprovado com ressalvas"}
              >
                <AlertCircle size={12} />
                Aprovado c/ Ressalvas
              </span>
            )}
            {isRejectedWithNotes && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  fontSize: "11px",
                  fontWeight: 700,
                  background: "rgba(239, 68, 68, 0.12)",
                  color: "#dc2626",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                }}
                title={calendar.client_feedback || calendar.clientFeedback || "Reprovado com ressalvas"}
              >
                <AlertCircle size={12} />
                Reprovado c/ Ressalvas
              </span>
            )}
            {currentUser?.role === "admin" && (isApproved || isApprovedWithNotes || isRejectedWithNotes) && onUnapprove && (
              <button
                type="button"
                onClick={onUnapprove}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  fontSize: "11px",
                  fontWeight: 700,
                  background: "rgba(239, 68, 68, 0.1)",
                  color: "#ef4444",
                  border: "1px solid rgba(239, 68, 68, 0.25)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                title="Desaprovar este calendário como administrador"
              >
                <Undo2 size={11} />
                <span>Desaprovar</span>
              </button>
            )}
            {isWaitingReview && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  fontSize: "11px",
                  fontWeight: 600,
                  background: "rgba(59, 130, 246, 0.1)",
                  color: "#2563eb",
                  border: "1px solid rgba(59, 130, 246, 0.25)",
                }}
                title="Link gerado e aguardando validação do cliente"
              >
                ⏳ Aguardando Aprovação
              </span>
            )}
            {!isApproved && !isApprovedWithNotes && !isRejectedWithNotes && !isWaitingReview && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  fontSize: "11px",
                  fontWeight: 600,
                  background: "rgba(100, 116, 139, 0.1)",
                  color: "#64748b",
                  border: "1px solid rgba(100, 116, 139, 0.2)",
                }}
              >
                ● Em Produção
              </span>
            )}
          </div>
          <span>{calendar.title}</span>
        </div>
      </div>

      {/* UI: navegação mensal e seletor de visualização (Calendário / Kanban / Lista) */}
      <div className="headerContext">
        <div className="postNavigation">
          <button
            onClick={() => onMonthChange(shiftMonth(month, -1))}
            title="Mês anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <span>{monthLabel(month)}</span>
          <button
            onClick={() => onMonthChange(shiftMonth(month, 1))}
            title="Próximo mês"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="viewModeSelector">
          <button
            type="button"
            className={`viewModeBtn ${viewMode === "calendar" ? "active" : ""}`}
            onClick={() => onViewModeChange("calendar")}
            title="Grade de Calendário Mensal"
          >
            <CalendarDays size={13} />
            <span>Calendário</span>
          </button>
          <button
            type="button"
            className={`viewModeBtn ${viewMode === "extras" ? "active" : ""}`}
            onClick={() => onViewModeChange("extras")}
            title="Demandas Extras e Entregas Avulsas do Mês"
          >
            <ImagePlus size={13} />
            <span>Demandas Extras</span>
          </button>

          {/* Controle exclusivo para Administrador: alternar entre visão de Social Media e visão de Designer */}
          {currentUser?.role === "admin" && onRoleWorkspaceChange && (
            <>
              <div className="viewModeDivider" />
              <button
                type="button"
                className={`viewModeBtn ${roleWorkspace === "social_media" ? "active" : ""}`}
                onClick={() => onRoleWorkspaceChange("social_media")}
                title="Modo Social Media: foco em copywriting, briefing e validação"
              >
                <FileText size={12} />
                <span>Social Media</span>
              </button>
              <button
                type="button"
                className={`viewModeBtn ${roleWorkspace === "designer" ? "active" : ""}`}
                onClick={() => onRoleWorkspaceChange("designer")}
                title="Modo Designer: foco em artes, mockups do Instagram e Nextcloud"
              >
                <Palette size={12} />
                <span>Designer</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* UI: ferramentas do cabeçalho unificado com apresentação, notificações, tema e perfil de usuário */}
      <div className="headerTools">
        {/* Indicador de Salvamento Automático */}
        {saveStatus && saveStatus !== "idle" && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 10px",
              borderRadius: "999px",
              fontSize: "12px",
              fontWeight: 600,
              background:
                saveStatus === "saving"
                  ? "rgba(245, 158, 11, 0.12)"
                  : saveStatus === "saved"
                  ? "rgba(16, 185, 129, 0.12)"
                  : "rgba(239, 68, 68, 0.12)",
              color:
                saveStatus === "saving"
                  ? "#d97706"
                  : saveStatus === "saved"
                  ? "#059669"
                  : "#dc2626",
              border: `1px solid ${
                saveStatus === "saving"
                  ? "rgba(245, 158, 11, 0.3)"
                  : saveStatus === "saved"
                  ? "rgba(16, 185, 129, 0.3)"
                  : "rgba(239, 68, 68, 0.3)"
              }`,
              transition: "all 0.2s ease",
            }}
          >
            {saveStatus === "saving" && (
              <>
                <Loader2 size={13} className="spin" style={{ animation: "spin 1s linear infinite" }} />
                <span>Salvando...</span>
              </>
            )}
            {saveStatus === "saved" && (
              <>
                <Check size={13} />
                <span>Salvo</span>
              </>
            )}
            {saveStatus === "error" && (
              <>
                <AlertCircle size={13} />
                <span>Erro ao salvar</span>
              </>
            )}
          </div>
        )}

        {/* Tick de Pré-Calendário */}
        <label
          className={`preCalendarToggleBtn ${isPreCalendarActive ? "active" : ""}`}
          title="Pré-calendário: aprovação apenas de copywriting antes da produção dos criativos (omite imagens na apresentação)"
        >
          <input
            type="checkbox"
            checked={isPreCalendarActive}
            onChange={onTogglePreCalendar}
          />
          <FileText size={13} />
          <span>Pré-calendário</span>
        </label>

        <button
          type="button"
          className="shareClientBtn"
          onClick={onOpenShareModal}
          title="Gerar link exclusivo com token para o cliente aprovar"
        >
          <Share2 size={13} />
          <span>Link do Cliente</span>
        </button>

        <button
          className="presentButton"
          onClick={onOpenPresentation}
          title="Apresentação em tela cheia com artes reais"
        >
          <MonitorPlay size={14} />
          <span>Apresentação</span>
        </button>

        <div className="notificationWrapper" ref={notificationRef}>
          <button
            type="button"
            className={`notificationBellBtn ${unreadCount > 0 || localNotifications.length > 0 ? "hasAlerts" : ""}`}
            onClick={() => {
              const next = !showNotifications;
              setShowNotifications(next);
              setUserDropdownOpen(false);
              if (next && unreadCount > 0) {
                markAllAsRead();
              }
            }}
            title={unreadCount > 0 ? `${unreadCount} notificações novas` : "Notificações"}
          >
            <Bell size={16} />
            {(unreadCount > 0 || localNotifications.length > 0) && (
              <span className="notificationBadge">{unreadCount > 0 ? unreadCount : localNotifications.length}</span>
            )}
          </button>

          {showNotifications && (
            <div className="notificationDropdown" style={{ width: 340, maxWidth: "90vw" }}>
              <div className="notificationDropdownHeader">
                <strong>Notificações {dbNotifications.length > 0 ? `(${dbNotifications.length})` : ""}</strong>
                {(dbNotifications.length > 0 || localNotifications.length > 0) && (
                  <button
                    type="button"
                    className="notificationClearBtn"
                    onClick={() => {
                      clearDbNotifications();
                      if (_onClearNotifications) _onClearNotifications();
                    }}
                  >
                    Limpar todas
                  </button>
                )}
              </div>

              <div className="notificationDropdownList">
                {dbNotifications.length === 0 && localNotifications.length === 0 ? (
                  <div className="notificationEmpty">
                    <p>Nenhuma notificação no momento.</p>
                  </div>
                ) : (
                  <>
                    {dbNotifications.map((item) => (
                      <div
                        key={item.id}
                        className="notificationItem"
                        style={{
                          background: item.is_read ? undefined : "rgba(227, 0, 47, 0.05)",
                          borderLeft: item.is_read ? "3px solid transparent" : "3px solid var(--tenant-primary, #e3002f)",
                          paddingLeft: "0.6rem",
                        }}
                      >
                        {item.type === "client_review" ? (
                          <CheckCircle2 size={15} style={{ color: "#10b981", flexShrink: 0, marginTop: 2 }} />
                        ) : (
                          <AlertCircle size={15} className="notificationErrorIcon" />
                        )}
                        <div className="notificationItemText">
                          <span style={{ fontWeight: 700, fontSize: "11px", marginBottom: "2px" }}>{item.title}</span>
                          <span style={{ fontSize: "11px", color: "var(--color-text-secondary, #475569)" }}>{item.message}</span>
                          <small>
                            {item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Agora"}
                          </small>
                        </div>
                        <button
                          type="button"
                          className="notificationDismissBtn"
                          onClick={() => removeDbNotification(item.id)}
                          title="Descartar"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    {localNotifications.map((item) => (
                      <div key={item.id} className="notificationItem">
                        <AlertCircle size={15} className="notificationErrorIcon" />
                        <div className="notificationItemText">
                          <span>{item.message}</span>
                          <small>
                            {item.timestamp ? item.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Agora"}
                          </small>
                        </div>
                        <button
                          type="button"
                          className="notificationDismissBtn"
                          onClick={() => _onRemoveNotification && _onRemoveNotification(item.id)}
                          title="Descartar"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {onToggleTheme && (
          <button
            type="button"
            className="themeToggleHeaderBtn"
            onClick={onToggleTheme}
            title={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
            aria-label="Alternar tema"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        )}

        {currentUser && (
          <div className="userDropdownWrapper" ref={userDropdownRef}>
            <button
              type="button"
              className="userMenuTrigger"
              onClick={() => {
                setUserDropdownOpen(!userDropdownOpen);
                setShowNotifications(false);
              }}
              title="Perfil e configurações de usuário"
            >
              <div className="userMenuAvatar">
                {currentUser.name
                  ? currentUser.name
                      .split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((p) => p[0].toUpperCase())
                      .join("")
                  : "US"}
              </div>
              <span className="userMenuName">{currentUser.name}</span>
              <ChevronDown size={14} className="userMenuChevron" />
            </button>

            {userDropdownOpen && (
              <div className="userDropdownMenu">
                <div className="userDropdownHeader">
                  <div className="userMenuAvatar large">
                    {currentUser.name
                      ? currentUser.name
                          .split(" ")
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((p) => p[0].toUpperCase())
                          .join("")
                      : "US"}
                  </div>
                  <div className="userDropdownInfo">
                    <strong>{currentUser.name}</strong>
                    <small>@{currentUser.username}</small>
                    <div className="userRoleTag">
                      <Shield size={10} />
                      <span>
                        {currentUser.role === "admin"
                          ? "Administrador"
                          : currentUser.role === "social_media"
                          ? "Social Media"
                          : "Designer"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="userDropdownFooter">
                  {onOpenSettings && (
                    <button
                      type="button"
                      className="userLogoutBtn"
                      style={{ color: "var(--text-main, inherit)", marginBottom: "4px" }}
                      onClick={() => {
                        setUserDropdownOpen(false);
                        onOpenSettings();
                      }}
                    >
                      <Keyboard size={14} />
                      <span>Atalhos & Teclado</span>
                    </button>
                  )}
                  {onLogout && (
                    <button
                      type="button"
                      className="userLogoutBtn"
                      onClick={() => {
                        setUserDropdownOpen(false);
                        onLogout();
                      }}
                    >
                      <LogOut size={14} />
                      <span>Sair da conta</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
