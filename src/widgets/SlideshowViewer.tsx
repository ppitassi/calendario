import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Image as ImageIcon
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Lightbox } from '../components/Lightbox';
import { IconButton } from '../components/ui/IconButton/IconButton';
import styles from './SlideshowViewer.module.css';

export function SlideshowViewer({ images, expandable = false }: { images: string[], expandable?: boolean }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Handle case where images length gets reduced
  useEffect(() => {
    if (images && currentIndex >= images.length) {
      setCurrentIndex(Math.max(0, images.length - 1));
    }
  }, [images?.length, currentIndex]);

  if (!images || images.length === 0) {
    return (
      <div className={styles.empty}>
         <ImageIcon />
         <p>Faça o upload de imagens abaixo para vê-las no carrossel.</p>
      </div>
    );
  }

  return (
    <>
      <div 
         className={cn(styles.root, expandable && styles.expandable)}
         onClick={() => { if(expandable) setLightboxOpen(true); }}
      >
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
            <div className={styles.previous} onClick={(e) => { e.stopPropagation(); setCurrentIndex(prev => prev === 0 ? images.length - 1 : prev - 1); }}>
               <IconButton
                  label="Imagem anterior"
                  variant="glass"
                >
                 <ChevronLeft />
               </IconButton>
            </div>
            <div className={styles.next} onClick={(e) => { e.stopPropagation(); setCurrentIndex(prev => prev === images.length - 1 ? 0 : prev + 1); }}>
               <IconButton
                  label="Próxima imagem"
                  variant="glass"
                >
                 <ChevronRight />
               </IconButton>
            </div>
            <div className={styles.dots} onClick={e => e.stopPropagation()}>
              {images.map((_, idx) => (
                /* style-architecture-button-exception: carousel position dots are a feature-specific selection control. */
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={idx === currentIndex ? `${styles.dot} ${styles.dotActive}` : styles.dot}
                  aria-label={`Go to slide ${idx + 1}`}
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
