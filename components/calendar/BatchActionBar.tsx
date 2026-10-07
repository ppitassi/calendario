"use client";
/**
 * Barra contextual de ações em lote para seleção de dias ou publicações.
 * Conforme Seção 4.2 do plano técnico V2.
 */

import { useState } from "react";
import { Check, Plus, Trash2, Calendar, X, Sparkles } from "lucide-react";
import type { ContentType } from "../../lib/types";

interface BatchActionBarProps {
  selectedDays: string[];
  onClearDays: () => void;
  onCreateBatch: (dates: string[], type: ContentType) => void;
  onClearMonth?: () => void;
  availableProfiles?: string[];
}

export function BatchActionBar({
  selectedDays,
  onClearDays,
  onCreateBatch,
  availableProfiles = [],
}: BatchActionBarProps) {
  const [selectedFormat, setSelectedFormat] = useState<ContentType>("Feed e Story");
  const count = selectedDays.length;

  if (count === 0) return null;

  const handleConfirm = () => {
    onCreateBatch(selectedDays, selectedFormat);
    onClearDays();
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(23, 25, 36, 0.95)",
        backdropFilter: "blur(16px)",
        color: "#ffffff",
        padding: "10px 18px",
        borderRadius: "14px",
        display: "flex",
        alignItems: "center",
        gap: "14px",
        boxShadow: "0 12px 36px rgba(0, 0, 0, 0.35)",
        zIndex: 1000,
        maxWidth: "92vw",
        flexWrap: "wrap",
        border: "1px solid rgba(255, 255, 255, 0.15)",
        animation: "fadeIn 0.2s cubic-bezier(0.2, 0, 0, 1)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, fontSize: "13px" }}>
        <Calendar size={16} style={{ color: "var(--accent, #ff174f)" }} />
        <span>
          {count} {count === 1 ? "dia selecionado" : "dias selecionados"}
        </span>
      </div>

      <div style={{ height: "18px", width: "1px", background: "rgba(255, 255, 255, 0.2)" }} />

      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.7)" }}>Formato:</span>
        <select
          value={selectedFormat}
          onChange={(e) => setSelectedFormat(e.target.value as ContentType)}
          style={{
            background: "rgba(255, 255, 255, 0.12)",
            border: "1px solid rgba(255, 255, 255, 0.25)",
            color: "#ffffff",
            padding: "5px 10px",
            borderRadius: "8px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
            outline: "none",
          }}
        >
          <option value="Feed" style={{ color: "#000" }}>Feed</option>
          <option value="Story" style={{ color: "#000" }}>Story</option>
          <option value="Feed e Story" style={{ color: "#000" }}>Feed e Story</option>
          <option value="Carrossel" style={{ color: "#000" }}>Carrossel</option>
          <option value="Reels" style={{ color: "#000" }}>Reels</option>
        </select>
      </div>

      <button
        type="button"
        onClick={handleConfirm}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          background: "var(--accent, #ff174f)",
          color: "#ffffff",
          border: "none",
          borderRadius: "8px",
          padding: "7px 14px",
          fontSize: "12px",
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(255, 23, 79, 0.4)",
        }}
      >
        <Plus size={14} />
        <span>Criar {count} publicações</span>
      </button>

      <button
        type="button"
        onClick={onClearDays}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          background: "transparent",
          color: "rgba(255, 255, 255, 0.7)",
          border: "none",
          padding: "6px 8px",
          borderRadius: "6px",
          fontSize: "12px",
          cursor: "pointer",
        }}
        title="Cancelar seleção"
      >
        <X size={14} />
        <span>Cancelar</span>
      </button>
    </div>
  );
}
