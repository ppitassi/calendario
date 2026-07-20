import React from 'react';
import { 
  Image as ImageIcon, 
  LayoutTemplate,
  Search
} from 'lucide-react';
import { PostData } from "../types";

export function PostPreviewVisualsOnly({ post, onClick }: { post: PostData, onClick?: () => void }) {
  const feedImages = Array.isArray(post.feedImages) ? post.feedImages : post.feedImages ? [post.feedImages] : [];
  const mainImagePreview = feedImages[0] || post.coverImage || post.linkedinCover || post.storyImage;

  if (!mainImagePreview && !post.videoUrl) {
     return (
       <div className="w-full h-full min-h-[400px] rounded-[2rem] overflow-hidden border-4 border-white dark:border-zinc-800 shadow-2xl relative cursor-pointer group mx-auto transform transition-transform hover:scale-105 rotate-1">
          <img src="/img_placeholder/placeholder.png" alt="Placeholder" className="w-full h-full object-cover grayscale opacity-50" />
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-black/20 backdrop-blur-sm">
             <ImageIcon className="w-16 h-16 text-white opacity-40 mb-4" />
             <p className="font-bold text-xl text-white opacity-80 uppercase tracking-widest">Aguardando Arte</p>
             <p className="text-sm text-white opacity-60 mt-2">Nenhuma mídia enviada para este post.</p>
          </div>
       </div>
     );
  }

  return (
     <div 
       className="w-full max-w-[400px] aspect-[4/5] rounded-[2rem] overflow-hidden border-4 border-white dark:border-zinc-800 shadow-2xl relative cursor-pointer group mx-auto transform transition-transform hover:scale-105 rotate-1"
       onClick={onClick}
     >
        {post.videoUrl ? (
          <video
            src={post.videoUrl}
            controls
            preload="metadata"
            className="w-full h-full object-contain bg-black"
            onClick={(event) => event.stopPropagation()}
          />
        ) : (
          <img src={mainImagePreview} alt="Arte" className="w-full h-full object-cover" />
        )}
        
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
           <div className="bg-white text-black font-bold px-6 py-3 rounded-full flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-all">
              <Search className="w-4 h-4" /> Ampliar
           </div>
        </div>
        
        {post.type === 'carousel' && feedImages.length > 1 && (
          <div className="absolute top-4 right-4 bg-black/80 backdrop-blur text-white text-sm font-bold px-4 py-1.5 rounded-full flex items-center gap-2 shadow-xl">
            <LayoutTemplate className="w-4 h-4" /> 1/{feedImages.length}
          </div>
        )}
     </div>
  );
}
