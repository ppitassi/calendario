import React, { useState, useRef } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop, Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Check, Move } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';
import { Button } from '../components/ui/Button/Button';
import { Modal } from '../components/ui/Modal/Modal';
import styles from './ImageCropperModal.module.css';

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
    <Modal open onClose={onClose} title="Enquadramento de Logo" className={styles.dialog}>
        <p className={styles.intro}>Arraste os cantos para ajustar</p>

        <div className={styles.cropArea}>
          <div className={styles.cropViewport}>
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
                className={styles.image}
                crossOrigin="anonymous"
              />
            </ReactCrop>
          </div>
        </div>

        <div className={styles.footer}>
           <div>
              <div className={styles.hint}>
                 <Move />
                 <span>Arraste para mover ou redimensionar</span>
              </div>
           </div>

           <div className={styles.actions}>
              <Button
                onClick={onClose}
                variant="ghost"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirm}
                variant="primary"
                icon={<Check />}
              >
                Finalizar Recorte
              </Button>
           </div>
        </div>
    </Modal>
  );
}
