"use client";
/**
 * Área de trabalho editorial. Mantém uma única fonte de estado para calendário,
 * editor, prévia e apresentação e persiste cada alteração no SQLite/PostgreSQL.
 */

import { useRef } from "react";
import { Plus, AlertCircle, Undo2, ArrowLeft, Loader2, Check } from "lucide-react";
import { Calendar } from "./Calendar";
import { MonthlyCalendarGrid } from "./calendar/MonthlyCalendarGrid";
import { Editor } from "./Editor";
import { Preview } from "./Preview";
import { Presentation } from "./Presentation";
import { ExtrasView } from "./extras/ExtrasView";
import { StudioHeader } from "./StudioHeader";
import { ShareModal } from "./ShareModal";
import { useStudio } from "./hooks/useStudio";
import { useWorkspaceLayout } from "./hooks/useWorkspaceLayout";
import { monthLabel } from "../lib/date";
import type { SafeUser } from "../lib/types";

export interface StudioProps {
  calendarId: string;
  onBack: () => void;
  onOpenPresentation?: () => void;
  onMonthChange?: (month: Date, calId: string) => void;
  initialPresenting?: boolean;
  currentUser?: SafeUser;
  onLogout?: () => void;
  theme?: "light" | "dark";
  onToggleTheme?: () => void;
  initialViewMode?: "calendar" | "extras" | "kanban" | "list";
  onViewModeChange?: (mode: "calendar" | "extras" | "kanban" | "list") => void;
}

/** Carrega uma competência, coordena sua edição e entrega os mesmos dados às três colunas. */
export function Studio({
  calendarId,
  onBack,
  onOpenPresentation,
  onMonthChange,
  initialPresenting = false,
  currentUser,
  onLogout,
  theme,
  onToggleTheme,
  initialViewMode = "calendar",
  onViewModeChange,
}: StudioProps) {
  const {
    calendar,
    items,
    month,
    selectedId,
    setSelectedId,
    viewMode,
    setViewMode,
    presenting,
    setPresenting,
    loading,
    notifications,
    postingDays,
    weekdayFormats,
    monthItems,
    selected,
    availableProfiles,
    showShareModal,
    setShowShareModal,
    shareUrl,
    copiedShareLink,
    loadingShareToken,
    clearNotifications,
    removeNotification,
    handleOpenShareModal,
    handleCopyShareLink,
    handleGenerateNewToken,
    handleTogglePreCalendar,
    handleMonthChange,
    handleUpdatePostingDays,
    handleUpdateWeekdayFormat,
    saveStatus,
    updateItem,
    handleCreateProfile,
    handleDeleteProfile,
    createOn,
    createFromReference,
    createBatchItems,
    createExtra,
    removeItem,
    handleMovePost,
    handleMoveDayPosts,
    handleReorderPosts,
    handleClearMonth,
    handleUnapproveCalendar,
  } = useStudio({
    calendarId,
    onMonthChange,
    initialPresenting,
    initialViewMode,
    onViewModeChange,
  });

  const workspaceRef = useRef<HTMLDivElement>(null);
  const layout = useWorkspaceLayout(workspaceRef);

  if (loading) {
    return (
      <div className="studioLoading">
        <p>Carregando calendário...</p>
      </div>
    );
  }

  if (!calendar) {
    return (
      <div
        className="studioLoading"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px",
        }}
      >
        <p style={{ fontSize: "16px", color: "var(--text-muted, #64748b)", fontWeight: 500 }}>
          Não foi possível encontrar este calendário ou ele ainda não foi gerado.
        </p>
        <button
          type="button"
          onClick={onBack}
          style={{
            padding: "10px 20px",
            background: "var(--primary, #0ea5e9)",
            color: "#ffffff",
            borderRadius: "10px",
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "14px",
          }}
        >
          Voltar ao Início
        </button>
      </div>
    );
  }

  if (presenting) {
    return (
      <Presentation
        calendar={calendar}
        month={month}
        items={monthItems}
        onClose={() => setPresenting(false)}
      />
    );
  }

  const anyCal = calendar as any;
  const isPreCalendarActive = Boolean(
    Number(anyCal.is_pre_calendar) === 1 ||
    anyCal.is_pre_calendar === true ||
    anyCal.is_pre_calendar === "1" ||
    Number(anyCal.isPreCalendar) === 1 ||
    anyCal.isPreCalendar === true ||
    Number(anyCal.client_has_pre_calendar) === 1 ||
    anyCal.client_has_pre_calendar === true
  );

  return (
    <main
      className="appShell"
      style={{ "--accent": calendar.accent || "#ef5d3d" } as React.CSSProperties}
    >
      <StudioHeader
        calendar={calendar}
        month={month}
        viewMode={viewMode}
        notifications={notifications}
        isPreCalendarActive={isPreCalendarActive}
        currentUser={currentUser}
        theme={theme}
        saveStatus={saveStatus}
        onBack={onBack}
        onMonthChange={handleMonthChange}
        onViewModeChange={setViewMode}
        onTogglePreCalendar={handleTogglePreCalendar}
        onOpenShareModal={handleOpenShareModal}
        onOpenPresentation={() => {
          if (onOpenPresentation) onOpenPresentation();
          else setPresenting(true);
        }}
        onToggleTheme={onToggleTheme}
        onLogout={onLogout}
        onClearNotifications={clearNotifications}
        onRemoveNotification={removeNotification}
        onUnapprove={handleUnapproveCalendar}
      />

      {Boolean(calendar.client_feedback || calendar.clientFeedback) && (
        <div
          style={{
            background: "#fffbeb",
            borderBottom: "1px solid #fef3c7",
            padding: "8px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            fontSize: "12px",
            color: "#92400e",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            zIndex: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <AlertCircle size={15} style={{ color: "#d97706", flexShrink: 0 }} />
            <span>
              <strong>Ressalvas do Cliente:</strong> &ldquo;{calendar.client_feedback || calendar.clientFeedback}&rdquo;
            </span>
          </div>
          {currentUser?.role === "admin" && (
            <button
              type="button"
              onClick={handleUnapproveCalendar}
              style={{
                background: "transparent",
                border: "1px solid rgba(217, 119, 6, 0.4)",
                color: "#b45309",
                borderRadius: "4px",
                padding: "3px 8px",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
              title="Desaprovar este calendário como administrador"
            >
              <Undo2 size={11} />
              <span>Desaprovar</span>
            </button>
          )}
        </div>
      )}

      <div className="appBody" ref={workspaceRef}>
        {viewMode === "calendar" ? (
          <div className="workspaceContainer">
            {!selected ? (
              /* Sem publicação selecionada: calendário mensal ocupa toda a área útil */
              <MonthlyCalendarGrid
                month={month}
                items={monthItems}
                selectedId={selectedId}
                postingDays={postingDays}
                weekdayFormats={weekdayFormats}
                onMonthChange={handleMonthChange}
                onSelect={(item) => setSelectedId(item.id)}
                onCreate={(date, type, profile) => createOn(date, type, profile)}
                onCreateFromReference={(d, t) => createFromReference(d, t)}
                onCreateBatch={(dates, type) => createBatchItems(dates, type)}
                onMovePost={handleMovePost}
                onMoveDayPosts={handleMoveDayPosts}
                onReorderPosts={handleReorderPosts}
                onUpdatePostingDays={handleUpdatePostingDays}
                onUpdateWeekdayFormat={handleUpdateWeekdayFormat}
                availableProfiles={availableProfiles}
              />
            ) : layout.canSplitSocial ? (
              /* Largura ampla (>= 1440px): Split view com calendário e editor lado a lado */
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(896px, 1fr) minmax(480px, 40%)",
                  gap: "var(--space-gap, 1rem)",
                  flex: 1,
                  minHeight: 0,
                  height: "100%",
                  overflow: "hidden",
                }}
              >
                <div style={{ minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                  <MonthlyCalendarGrid
                    month={month}
                    items={monthItems}
                    selectedId={selectedId}
                    postingDays={postingDays}
                    weekdayFormats={weekdayFormats}
                    onMonthChange={handleMonthChange}
                    onSelect={(item) => setSelectedId(item.id)}
                    onCreate={(date, type, profile) => createOn(date, type, profile)}
                    onCreateFromReference={(d, t) => createFromReference(d, t)}
                    onCreateBatch={(dates, type) => createBatchItems(dates, type)}
                    onMovePost={handleMovePost}
                    onMoveDayPosts={handleMoveDayPosts}
                    onReorderPosts={handleReorderPosts}
                    onUpdatePostingDays={handleUpdatePostingDays}
                    onUpdateWeekdayFormat={handleUpdateWeekdayFormat}
                    availableProfiles={availableProfiles}
                  />
                </div>
                <div
                  style={{
                    minHeight: 0,
                    overflowY: "auto",
                    background: "var(--surface, #ffffff)",
                    borderLeft: "1px solid var(--border, #e3e5ed)",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 16px",
                      borderBottom: "1px solid var(--border, #e3e5ed)",
                      background: "var(--surface-soft, #f8f9fc)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(null)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        background: "transparent",
                        border: "none",
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "var(--muted, #73798a)",
                        cursor: "pointer",
                      }}
                    >
                      <ArrowLeft size={14} />
                      <span>Fechar editor</span>
                    </button>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {saveStatus && saveStatus !== "idle" && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "11px",
                            fontWeight: 600,
                            color:
                              saveStatus === "saving"
                                ? "#d97706"
                                : saveStatus === "saved"
                                ? "#059669"
                                : "#dc2626",
                          }}
                        >
                          {saveStatus === "saving" && (
                            <>
                              <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />
                              <span>Salvando...</span>
                            </>
                          )}
                          {saveStatus === "saved" && (
                            <>
                              <Check size={11} />
                              <span>Salvo</span>
                            </>
                          )}
                          {saveStatus === "error" && (
                            <>
                              <AlertCircle size={11} />
                              <span>Erro ao salvar</span>
                            </>
                          )}
                        </span>
                      )}
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted, #73798a)" }}>
                        Modo Split (Área ampla)
                      </span>
                    </div>
                  </div>
                  <Editor
                    key={selected.id}
                    item={selected}
                    onChange={updateItem}
                    onDelete={(id) => {
                      removeItem(id);
                      setSelectedId(null);
                    }}
                    availableProfiles={availableProfiles}
                    onCreateProfile={handleCreateProfile}
                    onDeleteProfile={handleDeleteProfile}
                    brand={calendar.brand}
                    allItems={items}
                    allCalendarItems={items}
                  />
                </div>
              </div>
            ) : (
              /* Notebook / Telas abaixo de 1440px: Focus view assume a área principal */
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  minHeight: 0,
                  height: "100%",
                  background: "var(--canvas, #f5f6fa)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 20px",
                    background: "var(--surface, #ffffff)",
                    borderBottom: "1px solid var(--border, #e3e5ed)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      background: "var(--surface-soft, #f8f9fc)",
                      border: "1px solid var(--border, #e3e5ed)",
                      borderRadius: "8px",
                      padding: "6px 14px",
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "var(--ink, #171924)",
                      cursor: "pointer",
                    }}
                  >
                    <ArrowLeft size={15} />
                    <span>Voltar ao calendário</span>
                  </button>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {saveStatus && saveStatus !== "idle" && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "12px",
                          fontWeight: 600,
                          color:
                            saveStatus === "saving"
                              ? "#d97706"
                              : saveStatus === "saved"
                              ? "#059669"
                              : "#dc2626",
                        }}
                      >
                        {saveStatus === "saving" && (
                          <>
                            <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
                            <span>Salvando...</span>
                          </>
                        )}
                        {saveStatus === "saved" && (
                          <>
                            <Check size={12} />
                            <span>Salvo</span>
                          </>
                        )}
                        {saveStatus === "error" && (
                          <>
                            <AlertCircle size={12} />
                            <span>Erro ao salvar</span>
                          </>
                        )}
                      </span>
                    )}
                    <span style={{ fontSize: "12px", color: "var(--muted, #73798a)", fontWeight: 600 }}>
                      Publicação em {selected.date} • {selected.type}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: "auto",
                    padding: "16px 24px",
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  <div style={{ width: "100%", maxWidth: "var(--copy-max, 48rem)" }}>
                    <Editor
                      key={selected.id}
                      item={selected}
                      onChange={updateItem}
                      onDelete={(id) => {
                        removeItem(id);
                        setSelectedId(null);
                      }}
                      availableProfiles={availableProfiles}
                      onCreateProfile={handleCreateProfile}
                      onDeleteProfile={handleDeleteProfile}
                      brand={calendar.brand}
                      allItems={items}
                      allCalendarItems={items}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : viewMode === "extras" ? (
          <ExtrasView
            clientId={calendar.client_id || (calendar as any).clientId}
            items={items}
            selectedId={selectedId}
            onSelect={(item) => setSelectedId(item.id)}
            onUpdateItem={updateItem}
            onDeleteItem={removeItem}
            onCreateExtra={(fmt) => createExtra(fmt)}
            onOpenInEditor={(item) => {
              setSelectedId(item.id);
              setViewMode("calendar");
            }}
            monthName={monthLabel(month)}
            availableProfiles={availableProfiles}
            currentMonthKey={monthLabel(month)}
          />
        ) : null}
      </div>

      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        shareUrl={shareUrl}
        loadingShareToken={loadingShareToken}
        copiedShareLink={copiedShareLink}
        onCopyShareLink={handleCopyShareLink}
        isPreCalendarActive={isPreCalendarActive}
        onTogglePreCalendar={handleTogglePreCalendar}
        calendar={calendar}
        onGenerateNewToken={handleGenerateNewToken}
        currentUser={currentUser}
        onUnapprove={handleUnapproveCalendar}
      />
    </main>
  );
}
