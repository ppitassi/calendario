import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton } from './ui/IconButton/IconButton';
import styles from './Lightbox.module.css';

export function Lightbox({ 
    images, 
    initialIndex = 0, 
    isOpen, 
    onClose 
}: { 
    images: string[], 
    initialIndex?: number, 
    isOpen: boolean, 
    onClose: () => void 
}) {
    const [currentIndex, setCurrentIndex] = React.useState(initialIndex);

    React.useEffect(() => {
        if (isOpen) {
            setCurrentIndex(initialIndex);
        }
    }, [isOpen, initialIndex]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true" aria-label="Visualização de imagens">
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
                                onClick={(e) => { e.stopPropagation(); setCurrentIndex((prev) => prev > 0 ? prev - 1 : images.length - 1); }}
                                className={styles.previousButton}
                                variant="glass"
                                size="large"
                            >
                                <ChevronLeft />
                            </IconButton>
                            <IconButton
                                label="Próxima imagem"
                                onClick={(e) => { e.stopPropagation(); setCurrentIndex((prev) => prev < images.length - 1 ? prev + 1 : 0); }}
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
                    />
                </div>
            )}
        </AnimatePresence>
    );
}
