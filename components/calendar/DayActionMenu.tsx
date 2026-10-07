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
  Sliders,
} from "lucide-react";
import type { ContentItem, ContentType } from "@/lib/types";

export interface DayActionMenuProps {
  date: string;
  dayPosts: ContentItem[];
  referenceEvents: any[];
  availableProfiles: string[];
  defaultFormat?: ContentType;
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
  onClose,
  onCreatePost,
  onCreateFromReference,
  onSelectPost,
}: DayActionMenuProps) {
  const [selectedFormat, setSelectedFormat] = useState<ContentType>(defaultFormat);
  const [selectedProfile, setSelectedProfile] = useState<string>(
    availableProfiles.length === 1 ? availableProfiles[0] : ""
  );

  // Formatar data legível (ex: 15 de Outubro)
  const formattedDate = (() => {
    try {
      const [y, m, d] = date.split("-").map(Number);
      const dt = new Date(y, m - 1, d);
      return dt.toLocaleDateString("pt-BR", {
        weekday: "long",
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
        background: "rgba(15, 23, 42, 0.45)",
        backdropFilter: "blur(4px)",
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
          maxWidth: "420px",
          background: "var(--surface, #ffffff)",
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: "16px",
          boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.2), 0 8px 16px -4px rgba(0, 0, 0, 0.1)",
          overflow: "hidden",
          animation: "dayMenuFadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do Menu */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid var(--border, #f1f5f9)",
            background: "var(--surface-soft, #f8fafc)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--accent, #ff174f)",
              }}
            >
              Ações para o dia
            </span>
            <h3
              id="day-menu-title"
              style={{
                margin: 0,
                fontSize: "15px",
                fontWeight: 800,
                color: "var(--ink, #0f172a)",
                textTransform: "capitalize",
              }}
            >
              {formattedDate}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "28px",
              height: "28px",
              borderRadius: "8px",
              border: "1px solid var(--border, #e2e8f0)",
              background: "var(--surface, #ffffff)",
              color: "var(--muted, #64748b)",
              cursor: "pointer",
            }}
            title="Fechar"
          >
            <X size={15} />
          </button>
        </div>

        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Se o dia já tiver posts, lista-os com acesso direto */}
          {dayPosts.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  color: "var(--muted, #64748b)",
                }}
              >
                Publicações existentes ({dayPosts.length})
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
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
                      gap: "10px",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--border, #e2e8f0)",
                      background: "var(--surface-soft, #f8fafc)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 800,
                          textTransform: "uppercase",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: "var(--surface, #ffffff)",
                          border: "1px solid var(--border, #cbd5e1)",
                          color: "var(--ink, #1e293b)",
                          flexShrink: 0,
                        }}
                      >
                        {post.type}
                      </span>
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "var(--ink, #0f172a)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {post.title || post.profile || "Publicação"}
                      </span>
                    </div>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent, #ff174f)", flexShrink: 0 }}>
                      Abrir →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Referências Editoriais / Datas Comemorativas */}
          {referenceEvents.length > 0 && onCreateFromReference && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  color: "var(--muted, #64748b)",
                }}
              >
                Inspirar com Data comemorativa
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {referenceEvents.map((ref) => (
                  <button
                    key={ref.externalKey || ref.title}
                    type="button"
                    onClick={() => {
                      onCreateFromReference(ref.title);
                      onClose();
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid rgba(14, 165, 233, 0.3)",
                      background: "rgba(14, 165, 233, 0.08)",
                      color: "#0369a1",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden" }}>
                      <span>🗓️</span>
                      <span style={{ fontSize: "12px", fontWeight: 700 }}>{ref.title}</span>
                    </div>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "3px",
                        fontSize: "10px",
                        fontWeight: 800,
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: "rgba(14, 165, 233, 0.2)",
                        flexShrink: 0,
                      }}
                    >
                      <Sparkles size={10} />
                      Usar
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Configuração de Nova Publicação */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                color: "var(--muted, #64748b)",
              }}
            >
              Criar Nova Publicação
            </span>

            {/* Escolha do Formato */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "6px" }}>
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
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: `1px solid ${isSelected ? "var(--accent, #ff174f)" : "var(--border, #e2e8f0)"}`,
                      background: isSelected
                        ? "color-mix(in srgb, var(--accent, #ff174f) 8%, var(--surface, #ffffff))"
                        : "var(--surface, #ffffff)",
                      color: isSelected ? "var(--accent, #ff174f)" : "var(--ink, #1e293b)",
                      fontSize: "11px",
                      fontWeight: isSelected ? 800 : 600,
                      cursor: "pointer",
                      transition: "all 0.12s ease",
                    }}
                  >
                    <Icon size={13} />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Escolha do Perfil (se houver mais de 1) */}
            {availableProfiles.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "2px" }}>
                <label
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: "var(--muted, #64748b)",
                  }}
                >
                  Perfil / Linha Editorial:
                </label>
                <select
                  value={selectedProfile}
                  onChange={(e) => setSelectedProfile(e.target.value)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "8px",
                    border: "1px solid var(--border, #cbd5e1)",
                    background: "var(--surface, #ffffff)",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--ink, #0f172a)",
                  }}
                >
                  <option value="">Padrão (Sem perfil fixo)</option>
                  {availableProfiles.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Botão de confirmação de criação */}
            <button
              type="button"
              onClick={() => {
                onCreatePost(selectedFormat, selectedProfile);
                onClose();
              }}
              style={{
                marginTop: "6px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                padding: "10px 16px",
                borderRadius: "10px",
                border: "none",
                background: "var(--accent, #ff174f)",
                color: "#ffffff",
                fontSize: "13px",
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 4px 12px color-mix(in srgb, var(--accent, #ff174f) 35%, transparent)",
                transition: "filter 0.15s ease",
              }}
            >
              <Plus size={16} />
              <span>Criar Publicação Agora</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
