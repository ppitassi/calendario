"use client";

import React from "react";
import {
  Calendar as CalendarIcon,
  CloudDownload,
  ExternalLink,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
} from "lucide-react";
import { DesignerCopyViewer } from "./DesignerCopyViewer";
import { InstagramMockup } from "../presentation/InstagramMockup";
import type { ContentItem, CalendarRecord } from "@/lib/types";

interface DesignerWorkspaceProps {
  calendar: CalendarRecord;
  month: Date;
  items: ContentItem[];
  selectedItem: ContentItem | null;
  onSelectItem: (item: ContentItem) => void;
  onClearSelection: () => void;
  onOpenCalendarDrawer: () => void;
  onSyncNextcloud: (postId?: string) => Promise<void>;
  isSyncingNextcloud: boolean;
  syncFeedback: string | null;
}

export function DesignerWorkspace({
  calendar,
  month,
  items,
  selectedItem,
  onSelectItem,
  onClearSelection,
  onOpenCalendarDrawer,
  onSyncNextcloud,
  isSyncingNextcloud,
  syncFeedback,
}: DesignerWorkspaceProps) {
  // Ordena itens pela data
  const sortedItems = [...items].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        height: "100%",
        background: "var(--canvas, #f8f9fc)",
        overflow: "hidden",
      }}
    >
      {/* Barra de Ferramentas / Contexto Nativo do Designer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 24px",
          background: "var(--surface, #ffffff)",
          borderBottom: "1px solid var(--border, #e2e8f0)",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "rgba(239, 93, 61, 0.12)",
              color: "var(--accent, #ef5d3d)",
            }}
          >
            <Sparkles size={18} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: "1.1rem",
                  fontWeight: 800,
                  color: "var(--ink, #1e293b)",
                  letterSpacing: "0.02em",
                }}
              >
                Espaço Criativo do Designer
              </h2>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#059669",
                  background: "rgba(16, 185, 129, 0.12)",
                  padding: "2px 8px",
                  borderRadius: "999px",
                }}
              >
                {sortedItems.length} {sortedItems.length === 1 ? "peça" : "peças"} no mês
              </span>
            </div>
            <span style={{ fontSize: "0.78rem", color: "var(--muted, #64748b)" }}>
              {calendar.brand} • Foco em cópia, simulação no Instagram e importação de artes
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Botão de Destaque: Abrir o Calendário como Drawer */}
          <button
            type="button"
            onClick={onOpenCalendarDrawer}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "7px 14px",
              borderRadius: "8px",
              background: "var(--surface-soft, #f1f5f9)",
              border: "1px solid var(--border, #cbd5e1)",
              color: "var(--ink, #1e293b)",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
              transition: "all 0.15s ease",
            }}
            title="Abrir o calendário do mês como gaveta lateral (Drawer)"
          >
            <CalendarIcon size={14} color="#ef5d3d" />
            <span>Calendário do Mês (Drawer)</span>
          </button>

          {/* Botão Sincronizar Nextcloud */}
          <button
            type="button"
            onClick={() => onSyncNextcloud(selectedItem?.id)}
            disabled={isSyncingNextcloud}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 14px",
              borderRadius: "8px",
              background: "rgba(16, 185, 129, 0.12)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              color: "#059669",
              fontSize: "12px",
              fontWeight: 700,
              cursor: isSyncingNextcloud ? "not-allowed" : "pointer",
              transition: "all 0.15s ease",
            }}
            title="Importar ou vincular artes diretamente do Nextcloud"
          >
            <CloudDownload size={14} className={isSyncingNextcloud ? "spin" : ""} />
            <span>{isSyncingNextcloud ? "Puxando artes..." : "Puxar do Nextcloud"}</span>
          </button>
        </div>
      </div>

      {syncFeedback && (
        <div
          style={{
            padding: "8px 24px",
            fontSize: "12px",
            fontWeight: 600,
            background: syncFeedback.startsWith("Erro")
              ? "rgba(239, 68, 68, 0.12)"
              : "rgba(16, 185, 129, 0.12)",
            color: syncFeedback.startsWith("Erro") ? "#dc2626" : "#059669",
            borderBottom: "1px solid rgba(0,0,0,0.06)",
          }}
        >
          {syncFeedback}
        </div>
      )}

      {/* Conteúdo Principal do Designer: Split de Duas Colunas ou Lista + Workspace */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: selectedItem
            ? "minmax(320px, 360px) minmax(680px, 1fr)"
            : "1fr",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {/* Coluna Lateral: Lista de Publicações do Mês */}
        <div
          style={{
            borderRight: selectedItem ? "1px solid var(--border, #e2e8f0)" : "none",
            background: "var(--surface, #ffffff)",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            overflowY: "auto",
            maxWidth: selectedItem ? undefined : "1000px",
            margin: selectedItem ? undefined : "0 auto",
            width: "100%",
            padding: selectedItem ? "12px 16px" : "24px 32px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "14px",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--muted, #64748b)",
              }}
            >
              Publicações do Ciclo ({sortedItems.length})
            </span>

            <button
              type="button"
              onClick={onOpenCalendarDrawer}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                background: "transparent",
                border: "none",
                color: "var(--accent, #ef5d3d)",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <CalendarIcon size={12} />
              <span>Ver no Calendário</span>
            </button>
          </div>

          {sortedItems.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "48px 16px",
                color: "var(--muted, #64748b)",
              }}
            >
              <p style={{ margin: "0 0 12px 0", fontSize: "0.95rem", fontWeight: 600 }}>
                Nenhuma publicação cadastrada neste ciclo.
              </p>
              <button
                type="button"
                onClick={onOpenCalendarDrawer}
                style={{
                  background: "var(--accent, #ef5d3d)",
                  color: "#ffffff",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontWeight: 700,
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                Abrir Calendário para Criar
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {sortedItems.map((item) => {
                const isSelected = selectedItem?.id === item.id;
                const hasArt = Boolean(item.imageUrl || (item as any).image_url);

                return (
                  <div
                    key={item.id}
                    onClick={() => onSelectItem(item)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 14px",
                      borderRadius: "10px",
                      background: isSelected
                        ? "rgba(239, 93, 61, 0.08)"
                        : "var(--surface-soft, #f8f9fc)",
                      border: isSelected
                        ? "1px solid var(--accent, #ef5d3d)"
                        : "1px solid var(--border, #e2e8f0)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 800,
                            color: "var(--muted, #64748b)",
                          }}
                        >
                          {item.date}
                        </span>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: "4px",
                            background: "rgba(59, 130, 246, 0.12)",
                            color: "#2563eb",
                          }}
                        >
                          {item.type}
                        </span>
                        {hasArt && (
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 700,
                              color: "#059669",
                              background: "rgba(16, 185, 129, 0.12)",
                              padding: "1px 6px",
                              borderRadius: "4px",
                            }}
                          >
                            ✓ Arte
                          </span>
                        )}
                      </div>
                      <strong
                        style={{
                          fontSize: "13px",
                          fontWeight: 700,
                          color: "var(--ink, #1e293b)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {item.title || item.head || "Publicação sem título"}
                      </strong>
                    </div>

                    <ChevronRight
                      size={16}
                      color={isSelected ? "var(--accent, #ef5d3d)" : "#94a3b8"}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Coluna Direita: Workspace Ativo com CopyViewer e Mockup Instagram */}
        {selectedItem && (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              padding: "24px 32px",
              background: "var(--canvas, #f8f9fc)",
              display: "flex",
              flexDirection: "column",
              gap: "24px",
            }}
          >
            {/* Topo do Item Selecionado */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--muted, #64748b)",
                  }}
                >
                  Publicação em {selectedItem.date} • {selectedItem.type}
                </span>
                <h3
                  style={{
                    margin: "2px 0 0 0",
                    fontSize: "1.3rem",
                    fontWeight: 800,
                    color: "var(--ink, #1e293b)",
                  }}
                >
                  {selectedItem.title || selectedItem.head || "Sem título"}
                </h3>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => onSyncNextcloud(selectedItem.id)}
                  disabled={isSyncingNextcloud}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 12px",
                    borderRadius: "8px",
                    background: "rgba(16, 185, 129, 0.12)",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                    color: "#059669",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  title="Puxar arte do Nextcloud diretamente para esta publicação"
                >
                  <CloudDownload size={13} className={isSyncingNextcloud ? "spin" : ""} />
                  <span>{isSyncingNextcloud ? "Puxando..." : "Puxar Arte (Nextcloud)"}</span>
                </button>
              </div>
            </div>

            {/* Split: Copy na Esquerda & Mockup Instagram na Direita */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(380px, 1fr) minmax(320px, 400px)",
                gap: "24px",
                alignItems: "start",
              }}
            >
              {/* CopyViewer do Designer */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <DesignerCopyViewer item={selectedItem} />
              </div>

              {/* Mockup Instagram */}
              <div
                style={{
                  background: "var(--surface, #ffffff)",
                  border: "1px solid var(--border, #e2e8f0)",
                  borderRadius: "14px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "var(--muted, #64748b)",
                    }}
                  >
                    Simulação no Instagram
                  </span>
                  {Boolean(selectedItem.imageUrl || (selectedItem as any).image_url) && (
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        color: "#059669",
                        background: "rgba(16, 185, 129, 0.12)",
                        padding: "2px 8px",
                        borderRadius: "999px",
                      }}
                    >
                      ✓ Arte Vinculada
                    </span>
                  )}
                </div>

                <InstagramMockup post={selectedItem} brand={calendar.brand} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
