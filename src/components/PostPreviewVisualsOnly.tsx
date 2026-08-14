import { 
  Image as ImageIcon, 
  LayoutTemplate,
  Search
} from 'lucide-react';
import { PostData } from "../types";
import styles from "./PostPreviewVisualsOnly.module.css";

export function PostPreviewVisualsOnly({ post, onClick }: { post: PostData, onClick?: () => void }) {
  const feedImages = Array.isArray(post.feedImages) ? post.feedImages : post.feedImages ? [post.feedImages] : [];
  const mainImagePreview = feedImages[0] || post.coverImage || post.linkedinCover || post.storyImage;

  if (!mainImagePreview && !post.videoUrl) {
     return (
       <div className={styles.placeholder}>
          <img src="/img_placeholder/placeholder.png" alt="Placeholder" />
          <div>
             <ImageIcon />
             <strong>Aguardando Arte</strong>
             <p>Nenhuma mídia enviada para este post.</p>
          </div>
       </div>
     );
  }

  return (
     <div 
       className={styles.preview}
       onClick={onClick}
       onKeyDown={(event) => { if (onClick && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onClick(); } }}
       role={onClick ? "button" : undefined}
       tabIndex={onClick ? 0 : undefined}
     >
        {post.videoUrl ? (
          <video
            src={post.videoUrl}
            controls
            preload="metadata"
            className={styles.video}
            onClick={(event) => event.stopPropagation()}
          />
        ) : (
          <img src={mainImagePreview} alt="Arte" className={styles.image} />
        )}
        
        <div className={styles.overlay}>
           <div className={styles.expandLabel}>
              <Search /> Ampliar
           </div>
        </div>
        
        {post.type === 'carousel' && feedImages.length > 1 && (
          <div className={styles.carouselBadge}>
            <LayoutTemplate /> 1/{feedImages.length}
          </div>
        )}
     </div>
  );
}
