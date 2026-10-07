/** Cartão completo de uma publicação dentro do material de apresentação. */

import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowUpRight, Target, Image as ImageIcon, MessageSquare } from "lucide-react";
import type { ContentItem } from "@/lib/types";
import { InstagramMockup } from "./InstagramMockup";
import { Lightbox } from "./Lightbox";
import styles from "./PostPreview.module.css";

/** Combina briefing, copy, objetivo e arte e permite ampliar a mídia disponível. */
export function PostPreview({
  post,
  date,
  postTypeConfig,
  postNumber,
  clientMode = false,
  clientComment = "",
  onClientCommentChange,
  isPreCalendar = false,
}: {
  post: ContentItem;
  date: string;
  postTypeConfig?: any;
  postNumber: number;
  clientMode?: boolean;
  clientComment?: string;
  onClientCommentChange?: (comment: string) => void;
  isPreCalendar?: boolean;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const Icon = postTypeConfig?.icon || ImageIcon;
  const headline = post.head || post.title || "Sem título";
  const subhead = post.subhead;
  const caption = post.caption;
  const imgUrl = post.imageUrl || (post as any).image_url || (post as any).imageurl || "";
  const images = imgUrl ? [imgUrl] : [];

  return (
    <div className={styles.root}>
      {/* UI: cartão de apresentação dividido entre informação editorial e arte. */}
      <div className={styles.card}>
        <div className={styles.glow} />

        {/* UI: metadados, título, legenda, roteiro e objetivo ficam à esquerda da mídia. */}
        <div className={styles.content}>
          <div className={styles.overview}>
            <div className={styles.copy}>
              <div className={styles.metadata}>
                <div className={styles.postNumberGroup}>
                  <div className={styles.postNumber}>
                    Post {String(postNumber).padStart(2, "0")}
                  </div>
                  <div className={styles.postArrow}>
                    <ArrowUpRight />
                  </div>
                </div>
                <div className={styles.metaPill}>
                  {(() => {
                    try {
                      const d = new Date(date + "T12:00:00");
                      if (!isNaN(d.getTime())) {
                        return format(d, "dd MMM, yyyy", { locale: ptBR });
                      }
                    } catch {}
                    return date;
                  })()}
                </div>
                <div className={styles.metaPill}>
                  <Icon /> {postTypeConfig?.label || post.type}
                </div>
                {post.funnelStage && (
                  <div className={styles.funnelPill}>
                    Funil: {post.funnelStage}
                  </div>
                )}
                {isPreCalendar && (
                  <div
                    className={styles.funnelPill}
                    style={{
                      background: "rgba(59, 130, 246, 0.1)",
                      color: "#2563eb",
                      borderColor: "rgba(59, 130, 246, 0.25)",
                      fontWeight: 800,
                    }}
                  >
                    📝 Pré-Calendário: Copywriting
                  </div>
                )}
                {post.isCollab ? (
                  <div className={styles.funnelPill} style={{ background: "#fdf2f8", color: "#db2777", borderColor: "#fbcfe8" }}>
                    COLLAB: {post.profile || "Perfil A"} × {post.collabProfile || "Perfil B"}
                  </div>
                ) : post.profile ? (
                  <div className={styles.metaPill}>
                    {post.profile}
                  </div>
                ) : null}
              </div>

              <div className={styles.titleBlock}>
                <h1>{headline}</h1>
                {subhead && <h2>{subhead}</h2>}
              </div>

              <div className={styles.caption}>
                <p>
                  {caption || (
                    <span style={{ opacity: 0.4 }}>Nenhuma legenda informada.</span>
                  )}
                </p>
              </div>

              <div className={styles.details}>
                <div className={styles.objective}>
                  <div className={styles.objectiveIcon}>
                    <Target />
                  </div>
                  <div>
                    <span>Objetivo</span>
                    <strong>
                      {post.objective || "Construir relevância e autoridade"}
                    </strong>
                  </div>
                </div>
              </div>

              {clientMode && (
                <div className={styles.clientCommentBox}>
                  <div className={styles.clientCommentHeader}>
                    <MessageSquare size={13} />
                    <span>Comentário ou pedido de ajuste para este post:</span>
                  </div>
                  <textarea
                    className={styles.clientCommentInput}
                    value={clientComment || ""}
                    onChange={(e) => onClientCommentChange && onClientCommentChange(e.target.value)}
                    placeholder="Deixe observações ou solicite alterações para este texto..."
                    rows={2}
                  />
                </div>
              )}
            </div>

            {!isPreCalendar && (
              <div className={styles.visuals}>
                <InstagramMockup
                  post={post}
                  brand={post.profile || "Instagram"}
                  onImageClick={(url) => {
                    if (url) setLightboxOpen(true);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {!isPreCalendar && (
        <Lightbox
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          images={images}
        />
      )}
    </div>
  );
}
