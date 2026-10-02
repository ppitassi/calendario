"use client";
/** Apresentação do calendário para leitura, compartilhamento e impressão. */

import { useState, useMemo, useEffect } from "react";
import { motion } from "motion/react";
import { LayoutTemplate, CheckCircle2, AlertTriangle, MessageSquare, X, Check } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { CalendarRecord, ContentItem } from "@/lib/types";
import { POST_TYPES } from "@/lib/constants";
import { shiftMonth } from "@/lib/date";
import { cn } from "@/lib/utils";
import { BackgroundEffects } from "./BackgroundEffects";
import { PresentationCurveBg } from "./PresentationCurveBg";
import { ViewerHeader } from "./ViewerHeader";
import { PresentationUnifiedIntro } from "./PresentationUnifiedIntro";
import { PresentationDiscreteFeed } from "./PresentationDiscreteFeed";
import { PostPreview } from "./PostPreview";
import styles from "./ViewerScreen.module.css";

/** Compõe capa, estratégia e visão mensal unificadas, cartões cronológicos e simulação discreta do feed. */
export function ViewerScreen({
  calendar,
  month,
  items,
  onClose,
  onMonthChange,
  clientMode = false,
  clientToken = "",
}: {
  calendar: CalendarRecord;
  month: Date;
  items: ContentItem[];
  onClose?: () => void;
  onMonthChange?: (newMonth: Date) => void;
  clientMode?: boolean;
  clientToken?: string;
}) {
  /** Ordena uma cópia dos posts por data sem modificar a ordem recebida do Studio. */
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.date.localeCompare(b.date)),
    [items]
  );

  // Estado dos comentários individuais por post deixados pelo cliente
  const [clientComments, setClientComments] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    items.forEach((it) => {
      const c = it.clientComment || (it as any).client_comment;
      if (c) initial[it.id] = c;
    });
    return initial;
  });

  // Estado do modal de sequestro de tela ("aprovar com ressalvas" ou "reprovar com ressalvas")
  const [hijackModalType, setHijackModalType] = useState<"approve_with_notes" | "reject_with_notes" | null>(null);
  const [generalFeedbackNotes, setGeneralFeedbackNotes] = useState(
    calendar.clientFeedback || calendar.client_feedback || ""
  );
  const [submittingReview, setSubmittingReview] = useState(false);
  const [submittedStatus, setSubmittedStatus] = useState<string | null>(
    calendar.clientFeedbackStatus || calendar.client_feedback_status || null
  );

  // Controle de Pré-Calendário (apenas copywriting, omite imagens)
  const anyCal = calendar as any;
  const isPreCalendarProp = Boolean(
    Number(anyCal.is_pre_calendar) === 1 ||
    anyCal.is_pre_calendar === true ||
    anyCal.is_pre_calendar === "1" ||
    Number(anyCal.isPreCalendar) === 1 ||
    anyCal.isPreCalendar === true ||
    anyCal.isPreCalendar === "1" ||
    Number(anyCal.client_has_pre_calendar) === 1 ||
    anyCal.client_has_pre_calendar === true ||
    anyCal.client_has_pre_calendar === "1" ||
    Number(anyCal.has_pre_calendar) === 1 ||
    anyCal.has_pre_calendar === true ||
    anyCal.has_pre_calendar === "1"
  );
  const [isPreCalendar, setIsPreCalendar] = useState<boolean>(isPreCalendarProp);

  useEffect(() => {
    setIsPreCalendar(isPreCalendarProp);
  }, [isPreCalendarProp]);

  const handleTogglePreCalendar = async (enabled: boolean) => {
    setIsPreCalendar(enabled);
    if (!clientMode && calendar.id) {
      try {
        await fetch(`/api/calendars/${calendar.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_pre_calendar: enabled ? 1 : 0, isPreCalendar: enabled }),
        });
      } catch (e) {
        console.error("Erro ao persistir status de pré-calendário:", e);
      }
    }
  };

  // Submissão do feedback / aprovação do cliente para a API
  const handleSubmitReview = async (
    decision: "approved" | "approved_with_notes" | "rejected_with_notes" | "approve_with_notes" | "reject_with_notes" | string,
    notes = ""
  ) => {
    if (!clientToken) {
      alert("Token de acesso inválido ou expirado.");
      return;
    }

    const normalizedDecision =
      decision === "approve_with_notes"
        ? "approved_with_notes"
        : decision === "reject_with_notes"
        ? "rejected_with_notes"
        : decision;

    setSubmittingReview(true);
    try {
      const commentsPayload = Object.entries(clientComments).map(([postId, comment]) => ({
        postId,
        comment,
      }));

      const res = await fetch(`/api/portal/${clientToken}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: normalizedDecision,
          feedbackNotes: notes,
          postComments: commentsPayload,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Falha ao enviar resposta de validação.");
      }

      setSubmittedStatus(decision);
      setHijackModalType(null);
    } catch (err: any) {
      alert(err.message || "Erro ao registrar validação. Tente novamente.");
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div
      className={styles.root}
      style={
        {
          "--color-action-primary": calendar.accent || "#ef5d3d",
          "--tenant-primary": calendar.accent || "#ef5d3d",
        } as React.CSSProperties
      }
    >
      <BackgroundEffects />
      <PresentationCurveBg />

      <ViewerHeader
        calendar={calendar}
        currentDate={month}
        clientMode={clientMode}
        onExit={onClose || (() => {})}
        onPrevMonth={() => onMonthChange && onMonthChange(shiftMonth(month, -1))}
        onNextMonth={() => onMonthChange && onMonthChange(shiftMonth(month, 1))}
        isPreCalendar={isPreCalendar}
        onTogglePreCalendar={!clientMode ? handleTogglePreCalendar : undefined}
      />

      {/* UI: documento contínuo que também serve de base para impressão/PDF isolado. */}
      <main
        id="presentation-print-area"
        className={cn(
          styles.main,
          "presentationPrintArea",
          clientMode && styles.mainWithApproval
        )}
      >
        {/* 1. CARD MACRO UNIFICADO: Capa (Hero) + Resumo do Planejamento + Calendário Mensal em UM só card */}
        <PresentationUnifiedIntro
          calendar={calendar}
          month={month}
          items={sortedItems}
          isPreCalendar={isPreCalendar}
        />

        {/* 2. LISTA CRONOLÓGICA DAS POSTAGENS (Briefing, Legenda, Objetivo, Arte e Comentário) */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className={styles.postsSection}
        >
          <div className={styles.sectionHeading}>
            <p>Calendário de Conteúdo</p>
            <h2>Postagens do Mês</h2>
          </div>

          {sortedItems.length === 0 ? (
            <div className={styles.empty}>
              <LayoutTemplate />
              <h2>Nenhum conteúdo cadastrado para este mês</h2>
              <p>O planejamento não possui publicações cadastradas para esta competência.</p>
            </div>
          ) : (
            <div className={styles.postsList}>
              {sortedItems.map((post, idx) => {
                let formattedDate = post.date || "";
                try {
                  const dateObj = new Date(post.date + "T12:00:00");
                  if (!isNaN(dateObj.getTime())) {
                    formattedDate = format(dateObj, "EEEE, dd 'de' MMMM", { locale: ptBR });
                  }
                } catch {}
                const postTypeConfig = POST_TYPES.find((pt) => {
                  const t = post.type.toLowerCase();
                  return (
                    pt.id === t ||
                    (pt.id === "feed" && (t === "feed" || t === "post")) ||
                    (pt.id === "story" && (t === "story" || t === "stories")) ||
                    (pt.id === "carrossel" && (t === "carrossel" || t === "carousel")) ||
                    (pt.id === "reels" && (t === "reels" || t === "reel" || t === "vídeo" || t === "video")) ||
                    (pt.id === "feed e story" &&
                      !["feed", "story", "stories", "post", "carrossel", "carousel", "reels", "reel", "video", "vídeo"].includes(t))
                  );
                });

                return (
                  <div
                    key={post.id}
                    id={`post-${post.id}`}
                    className={styles.postItem}
                  >
                    <div className={styles.postDate}>
                      <div />
                      <h3>{formattedDate}</h3>
                      <div />
                    </div>

                    <PostPreview
                      post={post}
                      date={post.date}
                      postTypeConfig={postTypeConfig}
                      postNumber={idx + 1}
                      clientMode={clientMode}
                      clientComment={clientComments[post.id] || ""}
                      onClientCommentChange={(val) =>
                        setClientComments((prev) => ({ ...prev, [post.id]: val }))
                      }
                      isPreCalendar={isPreCalendar}
                    />

                    {idx < sortedItems.length - 1 && (
                      <div className={styles.separator}>
                        <div />
                        <LayoutTemplate />
                        <div />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className={styles.footer}>
            <span>
              Agência Terceiro Andar • {calendar.brand} •{" "}
              {format(month, "MMMM yyyy", { locale: ptBR })}
            </span>
          </div>
        </motion.div>

        {/* 3. SIMULAÇÃO DISCRETA DO FEED NO FIM DA APRESENTAÇÃO (Omitida no Pré-Calendário de Copywriting) */}
        {!isPreCalendar && (
          <PresentationDiscreteFeed
            calendar={calendar}
            items={sortedItems}
          />
        )}
      </main>

      {/* 4. BARRA FIXA DE APROVAÇÃO DO CLIENTE (Exibida somente no modo cliente) */}
      {clientMode && (
        <>
          <div className={styles.portalApprovalStickyBar}>
            <div className={styles.portalApprovalActions}>
              <button
                type="button"
                className={styles.portalApproveFullBtn}
                onClick={() => handleSubmitReview("approved")}
                disabled={submittingReview}
              >
                <Check size={18} />
                <span>
                  {submittingReview
                    ? "Enviando aprovação..."
                    : isPreCalendar
                    ? "Aprovar Pré-Calendário (Copywriting)"
                    : "Aprovar Calendário Completo"}
                </span>
              </button>

              <div className={styles.portalRessalvaLinks}>
                <button
                  type="button"
                  className={cn(styles.portalPhraseBtn, styles.approveNotes)}
                  onClick={() => setHijackModalType("approve_with_notes")}
                  disabled={submittingReview}
                >
                  Aprovar com ressalvas
                </button>
                <span className={styles.portalPhraseSeparator}>•</span>
                <button
                  type="button"
                  className={cn(styles.portalPhraseBtn, styles.rejectNotes)}
                  onClick={() => setHijackModalType("reject_with_notes")}
                  disabled={submittingReview}
                >
                  Reprovar com ressalvas
                </button>
              </div>

              {submittedStatus && (
                <div className={styles.approvalStatusNotice}>
                  ✓ Status registrado:{" "}
                  {submittedStatus === "approved" || submittedStatus === "approve"
                    ? "Aprovado sem ressalvas"
                    : submittedStatus === "approved_with_notes" || submittedStatus === "approve_with_notes"
                    ? "Aprovado com ressalvas"
                    : "Reprovado com ressalvas"}
                </div>
              )}
            </div>
          </div>

          {/* 5. SEQUESTRO DE TELA COM MODAL CENTRALIZADO PARA FEEDBACK OBRIGATÓRIO */}
          {hijackModalType && (
            <div className="screenHijackModalOverlay" onClick={() => setHijackModalType(null)}>
              <div className="screenHijackCard" onClick={(e) => e.stopPropagation()}>
                <div className="screenHijackHeader">
                  <div
                    className={`screenHijackBadge ${
                      hijackModalType === "approve_with_notes" ? "approveNotes" : "rejectNotes"
                    }`}
                  >
                    {hijackModalType === "approve_with_notes" ? (
                      <>
                        <AlertTriangle size={14} />
                        <span>Aprovação com Ressalvas</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={14} />
                        <span>Reprovação com Ressalvas</span>
                      </>
                    )}
                  </div>
                  <h2>
                    {hijackModalType === "approve_with_notes"
                      ? "Aprovar calendário com pontos de ajuste"
                      : "Reprovar calendário e solicitar refação"}
                  </h2>
                  <p>
                    Por favor, detalhe no campo abaixo os ajustes, alterações ou orientações
                    necessárias para a equipe de design e social media:
                  </p>
                </div>

                <div className="screenHijackBody">
                  <label htmlFor="screenHijackFeedback">
                    Feedback Geral & Ressalvas para a Equipe:
                  </label>
                  <textarea
                    id="screenHijackFeedback"
                    className="screenHijackTextarea"
                    placeholder="Descreva exatamente o que precisa ser ajustado ou revisto..."
                    value={generalFeedbackNotes}
                    onChange={(e) => setGeneralFeedbackNotes(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="screenHijackFooter">
                  <button
                    type="button"
                    className="screenHijackCancelBtn"
                    onClick={() => setHijackModalType(null)}
                    disabled={submittingReview}
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    className={`screenHijackSubmitBtn ${
                      hijackModalType === "approve_with_notes" ? "approveTheme" : "rejectTheme"
                    }`}
                    onClick={() => {
                      if (!generalFeedbackNotes.trim()) {
                        alert("Por favor, preencha o campo com suas ressalvas antes de confirmar.");
                        return;
                      }
                      handleSubmitReview(hijackModalType, generalFeedbackNotes.trim());
                    }}
                    disabled={submittingReview}
                  >
                    {submittingReview
                      ? "Enviando..."
                      : hijackModalType === "approve_with_notes"
                      ? "Confirmar Aprovação com Ressalvas"
                      : "Confirmar Reprovação com Ressalvas"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
