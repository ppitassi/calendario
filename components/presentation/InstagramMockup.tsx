"use client";
/**
 * Componente de Prévia Inteligente do Instagram:
 * Renderiza rigorosamente conforme o tipo da publicação:
 * - "Feed": Prévia do post no Feed do Instagram
 * - "Story": Prévia vertical (9:16) do Story
 * - "Reels": Prévia de vídeo/arte vertical (9:16) do Reels
 * - "Carrossel": Prévia com navegação de lâminas/slides
 * - "Feed e Story": Prévia dupla com setinha/toggle para alternar entre Feed e Story
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
  Layers,
  Smartphone,
  Video,
  CloudDownload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContentItem } from "@/lib/types";
import styles from "./InstagramMockup.module.css";

interface InstagramMockupProps {
  post: ContentItem;
  brand?: string;
  className?: string;
  activeTab?: "feed" | "story";
  onTabChange?: (tab: "feed" | "story") => void;
  onImportMedia?: (slot: "feed" | "story") => void;
  onImageClick?: (url: string) => void;
}

export function InstagramMockup({
  post,
  brand = "Marca",
  className,
  activeTab,
  onTabChange,
  onImportMedia,
  onImageClick,
}: InstagramMockupProps) {
  const normType = (post.type || "Feed e Story").toLowerCase();
  const isFeedAndStory = normType === "feed e story" || (!["feed", "story", "stories", "carrossel", "carousel", "reels", "reel"].includes(normType));
  const isStoryOnly = normType === "story" || normType === "stories";
  const isReels = normType === "reels" || normType === "reel" || normType === "video" || normType === "vídeo";
  const isCarousel = normType === "carrossel" || normType === "carousel";

  // Se for "Feed e Story", permite passar pro lado (feed <-> story)
  const [internalDualViewMode, setInternalDualViewMode] = useState<"feed" | "story">("feed");
  const dualViewMode = activeTab || internalDualViewMode;
  const setDualViewMode = (newMode: "feed" | "story") => {
    setInternalDualViewMode(newMode);
    onTabChange?.(newMode);
  };

  const [slideIndex, setSlideIndex] = useState(0);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (!activeTab) setInternalDualViewMode("feed");
    setImgError(false);
    setSlideIndex(0);
  }, [post.id, post.type, activeTab]);

  // Determina qual layout renderizar
  const currentRenderMode = isFeedAndStory
    ? dualViewMode
    : isStoryOnly
    ? "story"
    : isReels
    ? "reels"
    : isCarousel
    ? "carousel"
    : "feed";

  const feedImage = post.imageUrl || (post as any).image_url || (post as any).imageurl || "";
  const storyImage = post.storyUrl || (post as any).story_url || (post as any).storyurl || "";
  const mainImage = currentRenderMode === "story" ? storyImage : feedImage;

  const allImages: string[] = (post as any).images?.length
    ? ((post as any).images as string[])
    : feedImage
    ? [feedImage]
    : [];

  const currentImage = allImages[slideIndex] || feedImage;
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

  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);

  return (
    <div className={cn(styles.wrapper, className)}>
      {/* SE FOR "FEED E STORY": barra de navegação com abas para passar pro lado */}
      {isFeedAndStory && (
        <div className={styles.dualToggleBar}>
          <button
            type="button"
            className={cn(styles.dualTabBtn, dualViewMode === "feed" && styles.dualActiveTab)}
            onClick={() => setDualViewMode("feed")}
            title="Exibir arte do Feed"
          >
            <span>Feed</span>
            <span className={styles.tabStatusDot}>
              {feedImage ? "✓" : "○"}
            </span>
          </button>

          <span className={styles.dualDivider}>|</span>

          <button
            type="button"
            className={cn(styles.dualTabBtn, dualViewMode === "story" && styles.dualActiveTab)}
            onClick={() => setDualViewMode("story")}
            title="Exibir arte do Story"
          >
            <span>Story</span>
            <span className={styles.tabStatusDot}>
              {storyImage ? "✓" : "○"}
            </span>
          </button>
        </div>
      )}

      <div className={cn(styles.phoneFrame, currentRenderMode === "story" ? styles.phoneFrameStory : styles.phoneFrameFeed)}>
        {/* ===================== 1. MODO STORY ===================== */}
        {currentRenderMode === "story" && (
          <div className={styles.storyContainer}>
            {/* Barra de progresso no topo */}
            <div className={styles.storyProgressBars}>
              <div className={cn(styles.storyProgressBar, styles.storyProgressBarActive)} />
            </div>

            {/* Topo do Story: avatar, perfil e tempo */}
            <div className={styles.storyHeader}>
              <div className={styles.storyProfile}>
                <div className={styles.storyAvatar}>{avatarText}</div>
                <span className={styles.storyUsername}>{profileName}</span>
                <span className={styles.storyTime}>2 h</span>
              </div>
              <MoreHorizontal size={18} className={styles.storyDots} />
            </div>

            {/* Mídia do Story 9:16 */}
            <div
              className={styles.storyMedia}
              onClick={() => onImageClick?.(mainImage)}
            >
              {mainImage && !imgError ? (
                <img
                  src={mainImage}
                  alt={post.title}
                  className={styles.storyImage}
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className={styles.emptyStoryMedia}>
                  <Smartphone size={32} opacity={0.6} />
                  <strong>Nenhuma arte de Story</strong>
                  <small>1080 × 1920</small>
                  {onImportMedia && (
                    <button
                      type="button"
                      className={styles.emptySlotBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        onImportMedia("story");
                      }}
                    >
                      <CloudDownload size={14} />
                      <span>Puxar do Nextcloud</span>
                    </button>
                  )}
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
        {currentRenderMode === "reels" && (
          <div className={styles.reelsContainer}>
            <div className={styles.reelsHeader}>
              <span className={styles.reelsTitle}>Reels</span>
            </div>

            <div
              className={styles.reelsMedia}
              onClick={() => onImageClick?.(mainImage)}
            >
              {mainImage && !imgError ? (
                <img
                  src={mainImage}
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

            <div className={styles.reelsFooter}>
              <div className={styles.reelsProfileRow}>
                <div className={styles.reelsAvatar}>{avatarText}</div>
                <strong>{profileName}</strong>
                <button type="button" className={styles.reelsFollowBtn}>Seguir</button>
              </div>
              {post.caption && (
                <p className={styles.reelsCaption}>
                  <strong>{profileName}</strong> — {post.caption}
                </p>
              )}
              <div className={styles.reelsAudioRow}>
                <Music2 size={12} />
                <span>{brand} • Áudio original</span>
              </div>
            </div>
          </div>
        )}

        {/* ===================== 3. MODO CARROSSEL ===================== */}
        {currentRenderMode === "carousel" && (
          <article className={styles.feedCard}>
            <header className={styles.feedHeader}>
              <div className={styles.feedAvatar}>{avatarText}</div>
              <div className={styles.feedHeaderText}>
                <strong>{profileName}</strong>
                <small>{post.isCollab ? "Colaboração" : "Carrossel"} · Instagram</small>
              </div>
              <MoreHorizontal size={16} />
            </header>

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

            <div className={styles.feedCopy}>
              {post.caption && (
                <p className={cn(styles.feedCaptionText, !isCaptionExpanded && styles.captionClamped)}>
                  <strong>{profileName}</strong>
                  {post.caption}
                </p>
              )}
              {post.caption && post.caption.length > 90 && (
                <button
                  type="button"
                  className={styles.expandCaptionBtn}
                  onClick={() => setIsCaptionExpanded(!isCaptionExpanded)}
                >
                  {isCaptionExpanded ? "menos" : "... mais"}
                </button>
              )}
              {post.cta && <em className={styles.feedCta}>{post.cta}</em>}
              {post.hashtags && <code className={styles.feedHashtags}>{post.hashtags}</code>}
            </div>
          </article>
        )}

        {/* ===================== 4. MODO FEED ===================== */}
        {currentRenderMode === "feed" && (
          <article className={styles.feedCard}>
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

            <div
              className={styles.feedMedia}
              onClick={() => onImageClick?.(mainImage)}
            >
              {mainImage && !imgError ? (
                <img
                  src={mainImage}
                  alt={post.title}
                  className={styles.feedRealImg}
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className={styles.emptyFeedMedia}>
                  <span>{imgError ? "Falha ao exibir imagem" : "Nenhuma arte de Feed"}</span>
                  <small>1080 × 1350</small>
                  {onImportMedia && (
                    <button
                      type="button"
                      className={styles.emptySlotBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        onImportMedia("feed");
                      }}
                    >
                      <CloudDownload size={14} />
                      <span>Puxar do Nextcloud</span>
                    </button>
                  )}
                </div>
              )}
            </div>

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

            <div className={styles.feedCopy}>
              {post.caption && (
                <p className={cn(styles.feedCaptionText, !isCaptionExpanded && styles.captionClamped)}>
                  <strong>{profileName}</strong>
                  {post.caption}
                </p>
              )}
              {post.caption && post.caption.length > 90 && (
                <button
                  type="button"
                  className={styles.expandCaptionBtn}
                  onClick={() => setIsCaptionExpanded(!isCaptionExpanded)}
                >
                  {isCaptionExpanded ? "menos" : "... mais"}
                </button>
              )}
              {post.cta && <em className={styles.feedCta}>{post.cta}</em>}
              {post.hashtags && <code className={styles.feedHashtags}>{post.hashtags}</code>}
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
