/** Modal que amplia mídias e oferece navegação circular por mouse ou teclado. */

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "../ui/IconButton/IconButton";
import styles from "./Lightbox.module.css";

/** Mantém o índice local enquanto o chamador controla abertura e fechamento. */
export function Lightbox({
  images,
  initialIndex = 0,
  isOpen,
  onClose,
}: {
  images: string[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = React.useState(initialIndex);

  // Ao abrir ou trocar o índice inicial, reposiciona a galeria na mídia solicitada.
  React.useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
    }
  }, [isOpen, initialIndex]);

  // Enquanto aberto, Esc fecha e as setas navegam; o cleanup remove o listener global.
  React.useEffect(() => {
    if (!isOpen) return;
    /** Traduz as teclas de navegação em fechamento ou mudança circular de índice. */
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && images.length > 1) {
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
      }
      if (e.key === "ArrowRight" && images.length > 1) {
        setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, images.length, onClose]);

  // Não mantém backdrop invisível nem controles focáveis quando está fechado.
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {/* UI: clicar no backdrop fecha; clicar em controles ou imagem interrompe a propagação. */}
      {isOpen && (
        <div
          className={styles.backdrop}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Visualização de imagens"
        >
          <IconButton
            label="Fechar visualização"
            onClick={onClose}
            className={styles.closeButton}
            variant="glass"
          >
            <X />
          </IconButton>

          {images.length > 1 && (
            <>
              <IconButton
                label="Imagem anterior"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex((prev) =>
                    prev > 0 ? prev - 1 : images.length - 1
                  );
                }}
                className={styles.previousButton}
                variant="glass"
                size="large"
              >
                <ChevronLeft />
              </IconButton>
              <IconButton
                label="Próxima imagem"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex((prev) =>
                    prev < images.length - 1 ? prev + 1 : 0
                  );
                }}
                className={styles.nextButton}
                variant="glass"
                size="large"
              >
                <ChevronRight />
              </IconButton>
            </>
          )}

          <motion.img
            key={currentIndex}
            src={images[currentIndex]}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={styles.image}
            onClick={(e) => e.stopPropagation()}
            alt={`Mídia ${currentIndex + 1}`}
          />
        </div>
      )}
    </AnimatePresence>
  );
}
