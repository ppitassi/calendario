"use client";
/** Visualização isolada da mídia, sem repetir o texto editorial do post. */


import { useState, useEffect } from "react";
import {
  Image as ImageIcon,
  Clock,
  Layers,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import styles from "./PostPreviewVisualsOnly.module.css";

/** URLs, formato e ação opcional de ampliação aceitos pela prévia visual. */
interface PostPreviewVisualsOnlyProps {
  imageUrl?: string;
  type?: string;
  onClick?: () => void;
}

/** Preserva a proporção da arte ou mostra uma pendência específica do formato. */
export function PostPreviewVisualsOnly({
  imageUrl,
  type = "Feed e Story",
  onClick,
}: PostPreviewVisualsOnlyProps) {
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setLoadError(false);
  }, [imageUrl]);

  const normType = (type || "Feed e Story").toLowerCase();
  const isStory = normType === "story";

  // Define proporção, ícone e mensagem vazia para cada formato.
  let aspectClass = styles.aspectPost; // Feed e Feed e Story usam 1:1
  let placeholderTitle = "Aguardando Arte";
  let placeholderSubtitle = "Nenhuma mídia enviada para este post.";
  let Icon = ImageIcon;

  if (isStory) {
    aspectClass = styles.aspectVideo; // Story usa 9:16
    placeholderTitle = "Aguardando Story";
    placeholderSubtitle = "Nenhuma arte de Story enviada.";
    Icon = Clock;
  } else if (normType === "feed e story") {
    Icon = Layers;
    placeholderTitle = "Aguardando Arte";
    placeholderSubtitle = "Nenhuma mídia enviada para este post.";
  }

  // Sem arquivo ou em caso de erro, mantém a proporção final para a apresentação não saltar de layout.
  if (!imageUrl || loadError) {
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

  // Usa `contain` para preservar integralmente qualquer proporção suportada.
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
      <img
        src={imageUrl}
        alt="Arte"
        className={styles.image}
        onError={() => setLoadError(true)}
      />

      {/* UI: camada de foco e hover anuncia que a mídia pode ser ampliada. */}
      <div className={styles.overlay}>
        <div className={styles.expandLabel}>
          <Search /> Ampliar
        </div>
      </div>

      {/* UI: badge de formato para Story quando tiver imagem */}
      {isStory && (
        <div className={styles.storyBadge}>
          <Clock size={12} />
          <span>Story</span>
        </div>
      )}
    </div>
  );
}

