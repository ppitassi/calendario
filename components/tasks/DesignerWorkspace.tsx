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

  // Inspector recolhível
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);

  // Menu de ações •••
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  // Menu de Importar
  const [isImportMenuOpen, setIsImportMenuOpen] = useState(false);
  const importBtnRef = useRef<HTMLButtonElement>(null);

  // Drag & drop local
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      if (
        isImportMenuOpen &&
        importBtnRef.current &&
        !importBtnRef.current.contains(e.target as Node)
      ) {
        setIsImportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen, isImportMenuOpen]);

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

  // Upload de arte a partir de arquivo local
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
        const updated: ContentItem = {
          ...selectedItem,
          imageUrl: data.url,
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

  // Marcar como Pronta e avançar para próxima
  const handleMarkReady = () => {
    if (!selectedItem || !onUpdateItem) return;
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
    const hasArt = Boolean(item.imageUrl || (item as any).image_url);
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
    if (hasArt) {
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

  const hasArt = Boolean(selectedItem?.imageUrl || (selectedItem as any)?.image_url);
  const currentArtUrl = selectedItem?.imageUrl || (selectedItem as any)?.image_url || "";
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

          {/* Menu Importar (Computador / Nextcloud) */}
          <div style={{ position: "relative" }}>
            <button
              ref={importBtnRef}
              type="button"
              className={`${styles.toolBtn} ${isImportMenuOpen ? styles.active : ""}`}
              onClick={() => setIsImportMenuOpen((prev) => !prev)}
              title="Importar arte do computador ou Nextcloud"
            >
              <Upload size={14} />
              <span>Importar</span>
            </button>

            {isImportMenuOpen && (
              <div className={styles.menuDropdown}>
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => {
                    fileInputRef.current?.click();
                    setIsImportMenuOpen(false);
                  }}
                >
                  <FolderOpen size={13} />
                  <span>Do computador</span>
                </button>
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => {
                    setIsFileBrowserOpen(true);
                    setIsImportMenuOpen(false);
                  }}
                >
                  <CloudDownload size={13} />
                  <span>Do Nextcloud</span>
                </button>
              </div>
            )}
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
                    ESTADO: AINDA NÃO EXISTE ARTE (DROPZONE & UPLOAD)
                    Quando a arte já existe, ela fica no PREVIEW/INSPECTOR à direita.
                    ------------------------------------------------ */}
                {!hasArt && (
                  <section className={styles.artDropSection}>
                    <h3 className={styles.sectionHeading}>Arte</h3>

                    <div
                      className={`${styles.dropzone} ${isDragOver ? styles.dragOver : ""}`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragOver(true);
                      }}
                      onDragLeave={() => setIsDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragOver(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file && onUpdateItem) {
                          const reader = new FileReader();
                          reader.onload = () => {
                            onUpdateItem({
                              ...selectedItem,
                              imageUrl: reader.result as string,
                              status: "Produção",
                            });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className={styles.dropIconCircle}>
                        <Upload size={20} />
                      </div>

                      <span className={styles.dropTextPrimary}>
                        Arraste a arte aqui
                      </span>

                      <div className={styles.dropActionsRow} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className={styles.chooseFileBtn}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Escolher arquivo
                        </button>

                        <button
                          type="button"
                          className={styles.nextcloudBtn}
                          onClick={() => setIsFileBrowserOpen(true)}
                        >
                          <CloudDownload size={13} />
                          <span>Importar do Nextcloud</span>
                        </button>
                      </div>
                    </div>
                  </section>
                )}

                {/* ------------------------------------------------
                    BRIEFING & COPY DIRETO NO CANVAS (SEM CARDS ANINHADOS)
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
              />

              {/* Informações e ações da arte associada à publicação */}
              {hasArt && (
                <div className={styles.inspectorArtActionsSection}>
                  <div className={styles.inspectorArtMetaLine}>
                    <span className={styles.inspectorArtFileName} title={currentArtUrl.split("/").pop() || "arte-anexada.png"}>
                      {currentArtUrl.split("/").pop() || "arte-anexada.png"}
                    </span>
                    <span className={styles.inspectorArtDimensions}>
                      {selectedItem.type === "Story" ? "1080 × 1920" : "1080 × 1350"}
                    </span>
                  </div>

                  <div className={styles.inspectorArtButtonsRow}>
                    <button
                      type="button"
                      className={styles.inspectorArtBtn}
                      onClick={() => setIsFileBrowserOpen(true)}
                      title="Substituir arte por outro arquivo do Nextcloud ou dispositivo"
                    >
                      <CloudDownload size={13} />
                      <span>Substituir</span>
                    </button>

                    <a
                      href={currentArtUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.inspectorArtBtn}
                      title="Abrir arte original em alta resolução"
                    >
                      <ExternalLink size={13} />
                      <span>Abrir original</span>
                    </a>
                  </div>

                  <button
                    type="button"
                    className={`${styles.inspectorMarkReadyBtn} ${isReady ? styles.isReady : ""}`}
                    onClick={handleMarkReady}
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
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

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

      {/* Navegador de Arquivos Nextcloud (Finder Modal) */}
      <NextcloudFileBrowserModal
        isOpen={isFileBrowserOpen}
        onClose={() => setIsFileBrowserOpen(false)}
        clientId={calendar.client_id || (calendar as any).clientId}
        clientName={calendar.brand}
        selectedItem={selectedItem}
        onImportSuccess={({ imageUrl }) => {
          if (selectedItem && onUpdateItem) {
            onUpdateItem({
              ...selectedItem,
              imageUrl,
              status: "Produção",
            });
          }
        }}
      />
    </div>
  );
}
