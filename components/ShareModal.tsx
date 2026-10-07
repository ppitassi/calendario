"use client";

import {
  Share2,
  X,
  Copy,
  Check,
  CheckCircle,
  ExternalLink,
  Undo2,
} from "lucide-react";
import type { CalendarRecord, SafeUser } from "../lib/types";

export interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string;
  loadingShareToken: boolean;
  copiedShareLink: boolean;
  onCopyShareLink: () => void;
  isPreCalendarActive: boolean;
  onTogglePreCalendar: () => void;
  calendar: CalendarRecord;
  onGenerateNewToken: () => void;
  currentUser?: SafeUser;
  onUnapprove?: () => void;
}

export function ShareModal({
  isOpen,
  onClose,
  shareUrl,
  loadingShareToken,
  copiedShareLink,
  onCopyShareLink,
  isPreCalendarActive,
  onTogglePreCalendar,
  calendar,
  onGenerateNewToken,
  currentUser,
  onUnapprove,
}: ShareModalProps) {
  if (!isOpen) return null;

  return (
    <div className="shareModalOverlay" onClick={onClose}>
      <div className="shareModalCard" onClick={(e) => e.stopPropagation()}>
        <div className="shareModalHeader">
          <div className="shareModalTitle">
            <Share2 size={18} className="shareIcon" />
            <div>
              <strong>Link de Aprovação do Cliente</strong>
              <p>
                Envie este link seguro com token para o cliente validar feeds e comentar nas artes.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="shareModalClose"
            onClick={onClose}
            title="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        <div className="shareModalBody">
          <label>Link Exclusivo com Token de Segurança:</label>
          <div className="shareInputRow">
            <input
              type="text"
              readOnly
              value={loadingShareToken ? "Gerando token de acesso seguro..." : shareUrl}
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              type="button"
              className="shareCopyBtn"
              onClick={onCopyShareLink}
              disabled={loadingShareToken || !shareUrl}
            >
              {copiedShareLink ? (
                <>
                  <Check size={14} />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copiar</span>
                </>
              )}
            </button>
          </div>

          {/* Tick de Pré-Calendário no Modal de Envio */}
          <div className="shareModalPreCalendarOption">
            <label className="sharePreCalendarCheck">
              <input
                type="checkbox"
                checked={isPreCalendarActive}
                onChange={onTogglePreCalendar}
              />
              <div>
                <strong>Modo Pré-calendário (Omitir imagens e criativos)</strong>
                <p>
                  A apresentação exibirá exclusivamente os textos, títulos, briefings e legendas para validação de copywriting antes de começar a produção das artes visuais.
                </p>
              </div>
            </label>
          </div>

          <div className="shareModalFeatures">
            <div className="shareFeatureItem">
              <CheckCircle size={14} color="#10b981" />
              <span>Simulação de feeds por perfil com posts Collab duplicados.</span>
            </div>
            <div className="shareFeatureItem">
              <CheckCircle size={14} color="#10b981" />
              <span>Campos para o cliente comentar em cada post específico.</span>
            </div>
            <div className="shareFeatureItem">
              <CheckCircle size={14} color="#10b981" />
              <span>Botão de aprovação direta ou ressalvas com modal central.</span>
            </div>
          </div>

          {calendar?.client_feedback_status && (
            <div className={`shareClientStatusBox ${calendar.client_feedback_status}`}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                <div>
                  <strong>Última Resposta do Cliente:</strong>
                  <span style={{ marginLeft: 6 }}>
                    {calendar.client_feedback_status === "approve"
                      ? "Aprovado sem ressalvas"
                      : calendar.client_feedback_status === "approve_with_notes"
                      ? "Aprovado com ressalvas"
                      : "Reprovado com ressalvas"}
                  </span>
                </div>
                {currentUser?.role === "admin" && onUnapprove && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onUnapprove();
                    }}
                    style={{
                      background: "rgba(239, 68, 68, 0.12)",
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                      color: "#dc2626",
                      borderRadius: "6px",
                      padding: "3px 8px",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                    title="Desaprovar este calendário e reabrir para avaliação"
                  >
                    <Undo2 size={11} />
                    Desaprovar
                  </button>
                )}
              </div>
              {calendar.client_feedback && (
                <p style={{ marginTop: 4, fontStyle: "italic" }}>
                  "{calendar.client_feedback}"
                </p>
              )}
            </div>
          )}
        </div>

        <div className="shareModalFooter">
          <button
            type="button"
            className="secondarySmallBtn"
            onClick={onGenerateNewToken}
            disabled={loadingShareToken}
            title="Gera um novo token e invalida o link anterior"
          >
            Gerar Novo Link
          </button>
          <button
            type="button"
            className="primaryButton compactBtn"
            onClick={() => window.open(shareUrl, "_blank")}
            disabled={!shareUrl}
          >
            <ExternalLink size={14} />
            <span>Testar como Cliente</span>
          </button>
        </div>
      </div>
    </div>
  );
}
