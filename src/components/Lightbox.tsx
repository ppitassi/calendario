import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

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
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4 lg:p-12" onClick={onClose}>
                    <button 
                        onClick={onClose}
                        className="absolute top-6 right-6 p-3 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors z-[201]"
                    >
                        <X className="w-6 h-6" />
                    </button>

                    {images.length > 1 && (
                        <>
                            <button 
                                onClick={(e) => { e.stopPropagation(); setCurrentIndex((prev) => prev > 0 ? prev - 1 : images.length - 1); }}
                                className="absolute left-6 top-1/2 -translate-y-1/2 p-4 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors z-[201]"
                            >
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); setCurrentIndex((prev) => prev < images.length - 1 ? prev + 1 : 0); }}
                                className="absolute right-6 top-1/2 -translate-y-1/2 p-4 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors z-[201]"
                            >
                                <ChevronRight className="w-6 h-6" />
                            </button>
                        </>
                    )}

                    <motion.img 
                        key={currentIndex}
                        src={images[currentIndex]} 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="max-w-full max-h-full object-contain cursor-default"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </AnimatePresence>
    );
}
