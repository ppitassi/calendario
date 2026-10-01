"use client";
/**
 * Portal do Cliente para Aprovação de Calendário.
 * Acessado através de link único com token.
 *
 * Funcionalidades:
 * - Simulação de Feed do Instagram separada por perfil (@perfil e Collabs em ambos).
 * - Campo de comentários individual para cada publicação.
 * - Barra de aprovação: botão de aprovar e links para aprovação/reprovação com ressalvas.
 * - Modal central de sequestro de tela para preenchimento obrigatório de ressalvas.
 */

import React, { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Layers,
  Smartphone,
  FileImage,
  Film,
  Library,
  MessageSquare,
  Send,
  CalendarDays,
  Sparkles,
  ExternalLink,
  ChevronDown,
  Info,
  Check,
} from "lucide-react";
import type { ContentItem, ContentType } from "@/lib/types";

export default function ClientPortalPage() {
  const params = useParams();
  const token = (params?.token as string) || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calendar, setCalendar] = useState<any | null>(null);
  const [client, setClient] = useState<any | null>(null);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [postComments, setPostComments] = useState<Record<string, string>>({});
  const [savedCommentState, setSavedCommentState] = useState<Record<string, boolean>>({});

  // Controle de visualização (Grade do Feed vs Cards Detalhados)
  const [activeTab, setActiveTab] = useState<"feed" | "details">("feed");

  // Modal de Sequestro de Tela para Ressalvas
  const [hijackModal, setHijackModal] = useState<{
    open: boolean;
    type: "approve_with_notes" | "reject_with_notes" | null;
  }>({ open: false, type: null });

  const [generalFeedback, setGeneralFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedStatus, setSubmittedStatus] = useState<string | null>(null);

  // Carrega os dados do portal via API pública autorizada por token
  useEffect(() => {
    if (!token) return;

    async function loadPortal() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/portal/${encodeURIComponent(token)}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Não foi possível carregar o planejamento.");
        }

        setCalendar(data.calendar);
        setClient(data.client);
        setItems(data.items || []);

        // Inicializa comentários existentes salvos anteriormente
        const initialComments: Record<string, string> = {};
        (data.items || []).forEach((item: any) => {
          if (item.client_comment || item.clientComment) {
            initialComments[item.id] = item.client_comment || item.clientComment;
          }
        });
        setPostComments(initialComments);

        if (data.calendar?.client_feedback_status) {
          setSubmittedStatus(data.calendar.client_feedback_status);
          setGeneralFeedback(data.calendar.client_feedback || "");
        }
      } catch (err: any) {
        setError(err.message || "Erro de conexão ao carregar o portal.");
      } finally {
        setLoading(false);
      }
    }

    loadPortal();
  }, [token]);

  // Lista de perfis presentes nas publicações do calendário
  const profileList = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.profile && item.profile.trim()) {
        set.add(item.profile.trim());
      }
      if (item.isCollab && item.collabProfile && item.collabProfile.trim()) {
        set.add(item.collabProfile.trim());
      }
    });

    if (set.size === 0 && calendar?.brand) {
      set.add(calendar.brand.startsWith("@") ? calendar.brand : `@${calendar.brand}`);
    }

    return Array.from(set);
  }, [items, calendar]);

  // Mapeia posts por perfil (collabs aparecem em todos os perfis relacionados)
  const postsByProfile = useMemo(() => {
    const map: Record<string, ContentItem[]> = {};

    profileList.forEach((profile) => {
      map[profile] = items.filter((item) => {
        // Post pertence diretamente a este perfil
        if (item.profile === profile) return true;
        // Post é collab com este perfil
        if (item.isCollab && item.collabProfile === profile) return true;
        // Se post não tem perfil definido, agrupa no primeiro perfil padrão
        if (!item.profile && profile === profileList[0]) return true;
        return false;
      });
    });

    return map;
  }, [items, profileList]);

  // Atualiza comentário de um post específico
  const handleCommentChange = (itemId: string, text: string) => {
    setPostComments((prev) => ({ ...prev, [itemId]: text }));
    setSavedCommentState((prev) => ({ ...prev, [itemId]: false }));
  };

  // Helper para salvar comentário individual ao sair do campo
  const handleSaveIndividualComment = async (itemId: string) => {
    setSavedCommentState((prev) => ({ ...prev, [itemId]: true }));
  };

  // Submissão de avaliação direta (Aprovação Completa sem ressalvas)
  const handleDirectApproval = async () => {
    if (!confirm("Confirmar a aprovação completa do calendário?")) return;

    try {
      setSubmitting(true);
      const res = await fetch(`/api/portal/${encodeURIComponent(token)}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          generalFeedback: "Aprovado sem ressalvas pelo cliente.",
          postComments,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao registrar aprovação.");

      setSubmittedStatus("approve");
    } catch (err: any) {
      alert(err.message || "Erro ao aprovar o calendário.");
    } finally {
      setSubmitting(false);
    }
  };

  // Submissão do modal de sequestro de tela (com ressalvas)
  const handleConfirmHijackReview = async () => {
    if (!hijackModal.type) return;
    if (!generalFeedback.trim()) {
      alert("Por favor, descreva detalhadamente suas ressalvas antes de prosseguir.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/portal/${encodeURIComponent(token)}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: hijackModal.type,
          generalFeedback: generalFeedback.trim(),
          postComments,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao registrar ressalvas.");

      setSubmittedStatus(hijackModal.type);
      setHijackModal({ open: false, type: null });
    } catch (err: any) {
      alert(err.message || "Erro ao enviar ressalvas.");
    } finally {
      setSubmitting(false);
    }
  };

  // Helper para ícones de formato
  const getFormatIcon = (type: ContentType) => {
    switch (type) {
      case "Feed e Story":
        return <Layers size={13} />;
      case "Story":
        return <Smartphone size={13} />;
      case "Carrossel":
        return <Library size={13} />;
      case "Reels":
        return <Film size={13} />;
      default:
        return <FileImage size={13} />;
    }
  };

  const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length < 3) return dateStr;
    const day = parts[2];
    const monthIndex = parseInt(parts[1], 10) - 1;
    const months = [
      "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
      "Jul", "Ago", "Set", "Out", "Nov", "Dez",
    ];
    return `${day} de ${months[monthIndex] || ""}`;
  };

  // Rolagem suave até o card de postagem detalhado
  const scrollToPostCard = (id: string) => {
    setActiveTab("details");
    setTimeout(() => {
      const el = document.getElementById(`post-detail-${id}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("highlightPulse");
        setTimeout(() => el.classList.remove("highlightPulse"), 2000);
      }
    }, 100);
  };

  if (loading) {
    return (
      <div className="portalPage" style={{ display: "grid", placeItems: "center" }}>
        <div style={{ textAlign: "center", color: "#64748b" }}>
          <Sparkles size={36} className="spinAnimation" style={{ color: "#e11d48", margin: "0 auto 12px" }} />
          <h2 style={{ fontSize: 18, color: "#0f172a" }}>Carregando planejamento...</h2>
          <p style={{ fontSize: 13 }}>Preparando simulação de feed e artes para aprovação.</p>
        </div>
      </div>
    );
  }

  if (error || !calendar) {
    return (
      <div className="portalPage" style={{ display: "grid", placeItems: "center" }}>
        <div className="portalSuccessCard" style={{ borderColor: "#fecaca" }}>
          <div className="portalSuccessIcon" style={{ background: "#fef2f2", color: "#ef4444" }}>
            <XCircle size={32} />
          </div>
          <h2>Acesso Indisponível</h2>
          <p>{error || "O link fornecido não foi encontrado ou expirou."}</p>
        </div>
      </div>
    );
  }

  // TELA DE CONFIRMAÇÃO CASO JÁ TENHA SIDO ENVIADO
  if (submittedStatus) {
    return (
      <div className="portalSuccessScreen">
        <div className="portalSuccessCard">
          <div
            className="portalSuccessIcon"
            style={{
              background:
                submittedStatus === "reject_with_notes"
                  ? "#fef2f2"
                  : submittedStatus === "approve_with_notes"
                  ? "#fffbeb"
                  : "#ecfdf5",
              color:
                submittedStatus === "reject_with_notes"
                  ? "#ef4444"
                  : submittedStatus === "approve_with_notes"
                  ? "#d97706"
                  : "#10b981",
            }}
          >
            {submittedStatus === "reject_with_notes" ? (
              <AlertTriangle size={36} />
            ) : (
              <CheckCircle size={36} />
            )}
          </div>
          <h2>
            {submittedStatus === "approve"
              ? "Calendário Aprovado com Sucesso!"
              : submittedStatus === "approve_with_notes"
              ? "Aprovação com Ressalvas Enviada!"
              : "Reprovação com Ressalvas Enviada!"}
          </h2>
          <p>
            {submittedStatus === "approve"
              ? "Obrigado! Sua aprovação foi registrada e nossa equipe dará início à programação e publicação das artes."
              : "Suas observações e ressalvas foram encaminhadas para a equipe. Os ajustes serão realizados e você receberá uma nova versão para validação."}
          </p>

          {generalFeedback && (
            <div
              style={{
                width: "100%",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                padding: "12px 16px",
                textAlign: "left",
                fontSize: 13,
                color: "#334155",
              }}
            >
              <strong>Suas observações registradas:</strong>
              <p style={{ margin: "6px 0 0", fontStyle: "italic", whiteSpace: "pre-wrap" }}>
                "{generalFeedback}"
              </p>
            </div>
          )}

          <button
            type="button"
            className="secondarySmallBtn"
            onClick={() => setSubmittedStatus(null)}
            style={{ marginTop: 10 }}
          >
            Voltar e rever o planejamento
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="portalPage">
      {/* Header Sticky com Marca e Status */}
      <header className="portalHeader">
        <div className="portalHeaderInner">
          <div className="portalBrandGroup">
            {client?.logoUrl ? (
              <img src={client.logoUrl} alt={client.name} className="portalClientLogo" />
            ) : (
              <div className="portalClientLogoPlaceholder">
                {(client?.name || calendar.brand || "CP").slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="portalBrandDetails">
              <h1>{calendar.title || calendar.brand}</h1>
              <p>
                <span>{calendar.month}</span>
                <span>•</span>
                <span>{items.length} {items.length === 1 ? "publicação" : "publicações"}</span>
                {calendar.status === "approved" && (
                  <span className="portalHeaderStatus approved">Aprovado</span>
                )}
              </p>
            </div>
          </div>

          {/* Abas: Feed Instagram x Cards Detalhados */}
          <div className="portalNavTabs">
            <button
              type="button"
              className={`portalNavBtn ${activeTab === "feed" ? "active" : ""}`}
              onClick={() => setActiveTab("feed")}
            >
              <Layers size={14} />
              <span>Simulação de Feeds</span>
            </button>
            <button
              type="button"
              className={`portalNavBtn ${activeTab === "details" ? "active" : ""}`}
              onClick={() => setActiveTab("details")}
            >
              <MessageSquare size={14} />
              <span>Detalhes & Comentários</span>
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="portalMain">
        {/* Banner informativo */}
        <div className="portalFeedbackBanner approved_with_notes">
          <strong>Área de Validação do Cliente</strong>
          <p>
            Confira a simulação de feed de cada perfil abaixo. Clique em qualquer postagem para
            visualizar os textos completos ou deixar comentários com pedidos de ajuste. Ao final da
            página, selecione a opção de aprovação.
          </p>
        </div>

        {/* 1. SEÇÃO DE FEEDS POR PERFIL (GRADE INSTAGRAM) */}
        {activeTab === "feed" ? (
          <section className="profileFeedsSection">
            {profileList.map((profileHandle) => {
              const profilePosts = postsByProfile[profileHandle] || [];

              return (
                <div key={profileHandle} className="profileFeedWrapper">
                  {/* Cabeçalho do Perfil Instagram */}
                  <div className="instagramProfileHeader">
                    <div className="instagramProfileInfo">
                      <div className="instagramProfileAvatar">
                        {profileHandle.replace(/^@/, "").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="instagramProfileMeta">
                        <h2>
                          <span>{profileHandle}</span>
                          <CheckCircle size={15} className="instagramVerifiedBadge" />
                        </h2>
                        <p>{calendar.brand} • Planejamento Editorial {calendar.month}</p>
                      </div>
                    </div>
                    <div className="instagramProfileStats">
                      <div className="instagramStatItem">
                        <strong>{profilePosts.length}</strong>
                        <span>Posts</span>
                      </div>
                      <div className="instagramStatItem">
                        <strong>Grade</strong>
                        <span>Feed</span>
                      </div>
                    </div>
                  </div>

                  {/* Grade 3x3 do Instagram */}
                  <div className="instagramGrid">
                    {profilePosts.map((post) => {
                      const thumb =
                        post.imageUrl ||
                        (post as any).image_url ||
                        post.storyUrl ||
                        (post as any).story_url ||
                        null;
                      const hasComment = Boolean(postComments[post.id]?.trim());

                      return (
                        <div
                          key={post.id}
                          className="instagramGridItem"
                          onClick={() => scrollToPostCard(post.id)}
                          title="Clique para ver detalhes e comentar"
                        >
                          {thumb ? (
                            <img src={thumb} alt={post.title} loading="lazy" />
                          ) : (
                            <div className="instagramGridNoImage">
                              {getFormatIcon(post.type)}
                              <p>{post.head || post.title}</p>
                            </div>
                          )}

                          {/* Badges superiores (Formato / Collab) */}
                          <div className="instagramGridBadges">
                            {post.isCollab && (
                              <span className="instagramGridBadge collab" title={`Collab com ${post.collabProfile || "Parceiro"}`}>
                                Collab
                              </span>
                            )}
                            {hasComment && (
                              <span
                                className="instagramGridBadge"
                                style={{ background: "#d97706" }}
                                title="Comentário adicionado"
                              >
                                <MessageSquare size={10} />
                              </span>
                            )}
                          </div>

                          {/* Overlay com data e título ao passar o mouse */}
                          <div className="instagramGridOverlay">
                            <span className="date">{formatDateLabel(post.date)}</span>
                            <strong>{post.title || "Ver Publicação"}</strong>
                            <span style={{ fontSize: 10, opacity: 0.9 }}>Clique para comentar</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>
        ) : null}

        {/* 2. CARDS DETALHADOS COM CAMPOS DE COMENTÁRIO POR POST */}
        <section
          className="detailedCardsSection"
          style={{ display: activeTab === "details" ? "flex" : "none" }}
        >
          {items.map((post, idx) => {
            const thumb =
              post.imageUrl ||
              (post as any).image_url ||
              post.storyUrl ||
              (post as any).story_url ||
              null;
            const currentComment = postComments[post.id] || "";
            const isSaved = savedCommentState[post.id];

            return (
              <article
                key={post.id}
                id={`post-detail-${post.id}`}
                className="postDetailCard"
              >
                {/* Header do Card */}
                <div className="postDetailHeader">
                  <div className="postDetailMeta">
                    <span className="postDateTag">
                      Post #{String(idx + 1).padStart(2, "0")} • {formatDateLabel(post.date)}
                    </span>
                    <span className="postFormatTag">
                      {getFormatIcon(post.type)}
                      <span>{post.type}</span>
                    </span>
                    {post.profile && (
                      <span className="postProfileTag">
                        {post.profile}
                        {post.isCollab && post.collabProfile && (
                          <span> + {post.collabProfile} (Collab)</span>
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {/* Corpo do Card: Copy à esquerda, Arte à direita */}
                <div className="postDetailBody">
                  <div className="postDetailCopyCol">
                    <div className="postHeadBox">
                      <h3>{post.head || post.title || "Publicação"}</h3>
                      {post.subhead && <p>{post.subhead}</p>}
                    </div>

                    <div className="postCaptionBox">
                      <strong>Legenda da Publicação:</strong>
                      <p>{post.caption || "Sem legenda cadastrada para esta publicação."}</p>
                      {post.hashtags && <div className="postHashtags">{post.hashtags}</div>}
                    </div>

                    {post.cta && (
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        <strong>Chamada para Ação (CTA):</strong> {post.cta}
                      </div>
                    )}
                  </div>

                  {/* Coluna de Mídia */}
                  <div className="postMediaCol">
                    {thumb ? (
                      <div className="postMediaPreview">
                        <img src={thumb} alt={post.title} />
                      </div>
                    ) : (
                      <div className="postMediaEmpty">
                        {getFormatIcon(post.type)}
                        <p style={{ margin: "6px 0 0" }}>Arte em processo de finalização.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* ÁREA DE COMENTÁRIO INDIVIDUAL DO CLIENTE PARA ESTE POST */}
                <div className="postCommentBox">
                  <div className="postCommentLabel">
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <MessageSquare size={13} />
                      <span>Comentário ou pedido de ajuste para este post:</span>
                    </span>
                    {isSaved && (
                      <span style={{ color: "#059669", fontSize: 11, display: "inline-flex", alignItems: "center", gap: 3 }}>
                        <Check size={12} /> Gravado
                      </span>
                    )}
                  </div>
                  <textarea
                    className="postCommentInput"
                    placeholder="Escreva aqui caso queira alterações específicas neste post (copy, arte, legenda)..."
                    value={currentComment}
                    onChange={(e) => handleCommentChange(post.id, e.target.value)}
                    onBlur={() => handleSaveIndividualComment(post.id)}
                    rows={2}
                  />
                </div>
              </article>
            );
          })}
        </section>
      </main>

      {/* =========================================================
          BARRA DE APROVAÇÃO INFERIOR
          "abaixo de tudo, precisamos um botão pra aprovar, e duas frases clicaveis :
           aprovar com ressalvas ou reprovar com resalvas"
          ========================================================= */}
      <footer className="portalBottomApprovalBar">
        <div className="portalBottomApprovalInner">
          {/* Botão principal de aprovação */}
          <button
            type="button"
            className="portalApproveFullBtn"
            onClick={handleDirectApproval}
            disabled={submitting}
          >
            <CheckCircle size={18} />
            <span>Aprovar Calendário Completo</span>
          </button>

          {/* Duas frases clicáveis */}
          <div className="portalApprovalPhrases">
            <button
              type="button"
              className="portalPhraseBtn approveNotes"
              onClick={() =>
                setHijackModal({ open: true, type: "approve_with_notes" })
              }
            >
              Aprovar com ressalvas
            </button>
            <button
              type="button"
              className="portalPhraseBtn rejectNotes"
              onClick={() =>
                setHijackModal({ open: true, type: "reject_with_notes" })
              }
            >
              Reprovar com ressalvas
            </button>
          </div>
        </div>
      </footer>

      {/* =========================================================
          MODAL DE SEQUESTRO DE TELA PARA RESSALVAS
          "quando tiver ressalva, aprovando ou reprovando, é pra sequestrar a tela
           com um modal com um campo de texto no centro da tela pra que o feedback seja escrito"
          ========================================================= */}
      {hijackModal.open && (
        <div
          className="screenHijackModalOverlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setHijackModal({ open: false, type: null });
            }
          }}
        >
          <div className="screenHijackCard">
            <div className="screenHijackHeader">
              <span
                className={`screenHijackBadge ${
                  hijackModal.type === "approve_with_notes"
                    ? "approveNotes"
                    : "rejectNotes"
                }`}
              >
                {hijackModal.type === "approve_with_notes"
                  ? "Aprovação Condicionada"
                  : "Reprovação para Ajustes"}
              </span>
              <h2>
                {hijackModal.type === "approve_with_notes"
                  ? "Aprovar com Ressalvas"
                  : "Reprovar com Ressalvas"}
              </h2>
              <p>
                {hijackModal.type === "approve_with_notes"
                  ? "O planejamento será aprovado, mas a equipe receberá suas observações para providenciar os ajustes indicados antes das postagens."
                  : "O planejamento será devolvido à equipe de criação para correção com base nas alterações apontadas abaixo."}
              </p>
            </div>

            <div className="screenHijackBody">
              <label htmlFor="hijackFeedbackInput">
                Observações e Ressalvas Gerais (obrigatório):
              </label>
              <textarea
                id="hijackFeedbackInput"
                className="screenHijackTextarea"
                rows={6}
                placeholder="Descreva detalhadamente o que precisa ser ajustado, corrigido ou alinhado pela equipe..."
                value={generalFeedback}
                onChange={(e) => setGeneralFeedback(e.target.value)}
                autoFocus
              />
            </div>

            <div className="screenHijackFooter">
              <button
                type="button"
                className="screenHijackCancelBtn"
                onClick={() => setHijackModal({ open: false, type: null })}
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`screenHijackSubmitBtn ${
                  hijackModal.type === "approve_with_notes"
                    ? "approveNotes"
                    : "rejectNotes"
                }`}
                onClick={handleConfirmHijackReview}
                disabled={submitting}
              >
                <Send size={14} />
                <span>
                  {submitting
                    ? "Enviando..."
                    : hijackModal.type === "approve_with_notes"
                    ? "Confirmar Aprovação com Ressalvas"
                    : "Confirmar Reprovação com Ressalvas"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
