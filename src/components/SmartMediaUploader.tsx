import React, { useRef } from 'react';
import { 
  Image as ImageIcon, 
  Upload, 
  X,
  Video
} from 'lucide-react';
import { PostData } from "../types";
import { api } from "../lib/api";
import { auth } from '../lib/auth';

export const compressImage = (file: File, maxWidth = 512, maxHeight = 512): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Garante transparência limpando o canvas antes de desenhar
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          
          // Usa PNG para preservar transparência
          resolve(canvas.toDataURL('image/png', 0.8));
        } else {
          resolve(event.target?.result as string);
        }
      };
      img.onerror = (error) => reject(error);
      img.src = event.target?.result as string;
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

export function SmartMediaUploader({ 
  currentPost, 
  onUpdate,
  clientName = 'Geral',
  clientId = 'post'
}: { 
  currentPost: PostData, 
  onUpdate: (updates: Partial<PostData>) => void,
  clientName?: string,
  clientId?: string
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files) as File[];
      
      let newFeed = Array.isArray(currentPost.feedImages) ? [...currentPost.feedImages] : currentPost.feedImages ? [currentPost.feedImages] : [];
      let newStory = currentPost.storyImage || '';
      let newCover = currentPost.coverImage || '';
      let newLinkedinCover = currentPost.linkedinCover || '';

      const isReel = currentPost.type === 'reel';
      const isLinkedin = currentPost.type === 'linkedin';

      const designerName = auth.currentUser?.displayName || auth.currentUser?.email || 'Designer';
      const postDate = currentPost.date;
      let newVideoUrl = currentPost.videoUrl || '';

      for (const file of files) {
        if (file.type.startsWith('video/')) {
          const uploaded = await api.uploadMediaFile(file, clientId, postDate);
          newVideoUrl = uploaded.url;
          continue;
        }
        const compressed = await compressImage(file, 800, 800);
        
        // Upload to server and get URL
        const fileName = `${clientId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const uploadedUrl = await api.uploadImage(compressed, fileName, 'posts', clientName, postDate, designerName);

        const img = new Image();
        img.src = uploadedUrl;
        await new Promise(resolve => {
          img.onload = () => {
            const ratio = img.naturalWidth / img.naturalHeight;
            
            if (isReel) {
              newCover = uploadedUrl;
            } else if (isLinkedin) {
              newLinkedinCover = uploadedUrl;
            } else {
              // Auto detect Feed vs Story
              if (ratio <= 0.6) {
                newStory = uploadedUrl; 
              } else {
                newFeed.push(uploadedUrl);
              }
            }
            resolve(null);
          };
        });
      }

      if (currentPost.type !== 'carousel') {
        newFeed = newFeed.slice(0, 1);
      } else {
        newFeed = newFeed.slice(0, 10);
      }

      onUpdate({
        feedImages: newFeed,
        storyImage: newStory,
        coverImage: newCover,
        linkedinCover: newLinkedinCover
        ,videoUrl: newVideoUrl
      });
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const renderImageItem = (url: string, onRemove: () => void, idx: number | string) => (
    <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden group shadow-md border border-black/10 dark:border-white/10">
      <img src={url} alt="Uploaded" className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <button onClick={onRemove} className="p-1 bg-white/20 hover:bg-white/40 rounded-full backdrop-blur-sm text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
         <button 
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-6 rounded-2xl border-2 border-dashed border-[var(--color-primary)]/40 hover:border-[var(--color-primary)] bg-[var(--color-primary)]/5 hover:bg-[var(--color-primary)]/10 transition-all flex flex-col items-center justify-center gap-2 group"
          >
            <Upload className="w-6 h-6 text-[var(--color-primary)] group-hover:scale-110 transition-transform" />
            <span className="text-sm font-semibold uppercase text-[var(--color-primary)] ">
               {currentPost.type === 'reel' || currentPost.type === 'linkedin' 
                ? 'Upload de Vídeo ou Capa' 
                : 'Upload de Mídia (Detecta Feed / Story)'}
            </span>
            <span className="text-xs opacity-60">Mídias são enviadas diretamente ao Nextcloud</span>
          </button>
          
          <input 
            type="file" 
            multiple={currentPost.type === 'carousel' || currentPost.type === 'post' || currentPost.type === 'promoted'}
            accept="image/*,video/mp4,video/webm,video/quicktime"
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
          />
      </div>

      {currentPost.videoUrl && (
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase opacity-60 flex items-center gap-2">
            <Video className="w-4 h-4" /> Vídeo no Nextcloud
          </label>
          <div className="relative rounded-2xl overflow-hidden bg-black border border-white/10">
            <video src={currentPost.videoUrl} controls preload="metadata" className="w-full max-h-72 object-contain" />
            <button
              type="button"
              onClick={() => onUpdate({ videoUrl: '' })}
              className="absolute right-2 top-2 p-2 bg-black/60 text-white rounded-full"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {(() => {
        const isStandardPost = currentPost.type === 'post' || currentPost.type === 'promoted' || currentPost.type === 'carousel';
        if (!isStandardPost) return null;

        const safeFeedImages = Array.isArray(currentPost.feedImages) 
          ? currentPost.feedImages 
          : currentPost.feedImages ? [currentPost.feedImages] : [];

        return (
          <div className="space-y-4">
            <div className="space-y-2">
               <label className="text-xs font-semibold uppercase opacity-60 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" /> Feed ({safeFeedImages.length}/{currentPost.type === 'carousel' ? 10 : 1})
               </label>
               {safeFeedImages.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {safeFeedImages.map((url, idx) => (
                      renderImageItem(url, () => {
                         const newFeed = [...safeFeedImages];
                         newFeed.splice(idx, 1);
                         onUpdate({ feedImages: newFeed });
                      }, idx)
                    ))}
                  </div>
               )}
            </div>

            <div className="space-y-2">
               <label className="text-xs font-semibold uppercase opacity-60 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" /> Story (Formato Vertical)
               </label>
               {currentPost.storyImage && (
                  <div className="flex flex-wrap gap-2">
                    {renderImageItem(currentPost.storyImage, () => onUpdate({ storyImage: '' }), 'story')}
                  </div>
               )}
            </div>
          </div>
        );
      })()}

      {currentPost.type === 'reel' && currentPost.coverImage && (
         <div className="space-y-2">
             <label className="text-xs font-semibold uppercase  opacity-60 flex items-center gap-2">
                <ImageIcon className="w-4 h-4" /> Capa do Reel
             </label>
             <div className="flex flex-wrap gap-2">
               {renderImageItem(currentPost.coverImage, () => onUpdate({ coverImage: '' }), 'reel-cover')}
             </div>
          </div>
      )}

      {currentPost.type === 'linkedin' && currentPost.linkedinCover && (
         <div className="space-y-2">
             <label className="text-xs font-semibold uppercase  opacity-60 flex items-center gap-2">
                <ImageIcon className="w-4 h-4" /> Banner do Artigo
             </label>
             <div className="flex flex-wrap gap-2">
               {renderImageItem(currentPost.linkedinCover, () => onUpdate({ linkedinCover: '' }), 'linkedin-cover')}
             </div>
          </div>
      )}
    </div>
  );
}
