"use client";
/**
 * Simulador visual do Instagram com suporte aos 4 modos:
 * 1. Feed (rolagem real do feed com cabeçalho, botões de ação e legenda)
 * 2. Story (formato 9:16 com barra de progresso, topo e interação)
 * 3. Reels (formato 9:16 com barra vertical lateral de engajamento)
 * 4. Carrossel (multi-slides com setas, indicadores de ponto e contador)
 */

import { useState, useEffect } from "react";
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Music2,
  Share2,
  Smile,
  Image as ImageIcon,
  Layers,
  Smartphone,
  Video,
  Grid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContentItem } from "@/lib/types";
import styles from "./InstagramMockup.module.css";

export type PreviewMode = "feed" | "story" | "reels" | "carousel";

interface InstagramMockupProps {
  post: ContentItem;
  brand?: string;
  defaultMode?: PreviewMode;
  allowModeSwitch?: boolean;
  className?: string;
  onImageClick?: (url: string) => void;
}

export function InstagramMockup({
  post,
  brand = "Marca",
  defaultMode,
  allowModeSwitch = true,
  className,
  onImageClick,
}: InstagramMockupProps) {
  // Determina o modo padrão a partir do tipo do post se não especificado
  const initialMode = (): PreviewMode => {
    if (defaultMode) return defaultMode;
    const type = (post.type || "").toLowerCase();
    if (type.includes("story") || type.includes("stories")) return "story";
    return "feed";
  };

  const [activeMode, setActiveMode] = useState<PreviewMode>(initialMode());
  const [slideIndex, setSlideIndex] = useState(0);
  const [imgError, setImgError] = useState(false);

  // Atualiza modo quando o post muda
  useEffect(() => {
    setActiveMode(initialMode());
    setImgError(false);
    setSlideIndex(0);
  }, [post.id, post.type]);

  // Recupera imagens (seja única ou array de slides)
  const mainImage = post.imageUrl || (post as any).image_url || (post as any).imageurl || "";
  const allImages: string[] = (post as any).images?.length
    ? ((post as any).images as string[])
    : mainImage
    ? [mainImage]
    : [];

  const currentImage = allImages[slideIndex] || mainImage;
  const profileName = post.profile || brand || "Instagram";
  const avatarText = profileName.replace(/^@/, "").slice(0, 2).toUpperCase();

  const handleNextSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (allImages.length > 1) {
      setSlideIndex((prev) => (prev + 1) % allImages.length);
    }
  };

  const handlePrevSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (allImages.length > 1) {
      setSlideIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));
    }
  };

  return (
    <div className={cn(styles.wrapper, className)}>
      {/* Barra de alternância livre dos 4 modos */}
      {allowModeSwitch && (
        <div className={styles.modeTabs} role="tablist" aria-label="Modo de visualização Instagram">
          <button
            type="button"
            role="tab"
            aria-selected={activeMode === "feed"}
            className={cn(styles.modeBtn, activeMode === "feed" && styles.modeBtnActive)}
            onClick={() => setActiveMode("feed")}
            title="Visualização no Feed do Instagram"
          >
            <Grid size={13} />
            <span>Feed</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeMode === "story"}
            className={cn(styles.modeBtn, activeMode === "story" && styles.modeBtnActive)}
            onClick={() => setActiveMode("story")}
            title="Visualização em Story (9:16)"
          >
            <Smartphone size={13} />
            <span>Story</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeMode === "reels"}
            className={cn(styles.modeBtn, activeMode === "reels" && styles.modeBtnActive)}
            onClick={() => setActiveMode("reels")}
            title="Visualização em Reels"
          >
            <Video size={13} />
            <span>Reels</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeMode === "carousel"}
            className={cn(styles.modeBtn, activeMode === "carousel" && styles.modeBtnActive)}
            onClick={() => setActiveMode("carousel")}
            title="Visualização em Carrossel"
          >
            <Layers size={13} />
            <span>Carrossel</span>
          </button>
        </div>
      )}

      {/* RENDERIZADOR DO MOCKUP CONFORME O MODO ATIVO */}
      <div className={styles.phoneFrame}>
        {/* ===================== 1. MODO STORY ===================== */}
        {activeMode === "story" && (
          <div className={styles.storyContainer}>
            {/* Barra de progresso no topo */}
            <div className={styles.storyProgressBars}>
              <div className={cn(styles.storyProgressBar, styles.storyProgressBarActive)} />
              {allImages.length > 1 &&
                allImages.slice(1).map((_: string, i: number) => (
                  <div key={i} className={styles.storyProgressBar} />
                ))}
            </div>

            {/* Topo: avatar, nome e tempo */}
            <div className={styles.storyHeader}>
              <div className={styles.storyProfile}>
                <div className={styles.storyAvatar}>{avatarText}</div>
                <span className={styles.storyUsername}>{profileName}</span>
                <span className={styles.storyTime}>2 h</span>
              </div>
              <MoreHorizontal size={18} className={styles.storyDots} />
            </div>

            {/* Mídia Story 9:16 */}
            <div
              className={styles.storyMedia}
              onClick={() => onImageClick?.(currentImage)}
            >
              {currentImage && !imgError ? (
                <img
                  src={currentImage}
                  alt={post.title}
                  className={styles.storyImage}
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className={styles.emptyStoryMedia}>
                  <Smartphone size={36} />
                  <strong>Arte Story 9:16</strong>
                  <small>Sem mídia anexada para este post</small>
                </div>
              )}
            </div>

            {/* Rodapé Story: Enviar mensagem / Reação */}
            <div className={styles.storyFooter}>
              <div className={styles.storyReplyInput}>
                <span>Enviar mensagem...</span>
                <Smile size={16} />
              </div>
              <div className={styles.storyIcons}>
                <Heart size={20} />
                <Send size={18} />
              </div>
            </div>
          </div>
        )}

        {/* ===================== 2. MODO REELS ===================== */}
        {activeMode === "reels" && (
          <div className={styles.reelsContainer}>
            {/* Topo discreto */}
            <div className={styles.reelsHeader}>
              <span className={styles.reelsTitle}>Reels</span>
            </div>

            {/* Mídia Reels 9:16 */}
            <div
              className={styles.reelsMedia}
              onClick={() => onImageClick?.(currentImage)}
            >
              {currentImage && !imgError ? (
                <img
                  src={currentImage}
                  alt={post.title}
                  className={styles.reelsImage}
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className={styles.emptyReelsMedia}>
                  <Video size={36} />
                  <strong>Reels Vertical</strong>
                  <small>Sem mídia em vídeo/arte 9:16</small>
                </div>
              )}
            </div>

            {/* Barra lateral de ações à direita (curtir, comentar, enviar, áudio) */}
            <div className={styles.reelsSidebar}>
              <div className={styles.reelsActionBtn}>
                <Heart size={22} />
                <span>1.4k</span>
              </div>
              <div className={styles.reelsActionBtn}>
                <MessageCircle size={22} />
                <span>48</span>
              </div>
              <div className={styles.reelsActionBtn}>
                <Share2 size={22} />
                <span>Enviar</span>
              </div>
              <div className={styles.reelsActionBtn}>
                <MoreHorizontal size={20} />
              </div>
              <div className={styles.reelsAudioDisc}>
                <Music2 size={13} />
              </div>
            </div>

            {/* Rodapé Reels com perfil, áudio e copy truncada */}
            <div className={styles.reelsFooter}>
              <div className={styles.reelsProfileRow}>
                <div className={styles.reelsAvatar}>{avatarText}</div>
                <strong>{profileName}</strong>
                <button type="button" className={styles.reelsFollowBtn}>Seguir</button>
              </div>
              <p className={styles.reelsCaption}>
                <strong>{post.head || post.title}</strong> — {post.caption || "Legenda do reels..."}
              </p>
              <div className={styles.reelsAudioRow}>
                <Music2 size={12} />
                <span>{brand} • Áudio original</span>
              </div>
            </div>
          </div>
        )}

        {/* ===================== 3. MODO CARROSSEL ===================== */}
        {activeMode === "carousel" && (
          <article className={styles.feedCard}>
            {/* Header com avatar e perfil */}
            <header className={styles.feedHeader}>
              <div className={styles.feedAvatar}>{avatarText}</div>
              <div className={styles.feedHeaderText}>
                <strong>{profileName}</strong>
                <small>{post.isCollab ? "Colaboração" : "Publicação"} · Instagram</small>
              </div>
              <MoreHorizontal size={16} />
            </header>

            {/* Mídia do carrossel com controles de navegação e contador de páginas */}
            <div
              className={styles.carouselMedia}
              onClick={() => onImageClick?.(currentImage)}
            >
              {allImages.length > 1 && (
                <div className={styles.carouselCounter}>
                  {slideIndex + 1}/{allImages.length}
                </div>
              )}

              {currentImage && !imgError ? (
                <img
                  src={currentImage}
                  alt={`Slide ${slideIndex + 1}`}
                  className={styles.carouselImage}
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className={styles.emptyFeedMedia}>
                  <Layers size={32} />
                  <span>{imgError ? "Falha ao carregar arte" : "Carrossel Instagram"}</span>
                  <small>Slide {slideIndex + 1} de {Math.max(1, allImages.length)}</small>
                </div>
              )}

              {/* Setas de navegação de slide se houver mais de uma imagem */}
              {allImages.length > 1 && (
                <>
                  <button
                    type="button"
                    className={cn(styles.slideNavBtn, styles.slideNavPrev)}
                    onClick={handlePrevSlide}
                    aria-label="Slide anterior"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    className={cn(styles.slideNavBtn, styles.slideNavNext)}
                    onClick={handleNextSlide}
                    aria-label="Próximo slide"
                  >
                    <ChevronRight size={16} />
                  </button>
                </>
              )}
            </div>

            {/* Barra de ações e paginação por bolinhas */}
            <div className={styles.carouselActionRow}>
              <div className={styles.feedActions}>
                <Heart size={18} />
                <MessageCircle size={18} />
                <Send size={18} />
              </div>

              {allImages.length > 1 && (
                <div className={styles.carouselDots}>
                  {allImages.map((_: string, i: number) => (
                    <span
                      key={i}
                      className={cn(styles.carouselDot, i === slideIndex && styles.carouselDotActive)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSlideIndex(i);
                      }}
                    />
                  ))}
                </div>
              )}

              <div className={styles.feedActionsRight}>
                <Bookmark size={18} />
              </div>
            </div>

            {/* Legenda e texto do post */}
            <div className={styles.feedCopy}>
              <p>
                <strong>{profileName}</strong> {post.head || post.title}
              </p>
              {post.caption && <p className={styles.feedCaptionText}>{post.caption}</p>}
              {post.cta && <em className={styles.feedCta}>{post.cta}</em>}
              {post.hashtags && <code className={styles.feedHashtags}>{post.hashtags}</code>}
            </div>
          </article>
        )}

        {/* ===================== 4. MODO FEED (PADRÃO) ===================== */}
        {activeMode === "feed" && (
          <article className={styles.feedCard}>
            {/* Header da publicação no feed */}
            <header className={styles.feedHeader}>
              {post.isCollab && post.collabProfile ? (
                <div className={styles.feedCollabAvatars}>
                  <div className={cn(styles.feedAvatar, styles.avatarPrimary)}>{avatarText}</div>
                  <div className={cn(styles.feedAvatar, styles.avatarSecondary)}>
                    {post.collabProfile.replace(/^@/, "").slice(0, 2).toUpperCase()}
                  </div>
                </div>
              ) : (
                <div className={styles.feedAvatar}>{avatarText}</div>
              )}
              <div className={styles.feedHeaderText}>
                <strong>
                  {post.isCollab && post.collabProfile
                    ? `${profileName} e ${post.collabProfile}`
                    : profileName}
                </strong>
                <small>{post.isCollab ? "Colaboração" : "Publicação"} · Instagram</small>
              </div>
              <MoreHorizontal size={16} />
            </header>

            {/* Arte do post no feed 1:1 */}
            <div
              className={styles.feedMedia}
              onClick={() => onImageClick?.(currentImage)}
            >
              {currentImage && !imgError ? (
                <img
                  src={currentImage}
                  alt={post.title}
                  className={styles.feedRealImg}
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className={styles.emptyFeedMedia}>
                  <ImageIcon size={32} />
                  <span>{imgError ? "Falha ao exibir imagem" : "Nenhuma mídia enviada"}</span>
                  <small>{imgError ? "Verifique a URL da arte" : "Anexe arte no editor"}</small>
                </div>
              )}
            </div>

            {/* Botões de interação do feed */}
            <div className={styles.feedActionRow}>
              <div className={styles.feedActions}>
                <Heart size={18} />
                <MessageCircle size={18} />
                <Send size={18} />
              </div>
              <div className={styles.feedActionsRight}>
                <Bookmark size={18} />
              </div>
            </div>

            {/* Legenda com perfil, título, copy e tags */}
            <div className={styles.feedCopy}>
              <p>
                <strong>{profileName}</strong> {post.head || post.title}
              </p>
              {post.caption && <p className={styles.feedCaptionText}>{post.caption}</p>}
              {post.cta && <em className={styles.feedCta}>{post.cta}</em>}
              {post.hashtags && <code className={styles.feedHashtags}>{post.hashtags}</code>}
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
