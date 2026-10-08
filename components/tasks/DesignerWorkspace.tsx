"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  CloudDownload,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Upload,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  SlidersHorizontal,
  Eye,
  PanelRightClose,
  PanelRightOpen,
  ArrowRight,
  Image as ImageIcon,
  FolderOpen,
} from "lucide-react";
import { MiniCalendarPopover } from "../calendar/MiniCalendarPopover";
import { NextcloudFileBrowserModal } from "../storage/NextcloudFileBrowserModal";
import { InstagramMockup } from "../presentation/InstagramMockup";
import { monthLabel } from "@/lib/date";
import type { ContentItem, ContentStatus, CalendarRecord } from "@/lib/types";
import styles from "./DesignerWorkspace.module.css";

interface DesignerWorkspaceProps {
  calendar: CalendarRecord;
  month: Date;
  onMonthChange: (date: Date) => void;
  items: ContentItem[];
  selectedItem: ContentItem | null;
  onSelectItem: (item: ContentItem) => void;
  onUpdateItem?: (item: ContentItem) => void;
  onSyncNextcloud: (postId?: string) => Promise<void>;
  isSyncingNextcloud: boolean;
  syncFeedback: string | null;
}

export function DesignerWorkspace({
  calendar,
  month,
  onMonthChange,
  items,
  selectedItem,
  onSelectItem,
  onUpdateItem,
  onSyncNextcloud,
  isSyncingNextcloud,
  syncFeedback,
}: DesignerWorkspaceProps) {
  // Mini Calendar Popover State
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const calendarBtnRef = useRef<HTMLButtonElement>(null);

  // Nextcloud File Browser Modal State (Finder macOS)
  const [isFileBrowserOpen, setIsFileBrowserOpen] = useState(false);
  const [fileBrowserTargetSlot, setFileBrowserTargetSlot] = useState<"feed" | "story">("feed");

  // Aba de mídia ativa no Preview: 'feed' ou 'story'
  const [activeMediaTab, setActiveMediaTab] = useState<"feed" | "story">("feed");

  // Inspector recolhível
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);

  // Menu de ações •••
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  // Drag & drop e upload local
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingUploadSlot, setPendingUploadSlot] = useState<"feed" | "story">("feed");

  // Feedback de cópia discreto por campo
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Filtro de data via mini-calendário (opcional)
  const [activeDateFilter, setActiveDateFilter] = useState<string | null>(null);

  // Ordenação de publicações por data
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => a.date.localeCompare(b.date));
  }, [items]);

  // Itens exibidos (considerando filtro do mini calendário, se ativo)
  const visibleItems = useMemo(() => {
    if (!activeDateFilter) return sortedItems;
    const filtered = sortedItems.filter((it) => it.date === activeDateFilter);
    return filtered.length > 0 ? filtered : sortedItems;
  }, [sortedItems, activeDateFilter]);

  // Se nenhum item selecionado, seleciona o primeiro por padrão
  useEffect(() => {
    if (!selectedItem && visibleItems.length > 0) {
      onSelectItem(visibleItems[0]);
    }
  }, [selectedItem, visibleItems, onSelectItem]);

  // Navegação por teclado: ↑ / ↓ ou J / K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se estiver digitando em input ou textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if (e.key === "ArrowDown" || e.key.toLowerCase() === "j") {
        e.preventDefault();
        navigatePiece(1);
      } else if (e.key === "ArrowUp" || e.key.toLowerCase() === "k") {
        e.preventDefault();
        navigatePiece(-1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // Fechar menus ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isMenuOpen &&
        menuBtnRef.current &&
        !menuBtnRef.current.contains(e.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  // Índice da peça atual
  const currentIndex = selectedItem
    ? visibleItems.findIndex((it) => it.id === selectedItem.id)
    : -1;

  // Navegar entre peças (-1 = anterior, 1 = próxima)
  const navigatePiece = (delta: number) => {
    if (visibleItems.length === 0) return;
    let nextIdx = currentIndex + delta;
    if (nextIdx < 0) nextIdx = 0;
    if (nextIdx >= visibleItems.length) nextIdx = visibleItems.length - 1;
    onSelectItem(visibleItems[nextIdx]);
  };

  // Copiar campo com feedback temporário
  const handleCopyText = async (text: string, fieldName: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 1800);
    } catch (err) {
      console.error("Erro ao copiar:", err);
    }
  };

  // Copiar briefing completo
  const handleCopyFullBriefing = () => {
    if (!selectedItem) return;
    const parts = [
      selectedItem.head ? `HEAD:\n${selectedItem.head}` : null,
      selectedItem.subhead ? `SUBHEAD:\n${selectedItem.subhead}` : null,
      selectedItem.caption ? `LEGENDA:\n${selectedItem.caption}` : null,
      selectedItem.cta ? `CTA:\n${selectedItem.cta}` : null,
      selectedItem.visual ? `DIRETRIZ VISUAL:\n${selectedItem.visual}` : null,
    ].filter(Boolean);

    handleCopyText(parts.join("\n\n"), "all_briefing");
    setIsMenuOpen(false);
  };

  // Upload de arte a partir de arquivo local (respeitando o slot ativo: feed ou story)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedItem || !onUpdateItem) return;

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.url) {
        const isStoryUpload = pendingUploadSlot === "story";
        const updated: ContentItem = {
          ...selectedItem,
          imageUrl: isStoryUpload ? selectedItem.imageUrl : data.url,
          storyUrl: isStoryUpload ? data.url : selectedItem.storyUrl,
          status: "Produção",
        };
        onUpdateItem(updated);
      }
    } catch (err) {
      console.error("Falha no upload de arte:", err);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Requisitos de mídia por formato
  const normItemType = (selectedItem?.type || "Feed").toLowerCase();
  const requiresFeedAndStory = normItemType === "feed e story" || (!["feed", "story", "stories", "carrossel", "carousel", "reels", "reel"].includes(normItemType));
  const requiresStoryOnly = normItemType === "story" || normItemType === "stories";
  const requiresFeedOnly = !requiresFeedAndStory && !requiresStoryOnly;

  const hasFeedMedia = Boolean(selectedItem?.imageUrl || (selectedItem as any)?.image_url);
  const hasStoryMedia = Boolean(selectedItem?.storyUrl || (selectedItem as any)?.story_url);

  // Validação de preenchimento obrigatório para marcar como pronta
  const isMissingFeed = (requiresFeedOnly || requiresFeedAndStory) && !hasFeedMedia;
  const isMissingStory = (requiresStoryOnly || requiresFeedAndStory) && !hasStoryMedia;
  const canMarkReady = !isMissingFeed && !isMissingStory;

  const missingReasonText = isMissingFeed && isMissingStory
    ? "Faltam as artes de Feed e Story."
    : isMissingStory
    ? "Falta a arte de Story."
    : isMissingFeed
    ? "Falta a arte de Feed."
    : null;

  // Informações do slot atualmente em visualização
  const isViewingStory = activeMediaTab === "story" && (requiresFeedAndStory || requiresStoryOnly);
  const currentSlotUrl = isViewingStory ? (selectedItem?.storyUrl || (selectedItem as any)?.story_url || "") : (selectedItem?.imageUrl || (selectedItem as any)?.image_url || "");
  const hasSlotMedia = Boolean(currentSlotUrl);
  const currentSlotDimensions = isViewingStory ? "1080 × 1920" : selectedItem?.type === "Story" ? "1080 × 1920" : "1080 × 1350";

  // Marcar como Pronta e avançar para próxima
  const handleMarkReady = () => {
    if (!selectedItem || !onUpdateItem || !canMarkReady) return;
    const isAlreadyReady = selectedItem.status === "Aprovado";
    const nextStatus: ContentStatus = isAlreadyReady ? "Produção" : "Aprovado";

    const updated: ContentItem = {
      ...selectedItem,
      status: nextStatus,
    };
    onUpdateItem(updated);

    // Se marcou como pronta, avança suavemente para a próxima publicação
    if (!isAlreadyReady && currentIndex < visibleItems.length - 1) {
      setTimeout(() => {
        navigatePiece(1);
      }, 400);
    }
  };

  // Status visual Apple Style
  const renderStatusDot = (item: ContentItem) => {
    const rawType = (item.type || "Feed").toLowerCase();
    const isDual = rawType === "feed e story";
    const itemHasFeed = Boolean(item.imageUrl || (item as any)?.image_url);
    const itemHasStory = Boolean(item.storyUrl || (item as any)?.story_url);
    const itemHasArt = isDual ? (itemHasFeed && itemHasStory) : (rawType === "story" ? itemHasStory : itemHasFeed);

    const rawStatus = (item.status as unknown as string);
    const isReady = item.status === "Aprovado" || rawStatus === "Pronto";
    const hasChanges = rawStatus === "Alteração" || rawStatus === "Ajuste";
    const inProgress = item.status === "Produção";

    if (hasChanges) {
      return <span className={styles.statusDot} style={{ color: "#ef4444" }} title="Alteração solicitada">!</span>;
    }
    if (isReady) {
      return <span className={styles.statusDot} style={{ color: "#10b981" }} title="Pronta">✓</span>;
    }
    if (itemHasArt) {
      return <span className={styles.statusDot} style={{ color: "#38bdf8" }} title="Arte anexada">●</span>;
    }
    if (inProgress) {
      return <span className={styles.statusDot} style={{ color: "#f59e0b" }} title="Em produção">◐</span>;
    }
    return <span className={styles.statusDot} style={{ color: "#64748b" }} title="Não iniciada">○</span>;
  };

  // Formatar data abreviada: 03 NOV
  const formatDateAbrev = (dStr: string) => {
    if (!dStr) return "";
    const parts = dStr.split("-");
    if (parts.length < 3) return dStr;
    const day = parts[2];
    const monthIdx = parseInt(parts[1], 10) - 1;
    const monthsShort = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
    return `${day} ${monthsShort[monthIdx] || ""}`;
  };

  const isReady = selectedItem?.status === "Aprovado" || (selectedItem?.status as unknown as string) === "Pronto";

  return (
    <div className={styles.workspaceRoot}>
      {/* ========================================================
          1. HEADER / TOOLBAR GLOBAL (Estilo Apple Desktop)
          ======================================================== */}
      <header className={styles.topToolbar}>
        {/* Lado Esquerdo: Identidade Apple */}
        <div className={styles.brandGroup}>
          <div className={styles.brandMark}>
            <ImageIcon size={13} />
          </div>
          <span className={styles.workspaceTitle}>Designer</span>

          <div className={styles.contextDivider} />

          <div className={styles.clientContext}>
            <span className={styles.clientName}>{calendar.brand}</span>
            <span>·</span>
            <span>{monthLabel(month)}</span>
            <span className={styles.countBadge}>({sortedItems.length} peças)</span>
          </div>
        </div>

        {/* Lado Direito: Toolbar Compacta */}
        <div className={styles.actionsToolbar}>
          {/* Botão Calendário -> Abre Mini Popover Contextual */}
          <div style={{ position: "relative" }}>
            <button
              ref={calendarBtnRef}
              type="button"
              className={`${styles.toolBtn} ${isCalendarOpen ? styles.active : ""}`}
              onClick={() => setIsCalendarOpen((prev) => !prev)}
              title="Abrir navegador de datas (Mini Calendário)"
            >
              <CalendarIcon size={14} />
              <span>Calendário</span>
            </button>

            {/* Mini Calendário Popover Flutuante */}
            <MiniCalendarPopover
              isOpen={isCalendarOpen}
              onClose={() => setIsCalendarOpen(false)}
              month={month}
              onMonthChange={onMonthChange}
              items={items}
              selectedDate={activeDateFilter || selectedItem?.date}
              onSelectDate={(dStr) => {
                setActiveDateFilter(dStr);
                // Encontra a primeira peça desta data e seleciona
                const firstOnDate = sortedItems.find((it) => it.date === dStr);
                if (firstOnDate) {
                  onSelectItem(firstOnDate);
                }
                setIsCalendarOpen(false);
              }}
            />
          </div>

          {/* Menu Secundário ••• */}
          <div style={{ position: "relative" }}>
            <button
              ref={menuBtnRef}
              type="button"
              className={styles.toolBtn}
              onClick={() => setIsMenuOpen((prev) => !prev)}
              title="Mais ações"
            >
              <MoreHorizontal size={14} />
            </button>

            {isMenuOpen && (
              <div className={styles.menuDropdown}>
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={handleCopyFullBriefing}
                >
                  <Copy size={13} />
                  <span>Copiar briefing completo</span>
                </button>
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => {
                    handleMarkReady();
                    setIsMenuOpen(false);
                  }}
                >
                  <Check size={13} />
                  <span>{isReady ? "Voltar para produção" : "Marcar como pronta"}</span>
                </button>
                {activeDateFilter && (
                  <>
                    <div className={styles.menuDivider} />
                    <button
                      type="button"
                      className={styles.menuItem}
                      onClick={() => {
                        setActiveDateFilter(null);
                        setIsMenuOpen(false);
                      }}
                    >
                      <span>Limpar filtro de data</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Toggle do Inspector / Preview */}
          <button
            type="button"
            className={`${styles.toolBtn} ${isInspectorOpen ? styles.active : ""}`}
            onClick={() => setIsInspectorOpen((prev) => !prev)}
            title={isInspectorOpen ? "Ocultar Preview" : "Exibir Preview (Inspector)"}
          >
            {isInspectorOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
          </button>
        </div>
      </header>

      {/* Input oculto para carregar arquivo */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* ========================================================
          2. ESTRUTURA PRINCIPAL (3 PAINÉIS / SPLIT VIEW)
          ======================================================== */}
      <div className={styles.panelsContainer}>
        {/* ------------------------------------------------------
            PAINEL 1: SOURCE LIST (Lista compacta Finder/Mail)
            ------------------------------------------------------ */}
        <aside className={styles.sourceListPanel}>
          <div className={styles.sourceListHeader}>
            <span className={styles.panelSectionTitle}>Publicações</span>
            {activeDateFilter && (
              <span
                className={styles.filterInfoBadge}
                onClick={() => setActiveDateFilter(null)}
                title="Clique para ver todas as peças do mês"
              >
                {activeDateFilter} ✕
              </span>
            )}
          </div>

          <div className={styles.sourceListScroll}>
            {visibleItems.map((item) => {
              const isSelected = selectedItem?.id === item.id;

              return (
                <div
                  key={item.id}
                  className={`${styles.sourceRow} ${isSelected ? styles.selected : ""}`}
                  onClick={() => onSelectItem(item)}
                >
                  <div className={styles.statusIconCol}>
                    {renderStatusDot(item)}
                  </div>

                  <div className={styles.rowMainContent}>
                    <div className={styles.rowTopLine}>
                      <span className={styles.rowDate}>{formatDateAbrev(item.date)}</span>
                      <span className={styles.rowFormat}>{item.type}</span>
                    </div>

                    <span className={styles.rowTitle}>
                      {item.title || item.head || "Publicação"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* ------------------------------------------------------
            PAINEL 2: ÁREA DE TRABALHO (CONTENT PRINCIPAL)
            ------------------------------------------------------ */}
        <main className={styles.contentPanel}>
          {selectedItem ? (
            <>
              {/* Header da Peça Selecionada com Navegação Rápida */}
              <div className={styles.contentHeader}>
                <div className={styles.pieceHeaderLeft}>
                  <h1 className={styles.pieceTitle}>
                    {selectedItem.title || selectedItem.head || "Arte da Publicação"}
                  </h1>
                  <span className={styles.pieceMeta}>
                    {selectedItem.date} · {selectedItem.type}
                    {selectedItem.profile ? ` · @${selectedItem.profile}` : ""}
                  </span>
                </div>

                {/* Controles de Navegação: ← anterior 1 de 13 próxima → */}
                <div className={styles.navControls}>
                  <button
                    type="button"
                    className={styles.navStepBtn}
                    onClick={() => navigatePiece(-1)}
                    disabled={currentIndex <= 0}
                    title="Peça anterior (Atalho: ↑ ou K)"
                  >
                    <ChevronLeft size={13} />
                    <span>Anterior</span>
                  </button>

                  <span className={styles.navIndexLabel}>
                    {currentIndex + 1} de {visibleItems.length}
                  </span>

                  <button
                    type="button"
                    className={styles.navStepBtn}
                    onClick={() => navigatePiece(1)}
                    disabled={currentIndex >= visibleItems.length - 1}
                    title="Próxima peça (Atalho: ↓ ou J)"
                  >
                    <span>Próxima</span>
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>

              <div className={styles.contentBody}>
                {/* ------------------------------------------------
                    BRIEFING & COPY DIRETO NO CANVAS (SEM CARDS ANINHADOS)
                    A mídia agora é gerenciada com precisão no Preview à direita.
                    ------------------------------------------------ */}
                <section className={styles.briefingDirectSection}>
                  <div className={styles.briefingHeaderRow}>
                    <h3 className={styles.sectionHeading}>Copy e briefing</h3>
                    <button
                      type="button"
                      className={styles.copyHoverBtn}
                      style={{ opacity: 1 }}
                      onClick={handleCopyFullBriefing}
                      title="Copiar todo o briefing"
                    >
                      <Copy size={12} />
                      <span>Copiar tudo</span>
                    </button>
                  </div>

                  {/* Head */}
                  {selectedItem.head && (
                    <div className={styles.copyEntryGroup}>
                      <div className={styles.copyLabelRow}>
                        <span className={styles.copyFieldLabel}>Head</span>
                        <button
                          type="button"
                          className={`${styles.copyHoverBtn} ${copiedField === "head" ? styles.copied : ""}`}
                          onClick={() => handleCopyText(selectedItem.head || "", "head")}
                        >
                          {copiedField === "head" ? <Check size={12} /> : <Copy size={12} />}
                          <span>{copiedField === "head" ? "Copiado" : "Copiar"}</span>
                        </button>
                      </div>
                      <div className={`${styles.copyTextDisplay} ${styles.copyHeadText}`}>
                        {selectedItem.head}
                      </div>
                    </div>
                  )}

                  {/* Subhead */}
                  {selectedItem.subhead && (
                    <div className={styles.copyEntryGroup}>
                      <div className={styles.copyLabelRow}>
                        <span className={styles.copyFieldLabel}>Subhead</span>
                        <button
                          type="button"
                          className={`${styles.copyHoverBtn} ${copiedField === "subhead" ? styles.copied : ""}`}
                          onClick={() => handleCopyText(selectedItem.subhead || "", "subhead")}
                        >
                          {copiedField === "subhead" ? <Check size={12} /> : <Copy size={12} />}
                          <span>{copiedField === "subhead" ? "Copiado" : "Copiar"}</span>
                        </button>
                      </div>
                      <div className={`${styles.copyTextDisplay} ${styles.copySubheadText}`}>
                        {selectedItem.subhead}
                      </div>
                    </div>
                  )}

                  {/* Legenda */}
                  {selectedItem.caption && (
                    <div className={styles.copyEntryGroup}>
                      <div className={styles.copyLabelRow}>
                        <span className={styles.copyFieldLabel}>Legenda</span>
                        <button
                          type="button"
                          className={`${styles.copyHoverBtn} ${copiedField === "caption" ? styles.copied : ""}`}
                          onClick={() => handleCopyText(selectedItem.caption || "", "caption")}
                        >
                          {copiedField === "caption" ? <Check size={12} /> : <Copy size={12} />}
                          <span>{copiedField === "caption" ? "Copiado" : "Copiar"}</span>
                        </button>
                      </div>
                      <div className={styles.copyTextDisplay}>
                        {selectedItem.caption}
                      </div>
                    </div>
                  )}

                  {/* CTA */}
                  {selectedItem.cta && (
                    <div className={styles.copyEntryGroup}>
                      <div className={styles.copyLabelRow}>
                        <span className={styles.copyFieldLabel}>Call to Action</span>
                        <button
                          type="button"
                          className={`${styles.copyHoverBtn} ${copiedField === "cta" ? styles.copied : ""}`}
                          onClick={() => handleCopyText(selectedItem.cta || "", "cta")}
                        >
                          {copiedField === "cta" ? <Check size={12} /> : <Copy size={12} />}
                          <span>{copiedField === "cta" ? "Copiado" : "Copiar"}</span>
                        </button>
                      </div>
                      <div className={styles.copyTextDisplay}>
                        {selectedItem.cta}
                      </div>
                    </div>
                  )}

                  {/* Diretriz Visual da Social Media */}
                  {selectedItem.visual && (
                    <div className={styles.copyEntryGroup}>
                      <div className={styles.copyLabelRow}>
                        <span className={styles.copyFieldLabel}>Objetivo / Diretriz Visual</span>
                      </div>
                      <div className={styles.copyVisualBriefingText}>
                        {selectedItem.visual}
                      </div>
                    </div>
                  )}
                </section>
              </div>
            </>
          ) : (
            <div style={{ padding: "48px 24px", textAlign: "center", color: "#64748b" }}>
              Selecione uma publicação na lista ao lado.
            </div>
          )}
        </main>

        {/* ------------------------------------------------------
            PAINEL 3: INSPECTOR / PREVIEW (DIREITA RECOLHÍVEL)
            ------------------------------------------------------ */}
        {isInspectorOpen && selectedItem && (
          <aside className={styles.inspectorPanel}>
            <div className={styles.inspectorHeader}>
              <span className={styles.inspectorTitle}>Preview</span>
              <button
                type="button"
                className={styles.collapseBtn}
                onClick={() => setIsInspectorOpen(false)}
                title="Recolher Inspector"
              >
                <PanelRightClose size={14} />
              </button>
            </div>

            <div className={styles.inspectorBody}>
              <InstagramMockup
                post={selectedItem}
                brand={calendar.brand}
                activeTab={activeMediaTab}
                onTabChange={(tab) => setActiveMediaTab(tab)}
                onImportMedia={(slot) => {
                  setFileBrowserTargetSlot(slot);
                  setIsFileBrowserOpen(true);
                }}
              />

              {/* Informações e ações da arte associada ao slot ativo */}
              {hasSlotMedia && (
                <div className={styles.inspectorArtActionsSection}>
                  <div className={styles.inspectorArtMetaLine}>
                    <span className={styles.inspectorArtFileName} title={currentSlotUrl.split("/").pop() || "arte-anexada.png"}>
                      {currentSlotUrl.split("/").pop() || "arte-anexada.png"}
                    </span>
                    <span className={styles.inspectorArtDimensions}>
                      {currentSlotDimensions}
                    </span>
                  </div>

                  <div className={styles.inspectorArtButtonsRow}>
                    <button
                      type="button"
                      className={styles.inspectorArtBtn}
                      onClick={() => {
                        setFileBrowserTargetSlot(isViewingStory ? "story" : "feed");
                        setIsFileBrowserOpen(true);
                      }}
                      title="Substituir arte por outro arquivo do Nextcloud"
                    >
                      <CloudDownload size={13} />
                      <span>Substituir</span>
                    </button>

                    <button
                      type="button"
                      className={styles.inspectorArtBtn}
                      onClick={() => {
                        setPendingUploadSlot(isViewingStory ? "story" : "feed");
                        fileInputRef.current?.click();
                      }}
                      title="Enviar arquivo do computador"
                    >
                      <FolderOpen size={13} />
                      <span>Computador</span>
                    </button>

                    <a
                      href={currentSlotUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.inspectorArtBtn}
                      title="Abrir arte original em alta resolução"
                    >
                      <ExternalLink size={13} />
                      <span>Original</span>
                    </a>
                  </div>

                  <button
                    type="button"
                    className={`${styles.inspectorMarkReadyBtn} ${isReady ? styles.isReady : ""}`}
                    onClick={handleMarkReady}
                    disabled={!canMarkReady && !isReady}
                    title={missingReasonText || "Marcar publicação como concluída"}
                  >
                    {isReady ? (
                      <>
                        <CheckCircle2 size={14} />
                        <span>✓ Concluída</span>
                      </>
                    ) : (
                      <>
                        <Check size={14} />
                        <span>Marcar como pronta</span>
                      </>
                    )}
                  </button>

                  {!canMarkReady && !isReady && missingReasonText && (
                    <span className={styles.inspectorMissingHint}>
                      {missingReasonText}
                    </span>
                  )}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Input oculto para upload de arquivo local */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* Botão flutuante para reabrir o Inspector quando estiver fechado */}
      {!isInspectorOpen && (
        <button
          type="button"
          className={styles.reopenInspectorBtn}
          onClick={() => setIsInspectorOpen(true)}
          title="Exibir Preview da publicação"
        >
          <Eye size={12} />
          <span>Preview</span>
        </button>
      )}

      {/* Toast Feedback Temporário para ações globais */}
      {syncFeedback && (
        <div className={styles.toastFeedback}>
          <span>{syncFeedback}</span>
        </div>
      )}

      {/* Navegador de Arquivos Nextcloud (Finder Modal contextual por slot) */}
      <NextcloudFileBrowserModal
        isOpen={isFileBrowserOpen}
        onClose={() => setIsFileBrowserOpen(false)}
        clientId={calendar.client_id || (calendar as any).clientId}
        clientName={calendar.brand}
        selectedItem={selectedItem}
        targetType={fileBrowserTargetSlot}
        onImportSuccess={({ imageUrl, slot }) => {
          if (selectedItem && onUpdateItem) {
            const isStoryImport = (slot || fileBrowserTargetSlot) === "story";
            onUpdateItem({
              ...selectedItem,
              imageUrl: isStoryImport ? selectedItem.imageUrl : imageUrl,
              storyUrl: isStoryImport ? imageUrl : selectedItem.storyUrl,
              status: "Produção",
            });
          }
        }}
      />
    </div>
  );
}
