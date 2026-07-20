import React, { useState, useRef, useEffect } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop, Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Move, Maximize2 } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';

interface ImageCropperModalProps {
  image: string;
  onCropComplete: (croppedImage: Blob) => void;
  onClose: () => void;
  aspectRatio?: number;
  circular?: boolean;
}

// Helper to center the initial crop
function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number,
) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  )
}

export function ImageCropperModal({ image, onCropComplete, onClose, aspectRatio, circular }: ImageCropperModalProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const { toast } = useNotifications();

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    if (aspectRatio) {
      setCrop(centerAspectCrop(width, height, aspectRatio));
    } else {
      // Crop livre (freeform)
      setCrop({
        unit: '%',
        width: 90,
        height: 90,
        x: 5,
        y: 5
      });
    }
  }

  const getCroppedImg = async (pixelCrop: PixelCrop): Promise<Blob> => {
    const image = imgRef.current;
    if (!image) throw new Error('Image not loaded');

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No 2d context');

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    canvas.width = pixelCrop.width * scaleX;
    canvas.height = pixelCrop.height * scaleY;

    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(
      image,
      pixelCrop.x * scaleX,
      pixelCrop.y * scaleY,
      pixelCrop.width * scaleX,
      pixelCrop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
      }, 'image/png', 1);
    });
  };

  const handleConfirm = async () => {
    if (completedCrop) {
      try {
        const croppedBlob = await getCroppedImg(completedCrop);
        onCropComplete(croppedBlob);
      } catch (e) {
        console.error(e);
        toast('Erro ao processar imagem', 'error');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 md:p-8">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/90 backdrop-blur-md" 
        onClick={onClose} 
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="glass w-full max-w-5xl h-[85vh] rounded-[3rem] overflow-hidden flex flex-col relative z-10 border border-white/10 shadow-2xl"
      >
        <div className="p-8 flex items-center justify-between border-b border-white/5 bg-white/5">
           <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 text-primary rounded-xl">
                 <Maximize2 className="w-5 h-5" />
              </div>
              <div>
                 <h2 className="text-xl font-display font-bold">Enquadramento de Logo</h2>
                 <p className="text-[10px] uppercase font-black opacity-40 tracking-widest">Arraste os cantos para ajustar</p>
              </div>
           </div>
           <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-full transition-colors">
              <X className="w-5 h-5" />
           </button>
        </div>

        <div className="flex-1 relative bg-zinc-950 flex items-center justify-center overflow-hidden p-8">
          <div className="max-w-full max-h-full overflow-auto scrollbar-hide">
            <ReactCrop
              crop={crop}
              onChange={c => setCrop(c)}
              onComplete={c => setCompletedCrop(c)}
              aspect={aspectRatio}
              circularCrop={circular}
              className="max-w-full"
            >
              <img
                ref={imgRef}
                alt="Crop me"
                src={image}
                onLoad={onImageLoad}
                className="max-h-[60vh] object-contain"
                crossOrigin="anonymous"
              />
            </ReactCrop>
          </div>
        </div>

        <div className="p-8 bg-zinc-900/50 border-t border-white/5 flex items-center justify-between">
           <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/10">
                 <Move className="w-4 h-4 opacity-40" />
                 <span className="text-[10px] font-bold opacity-60 uppercase tracking-widest">Arraste para mover ou redimensionar</span>
              </div>
           </div>

           <div className="flex gap-4">
              <button 
                onClick={onClose}
                className="px-6 py-4 rounded-2xl font-bold uppercase text-[10px] tracking-widest hover:bg-white/5 transition-all opacity-60 hover:opacity-100"
              >
                Cancelar
              </button>
              <button 
                onClick={handleConfirm}
                className="px-10 py-4 bg-primary text-white rounded-2xl font-bold uppercase text-[10px] tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/20 flex items-center gap-3"
              >
                <Check className="w-4 h-4" />
                Finalizar Recorte
              </button>
           </div>
        </div>
      </motion.div>
    </div>
  );
}
