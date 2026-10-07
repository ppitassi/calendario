"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Plus,
  X,
  FileText,
  Calendar,
  Layers,
  Video,
  Image as ImageIcon,
  Check,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import type { ContentItem, ContentType } from "@/lib/types";

export interface DayActionMenuProps {
  date: string;
  dayPosts: ContentItem[];
  referenceEvents: any[];
  availableProfiles: string[];
  defaultFormat?: ContentType;
  isPostingDay?: boolean;
  onTogglePostingDay?: () => void;
  onClose: () => void;
  onCreatePost: (type: ContentType, profile: string) => void;
  onCreateFromReference?: (title: string) => void;
  onSelectPost: (post: ContentItem) => void;
}

const FORMAT_OPTIONS: { type: ContentType; label: string; icon: any }[] = [
  { type: "Feed e Story", label: "Feed + Story", icon: Layers },
  { type: "Feed", label: "Feed (Imagem)", icon: ImageIcon },
  { type: "Carrossel", label: "Carrossel", icon: FileText },
  { type: "Reels", label: "Reels / Vídeo", icon: Video },
  { type: "Story", label: "Story", icon: Layers },
];

export function DayActionMenu({
  date,
  dayPosts,
  referenceEvents,
  availableProfiles,
  defaultFormat = "Feed e Story",
  isPostingDay = false,
  onTogglePostingDay,
  onClose,
  onCreatePost,
  onCreateFromReference,
  onSelectPost,
}: DayActionMenuProps) {
  const [selectedFormat, setSelectedFormat] = useState<ContentType>(defaultFormat);
  const [selectedProfile, setSelectedProfile] = useState<string>(
    availableProfiles.length === 1 ? availableProfiles[0] : ""
  );
  const [view, setView] = useState<"menu" | "create" | "holiday">("menu");
  const [selectedHoliday, setSelectedHoliday] = useState<any>(null);

  // Formatar data legível (ex: 17 de novembro)
  const formattedDate = (() => {
    try {
      const [y, m, d] = date.split("-").map(Number);
      const dt = new Date(y, m - 1, d);
      return dt.toLocaleDateString("pt-BR", {
        weekday: "short",
        day: "numeric",
        month: "long",
      });
    } catch {
      return date;
    }
  })();

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0, 0, 0, 0.4)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-menu-title"
        style={{
          width: "100%",
          maxWidth: "340px",
          background: "var(--surface, #1e2230)",
          border: "1px solid var(--border, rgba(255, 255, 255, 0.12))",
          borderRadius: "14px",
          boxShadow: "0 24px 48px -12px rgba(0, 0, 0, 0.5), 0 4px 12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
          animation: "dayMenuFadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
          color: "var(--ink, #f1f5f9)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho estilo Apple popover */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 14px 10px 14px",
            borderBottom: "1px solid var(--border, rgba(255, 255, 255, 0.08))",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              id="day-menu-title"
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "var(--ink, #f1f5f9)",
                textTransform: "capitalize",
              }}
            >
              {formattedDate}
            </span>
            {isPostingDay && (
              <span style={{ fontSize: "10px", color: "var(--accent, #ff174f)", fontWeight: 600 }}>
                • Dia padrão de postagem
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              border: "none",
              background: "rgba(255, 255, 255, 0.08)",
              color: "var(--muted, #94a3b8)",
              cursor: "pointer",
            }}
            title="Fechar"
          >
            <X size={13} />
          </button>
        </div>

        {/* Visualização 1: Menu contextual padrão */}
        {view === "menu" && (
          <div style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "2px" }}>
            <button
              type="button"
              onClick={() => setView("create")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 10px",
                borderRadius: "8px",
                border: "none",
                background: "transparent",
                color: "var(--ink, #f1f5f9)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.1s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Plus size={14} style={{ color: "var(--accent, #ff174f)" }} />
              <span>Criar publicação</span>
            </button>

            {/* Publicações do dia */}
            {dayPosts.length > 0 && (
              <>
                <div style={{ height: "1px", background: "rgba(255, 255, 255, 0.08)", margin: "4px 0" }} />
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: "var(--muted, #8b92a5)",
                    padding: "4px 8px 2px 8px",
                  }}
                >
                  Publicações ({dayPosts.length})
                </span>
                {dayPosts.map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => {
                      onSelectPost(post);
                      onClose();
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      border: "none",
                      background: "rgba(255, 255, 255, 0.03)",
                      color: "var(--ink, #f1f5f9)",
                      fontSize: "12px",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)")}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {post.title || post.profile || "Publicação"}
                    </span>
                    <span style={{ fontSize: "10px", color: "var(--muted, #8b92a5)" }}>{post.type}</span>
                  </button>
                ))}
              </>
            )}

            {/* Feriados / Datas comemorativas */}
            {referenceEvents.length > 0 && (
              <>
                <div style={{ height: "1px", background: "rgba(255, 255, 255, 0.08)", margin: "4px 0" }} />
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: "var(--muted, #8b92a5)",
                    padding: "4px 8px 2px 8px",
                  }}
                >
                  Datas comemorativas
                </span>
                {referenceEvents.map((ref) => (
                  <button
                    key={ref.externalKey || ref.title}
                    type="button"
                    onClick={() => {
                      setSelectedHoliday(ref);
                      setView("holiday");
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      border: "none",
                      background: "transparent",
                      color: "var(--muted, #cbd5e1)",
                      fontSize: "11px",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <span style={{ width: "4px", height: "4px", borderRadius: "50%", border: "1px solid currentColor" }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ref.title}
                    </span>
                  </button>
                ))}
              </>
            )}

            {/* Alternar dia padrão de postagem */}
            {onTogglePostingDay && (
              <>
                <div style={{ height: "1px", background: "rgba(255, 255, 255, 0.08)", margin: "4px 0" }} />
                <button
                  type="button"
                  onClick={() => {
                    onTogglePostingDay();
                    onClose();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "7px 10px",
                    borderRadius: "6px",
                    border: "none",
                    background: "transparent",
                    color: "var(--ink, #f1f5f9)",
                    fontSize: "12px",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <Calendar size={13} style={{ color: "var(--muted, #94a3b8)" }} />
                  <span>{isPostingDay ? "Remover dos dias padrão" : "Definir como dia padrão"}</span>
                </button>
              </>
            )}
          </div>
        )}

        {/* Visualização 2: Criar publicação com seleção de formato e perfil */}
        {view === "create" && (
          <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted, #8b92a5)" }}>
                ESCOLHA O FORMATO
              </span>
              <button
                type="button"
                onClick={() => setView("menu")}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "11px",
                  color: "var(--accent, #ff174f)",
                  cursor: "pointer",
                }}
              >
                Voltar
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "5px" }}>
              {FORMAT_OPTIONS.map((opt) => {
                const isSelected = selectedFormat === opt.type;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => setSelectedFormat(opt.type)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 8px",
                      borderRadius: "6px",
                      border: `1px solid ${isSelected ? "var(--accent, #ff174f)" : "rgba(255, 255, 255, 0.08)"}`,
                      background: isSelected
                        ? "color-mix(in srgb, var(--accent, #ff174f) 16%, transparent)"
                        : "rgba(255, 255, 255, 0.04)",
                      color: isSelected ? "var(--accent, #ff174f)" : "var(--ink, #f1f5f9)",
                      fontSize: "11px",
                      fontWeight: isSelected ? 700 : 500,
                      cursor: "pointer",
                    }}
                  >
                    <Icon size={12} />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {availableProfiles.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "10px", fontWeight: 700, color: "var(--muted, #8b92a5)" }}>
                  PERFIL / LINHA:
                </label>
                <select
                  value={selectedProfile}
                  onChange={(e) => setSelectedProfile(e.target.value)}
                  style={{
                    padding: "5px 8px",
                    borderRadius: "6px",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    background: "rgba(255, 255, 255, 0.06)",
                    fontSize: "11px",
                    color: "var(--ink, #f1f5f9)",
                  }}
                >
                  <option value="" style={{ background: "#1e2230" }}>Padrão (Geral)</option>
                  {availableProfiles.map((p) => (
                    <option key={p} value={p} style={{ background: "#1e2230" }}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                onCreatePost(selectedFormat, selectedProfile);
                onClose();
              }}
              style={{
                marginTop: "4px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "none",
                background: "var(--accent, #ff174f)",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 2px 8px color-mix(in srgb, var(--accent, #ff174f) 35%, transparent)",
              }}
            >
              <Plus size={14} />
              <span>Confirmar e Criar</span>
            </button>
          </div>
        )}

        {/* Visualização 3: Detalhes do Feriado / Data Comemorativa */}
        {view === "holiday" && selectedHoliday && (
          <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink, #f1f5f9)" }}>
                {selectedHoliday.title}
              </span>
              <button
                type="button"
                onClick={() => setView("menu")}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "11px",
                  color: "var(--accent, #ff174f)",
                  cursor: "pointer",
                }}
              >
                Voltar
              </button>
            </div>

            <p style={{ margin: 0, fontSize: "11px", color: "var(--muted, #94a3b8)", lineHeight: 1.4 }}>
              Data comemorativa oficial ({selectedHoliday.sourceLabel || "Calendário Oficial"}). Deseja incluir no planejamento?
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
              {onCreateFromReference && (
                <button
                  type="button"
                  onClick={() => {
                    onCreateFromReference(selectedHoliday.title);
                    onClose();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "none",
                    background: "var(--accent, #ff174f)",
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <Plus size={14} />
                  <span>Criar publicação sobre esta data</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  background: "transparent",
                  color: "var(--muted, #94a3b8)",
                  fontSize: "11px",
                  cursor: "pointer",
                }}
              >
                Ignorar neste calendário
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

