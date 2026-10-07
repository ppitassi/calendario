"use client";
/**
 * Visualizador e seletor rápido de copy em modo somente leitura para Designers.
 *
 * Conforme Seção 5 do Plano Técnico V2:
 * - Designer lê e copia o copy selecionável, sem permissão de edição.
 * - Botões rápidos: "Copiar head", "Copiar subhead", "Copiar legenda", "Copiar CTA", "Copiar tudo".
 * - Preserva quebras de linha e acentuação, sem tags HTML.
 * - Não renderiza contenteditable, save ou autosave.
 */

import React, { useState } from "react";
import { Copy, Check, FileText } from "lucide-react";
import type { ContentItem } from "@/lib/types";

interface DesignerCopyViewerProps {
  item: ContentItem;
}

export function DesignerCopyViewer({ item }: DesignerCopyViewerProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (text: string, fieldName: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Falha ao copiar:", err);
    }
  };

  const copyAllCopy = async () => {
    const parts = [
      item.head ? `HEAD:\n${item.head}` : null,
      item.subhead ? `SUBHEAD:\n${item.subhead}` : null,
      item.caption ? `LEGENDA:\n${item.caption}` : null,
      item.cta ? `CTA:\n${item.cta}` : null,
    ].filter(Boolean);

    await copyToClipboard(parts.join("\n\n"), "all");
  };

  return (
    <div
      style={{
        background: "var(--surface, #ffffff)",
        border: "1px solid var(--border, #e3e5ed)",
        borderRadius: "12px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--border, #e3e5ed)",
          paddingBottom: "10px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <FileText size={16} style={{ color: "var(--accent, #ff174f)" }} />
          <strong style={{ fontSize: "13px", color: "var(--ink, #171924)" }}>
            Copy & Briefing (Somente Leitura)
          </strong>
        </div>

        <button
          type="button"
          onClick={copyAllCopy}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            background: "var(--surface-soft, #f8f9fc)",
            border: "1px solid var(--border, #e3e5ed)",
            borderRadius: "6px",
            padding: "4px 10px",
            fontSize: "11px",
            fontWeight: 700,
            cursor: "pointer",
            color: "var(--ink, #171924)",
          }}
        >
          {copiedField === "all" ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
          <span>{copiedField === "all" ? "Copiado!" : "Copiar tudo"}</span>
        </button>
      </div>

      {/* Head */}
      {item.head && (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted, #73798a)" }}>
              HEAD (Título visual)
            </span>
            <button
              type="button"
              onClick={() => copyToClipboard(item.head || "", "head")}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: "11px",
                color: "var(--primary, #0284c7)",
                display: "inline-flex",
                alignItems: "center",
                gap: "3px",
              }}
            >
              {copiedField === "head" ? <Check size={11} color="#16a34a" /> : <Copy size={11} />}
              <span>{copiedField === "head" ? "Copiado" : "Copiar"}</span>
            </button>
          </div>
          <div
            style={{
              padding: "8px 10px",
              background: "var(--surface-soft, #f8f9fc)",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: 700,
              userSelect: "text",
            }}
          >
            {item.head}
          </div>
        </div>
      )}

      {/* Subhead */}
      {item.subhead && (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted, #73798a)" }}>
              SUBHEAD (Apoio)
            </span>
            <button
              type="button"
              onClick={() => copyToClipboard(item.subhead || "", "subhead")}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: "11px",
                color: "var(--primary, #0284c7)",
                display: "inline-flex",
                alignItems: "center",
                gap: "3px",
              }}
            >
              {copiedField === "subhead" ? <Check size={11} color="#16a34a" /> : <Copy size={11} />}
              <span>{copiedField === "subhead" ? "Copiado" : "Copiar"}</span>
            </button>
          </div>
          <div
            style={{
              padding: "8px 10px",
              background: "var(--surface-soft, #f8f9fc)",
              borderRadius: "6px",
              fontSize: "12px",
              userSelect: "text",
            }}
          >
            {item.subhead}
          </div>
        </div>
      )}

      {/* Legenda / Caption */}
      {item.caption && (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted, #73798a)" }}>
              LEGENDA (Copy)
            </span>
            <button
              type="button"
              onClick={() => copyToClipboard(item.caption, "caption")}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: "11px",
                color: "var(--primary, #0284c7)",
                display: "inline-flex",
                alignItems: "center",
                gap: "3px",
              }}
            >
              {copiedField === "caption" ? <Check size={11} color="#16a34a" /> : <Copy size={11} />}
              <span>{copiedField === "caption" ? "Copiado" : "Copiar"}</span>
            </button>
          </div>
          <div
            style={{
              padding: "8px 10px",
              background: "var(--surface-soft, #f8f9fc)",
              borderRadius: "6px",
              fontSize: "12px",
              whiteSpace: "pre-wrap",
              userSelect: "text",
              maxHeight: "140px",
              overflowY: "auto",
            }}
          >
            {item.caption}
          </div>
        </div>
      )}

      {/* CTA */}
      {item.cta && (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted, #73798a)" }}>
              CALL TO ACTION (CTA)
            </span>
            <button
              type="button"
              onClick={() => copyToClipboard(item.cta || "", "cta")}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: "11px",
                color: "var(--primary, #0284c7)",
                display: "inline-flex",
                alignItems: "center",
                gap: "3px",
              }}
            >
              {copiedField === "cta" ? <Check size={11} color="#16a34a" /> : <Copy size={11} />}
              <span>{copiedField === "cta" ? "Copiado" : "Copiar"}</span>
            </button>
          </div>
          <div
            style={{
              padding: "6px 10px",
              background: "var(--surface-soft, #f8f9fc)",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 600,
              userSelect: "text",
            }}
          >
            {item.cta}
          </div>
        </div>
      )}

      {/* Briefing Visual */}
      {item.visual && (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted, #73798a)" }}>
            BRIEFING VISUAL (Diretriz da Social Media)
          </span>
          <div
            style={{
              padding: "8px 10px",
              background: "#fffbeb",
              border: "1px solid #fef3c7",
              color: "#92400e",
              borderRadius: "6px",
              fontSize: "12px",
              whiteSpace: "pre-wrap",
              userSelect: "text",
            }}
          >
            {item.visual}
          </div>
        </div>
      )}
    </div>
  );
}
