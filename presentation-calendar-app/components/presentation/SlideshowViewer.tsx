/** Navegação circular pelas lâminas de uma publicação, com ampliação opcional. */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight, LayoutTemplate } from "lucide-react";
import { cn } from "@/lib/utils";
import { Lightbox } from "./Lightbox";
import { IconButton } from "../ui/IconButton/IconButton";
import styles from "./SlideshowViewer.module.css";

/** Mantém o índice válido mesmo quando a lista de imagens muda. */
export function SlideshowViewer({
  images,
  expandable = false,
}: {
  images: string[];
  expandable?: boolean;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Se a lista encolher, limita o índice à última imagem ainda existente.
  useEffect(() => {
    if (images && currentIndex >= images.length) {
      setCurrentIndex(Math.max(0, images.length - 1));
    }
  }, [images?.length, currentIndex]);

  if (!images || images.length === 0) {
    return (
      <div className={styles.placeholder}>
        {/* UI: estado vazio preserva o espaço do carrossel até a primeira lâmina. */}
        <div className={styles.placeholderContent}>
          <div className={styles.iconCircle}>
            <LayoutTemplate className={styles.placeholderIcon} />
          </div>
          <strong className={styles.placeholderTitle}>Aguardando Carrossel</strong>
          <p className={styles.placeholderSubtitle}>
            Nenhuma lâmina enviada para este carrossel.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(styles.root, expandable && styles.expandable)}
        onClick={() => {
          if (expandable) setLightboxOpen(true);
        }}
      >
        {/* UI: a chave pelo índice força a transição animada entre as lâminas. */}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.img
            key={currentIndex}
            src={images[currentIndex]}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            alt={`Slide ${currentIndex + 1}`}
            className={styles.image}
          />
        </AnimatePresence>

        {images.length > 1 && (
          <>
            <div
              className={styles.previous}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex((prev) =>
                  prev === 0 ? images.length - 1 : prev - 1
                );
              }}
            >
              <IconButton label="Imagem anterior" variant="glass">
                <ChevronLeft />
              </IconButton>
            </div>
            <div
              className={styles.next}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex((prev) =>
                  prev === images.length - 1 ? 0 : prev + 1
                );
              }}
            >
              <IconButton label="Próxima imagem" variant="glass">
                <ChevronRight />
              </IconButton>
            </div>
            <div className={styles.dots} onClick={(e) => e.stopPropagation()}>
              {images.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={
                    idx === currentIndex
                      ? `${styles.dot} ${styles.dotActive}`
                      : styles.dot
                  }
                  aria-label={`Ir para slide ${idx + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <Lightbox
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        images={images}
        initialIndex={currentIndex}
      />
    </>
  );
}
