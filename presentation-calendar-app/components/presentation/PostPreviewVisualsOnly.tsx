"use client";
/** Visualização isolada da mídia, sem repetir o texto editorial do post. */


import { useState, useEffect } from "react";
import {
  Image as ImageIcon,
  LayoutTemplate,
  Film,
  Search,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import styles from "./PostPreviewVisualsOnly.module.css";

/** URLs, formato e ação opcional de ampliação aceitos pela prévia visual. */
interface PostPreviewVisualsOnlyProps {
  imageUrl?: string;
  videoUrl?: string;
  type?: string;
  carouselCount?: number;
  onClick?: () => void;
}

/** Preserva a proporção da arte ou mostra uma pendência específica do formato. */
export function PostPreviewVisualsOnly({
  imageUrl,
  videoUrl,
  type = "Feed",
  carouselCount = 1,
  onClick,
}: PostPreviewVisualsOnlyProps) {
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setLoadError(false);
  }, [imageUrl]);
  const normType = (type || "Feed").toLowerCase();
  const isVideo =
    normType.includes("reel") ||
    normType.includes("video") ||
    normType.includes("vídeo") ||
    normType.includes("story");
  const isCarousel =
    normType.includes("carrossel") || normType.includes("carousel");

  // Define proporção, ícone e mensagem vazia para post, carrossel, reel ou story.
  let aspectClass = styles.aspectPost;
  let placeholderTitle = "Aguardando Arte";
  let placeholderSubtitle = "Nenhuma mídia enviada para este post.";
  let Icon = ImageIcon;

  if (isVideo) {
    aspectClass = styles.aspectVideo;
    placeholderTitle = "Aguardando Vídeo";
    placeholderSubtitle = "Nenhum vídeo ou roteiro gravado enviado para este post.";
    Icon = Film;
  } else if (isCarousel) {
    aspectClass = styles.aspectCarousel;
    placeholderTitle = "Aguardando Carrossel";
    placeholderSubtitle = "Nenhuma lâmina enviada para este carrossel.";
    Icon = LayoutTemplate;
  }

  // Sem arquivo ou em caso de erro, mantém a proporção final para a apresentação não saltar de layout.
  if ((!imageUrl && !videoUrl) || loadError) {
    return (
      <div className={cn(styles.placeholder, aspectClass)}>
        {/* UI: ícone e mensagem explicam qual entrega de mídia ainda está pendente. */}
        <div className={styles.placeholderContent}>
          <div className={styles.iconCircle}>
            <Icon className={styles.placeholderIcon} />
          </div>
          <strong className={styles.placeholderTitle}>
            {loadError ? "Arte Indisponível" : placeholderTitle}
          </strong>
          <p className={styles.placeholderSubtitle}>
            {loadError ? "A imagem não pôde ser carregada do servidor." : placeholderSubtitle}
          </p>
        </div>
      </div>
    );
  }

  // Prioriza vídeo e usa `contain` para preservar integralmente qualquer proporção suportada.
  return (
    <div
      className={styles.preview}
      onClick={onClick}
      onKeyDown={(event) => {
        if (onClick && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onClick();
        }
      }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {videoUrl ? (
        <video
          src={videoUrl}
          controls
          preload="metadata"
          className={styles.video}
          onClick={(event) => event.stopPropagation()}
        />
      ) : (
        <img
          src={imageUrl}
          alt="Arte"
          className={styles.image}
          onError={() => setLoadError(true)}
        />
      )}

      {/* UI: camada de foco e hover anuncia que a mídia pode ser ampliada. */}
      <div className={styles.overlay}>
        <div className={styles.expandLabel}>
          <Search /> Ampliar
        </div>
      </div>

      {/* UI: indicadores específicos distinguem carrossel e vídeo de uma imagem simples. */}
      {isCarousel && carouselCount > 1 && (
        <div className={styles.carouselBadge}>
          <LayoutTemplate /> 1/{carouselCount}
        </div>
      )}

      {isVideo && (
        <div className={styles.videoPlayBadge}>
          <Play size={12} fill="#fff" />
          <span>Vídeo</span>
        </div>
      )}
    </div>
  );
}
