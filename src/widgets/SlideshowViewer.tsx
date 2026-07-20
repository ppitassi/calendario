import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Image as ImageIcon
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Lightbox } from '../components/Lightbox';

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
      <div className="w-full aspect-[4/5] sm:aspect-square md:aspect-[4/5] rounded-[2rem] bg-black/5 dark:bg-white/5 border-2 border-dashed border-black/10 dark:border-white/10 flex flex-col items-center justify-center p-8 text-center text-foreground/60 dark:text-foreground/40 gap-4">
         <ImageIcon className="w-12 h-12 opacity-50" />
         <p className="text-sm font-medium">Faça o upload de imagens abaixo para vê-las no carrossel.</p>
      </div>
    );
  }

  return (
    <>
      <div 
         className={cn("relative w-full aspect-[4/5] sm:aspect-square md:aspect-[4/5] rounded-[2rem] overflow-hidden bg-black/5 border border-black/10 shadow-xl group", expandable && "cursor-pointer")}
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
            className="absolute inset-0 w-full h-full object-cover"
          />
        </AnimatePresence>
        
        {images.length > 1 && (
          <>
            <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center" onClick={(e) => { e.stopPropagation(); setCurrentIndex(prev => prev === 0 ? images.length - 1 : prev - 1); }}>
               <button 
                  className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/40 transition-colors"
                  aria-label="Previous image"
                >
                 <ChevronLeft className="w-6 h-6" />
               </button>
            </div>
            <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center" onClick={(e) => { e.stopPropagation(); setCurrentIndex(prev => prev === images.length - 1 ? 0 : prev + 1); }}>
               <button 
                  className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/40 transition-colors"
                   aria-label="Next image"
                >
                 <ChevronRight className="w-6 h-6" />
               </button>
            </div>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/50 backdrop-blur-md rounded-full px-3 py-1.5 z-10" onClick={e => e.stopPropagation()}>
              {images.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all duration-300",
                    idx === currentIndex ? "bg-white scale-110" : "bg-white/40 hover:bg-white/60"
                  )}
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
