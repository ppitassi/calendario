import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, MoreHorizontal, LayoutTemplate, PlayCircle, Users, CheckCircle2, ArrowUpRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { PostData } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button/Button';
import styles from './PresentationFeedPreview.module.css';

interface PresentationFeedPreviewProps {
  handle: string;
  name: string;
  numPosts: number;
  followers: string;
  following: string;
  bio: string;
  avatar: string | null;
  sortedPostKeys: string[];
  posts: Record<string, PostData>;
  userRole: string;
  canSend: boolean;
  sent: boolean;
  onExit: () => void;
  onSendToClient?: () => void;
  currentDate: Date;
  username?: string;
  token?: string;
  isExport?: boolean;
}

export function PresentationFeedPreview({
  handle,
  name,
  numPosts,
  followers,
  following,
  bio,
  avatar,
  sortedPostKeys,
  posts,
  userRole,
  canSend,
  sent,
  onExit,
  onSendToClient,
  currentDate,
  username = "Designer Responsável",
  token,
  isExport = false
}: PresentationFeedPreviewProps) {
  const [internalSent, setInternalSent] = React.useState(sent);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 40 }} 
      whileInView={{ opacity: 1, y: 0 }} 
      viewport={{ once: true, margin: "-100px" }}
      className={styles.shell}
    >
       <div className={styles.intro}>
          <p>Feed Preview</p>
          <h2>A Harmonia Visual</h2>
          <p className={styles.subtitle}>Como o seu perfil se apresentará aos olhos do novo seguidor.</p>
       </div>

       <div className={styles.phone}>
          <div className={styles.phoneHeader}>
            <ArrowLeft />
            <span>{handle}</span>
            <MoreHorizontal />
          </div>

          <div className={styles.profile}>
            <div className={styles.avatarRing}>
              <div className={styles.avatar}>
                {avatar ? <img src={avatar} alt={`Logo de ${name}`} /> : <span>{name.substring(0,2).toUpperCase()}</span>}
              </div>
            </div>
            <div className={styles.stats}>
              <div><strong>{numPosts}</strong><span>posts</span></div>
              <div><strong>{followers}</strong><span>seguidores</span></div>
              <div><strong>{following}</strong><span>seguindo</span></div>
            </div>
          </div>
          
          <div className={styles.bio}>
            <strong>{name}</strong>
            <p>{bio}</p>
          </div>

          <div className={styles.tabs}>
             <div data-active="true">
               <LayoutTemplate />
             </div>
             <div>
               <PlayCircle />
             </div>
             <div>
               <Users />
             </div>
          </div>

          <div className={styles.feedGrid}>
          {sortedPostKeys.map((date) => {
                const post = posts[date];
                const mainImg = post.feedImages?.[0] || post.coverImage || post.linkedinCover || post.storyImage;
                const isCarousel = post.type === 'carousel';
                const isReel = post.type === 'reel';

                return (
                   <div key={date} className={styles.post}>
                       <img 
                         src={mainImg || "/img_placeholder/placeholder.png"} 
                         className={cn(styles.postImage, !mainImg && styles.placeholder)}
                         alt=""
                       />
                      
                      <div className={styles.postType}>
                         {isCarousel && <div className={styles.carouselIcon} />}
                         {isReel && <PlayCircle />}
                      </div>
                   </div>
                );
             })}
          </div>
       </div>
       
        {userRole !== 'cliente' && (
          <div className={styles.actions}>
            <Button onClick={onExit} variant="glass" size="large" icon={<ArrowLeft />}>Voltar ao Planejador</Button>
            {canSend && (
              <Button
                onClick={() => {
                  setInternalSent(true);
                  if (onSendToClient) onSendToClient();
                }}
                disabled={internalSent}
                variant="primary"
                size="large"
                icon={internalSent ? <CheckCircle2 /> : <ArrowUpRight />}
              >
                {internalSent ? (
                  <>Enviado para o Cliente!</>
                ) : (
                  <>Enviar para o Cliente</>
                )}
              </Button>
            )}
          </div>
        )}

        <div className={styles.footer}>
           <span>Agência Terceiro Andar • {username} • {format(currentDate, 'MMMM yyyy', { locale: ptBR })}</span>
           {token && !isExport && (
             <div className={styles.exportActions}>
               <Button onClick={() => window.open(api.getReviewExportUrl(token), '_blank')} size="small" variant="ghost">
                 visualizar pdf
               </Button>
               <Button onClick={() => api.downloadReviewPdf(token).catch(() => alert('Erro ao gerar PDF.'))} size="small" variant="ghost">
                 baixar versão pdf
               </Button>
             </div>
           )}
        </div>
    </motion.div>
  );
}
