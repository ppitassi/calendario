import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, MoreHorizontal, LayoutTemplate, PlayCircle, Users, CheckCircle2, ArrowUpRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { PostData, ClientData } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { api } from '../lib/api';

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
      className="w-full glass p-10 md:p-16 rounded-[3rem] relative flex flex-col border border-white/20 dark:border-white/10 shadow-3xl bg-white/40 dark:bg-black/40 backdrop-blur-2xl overflow-hidden items-center justify-center"
    >
       <div className="relative z-10 text-center mb-16">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--color-primary)] mb-4">Feed Preview</p>
          <h2 className="text-4xl md:text-5xl font-display font-black  mb-4">A Harmonia Visual</h2>
          <p className="text-lg opacity-60">Como o seu perfil se apresentará aos olhos do novo seguidor.</p>
       </div>

       <div className="relative z-10 w-full max-w-[400px] border border-black/10 dark:border-white/10 rounded-[3rem] overflow-hidden bg-white dark:bg-black shadow-[0_20px_50px_rgba(0,0,0,0.2)] mx-auto flex flex-col pt-4">
          <div className="flex items-center justify-between px-6 py-3">
            <ArrowLeft className="w-6 h-6" />
            <span className="font-bold text-lg ">{handle}</span>
            <MoreHorizontal className="w-6 h-6" />
          </div>

          <div className="px-6 py-4 flex items-center gap-6">
            <div className="w-20 h-20 shrink-0 rounded-full bg-gradient-to-tr from-yellow-500 via-pink-500 to-purple-500 p-[3px]">
              <div className="w-full h-full rounded-full bg-white dark:bg-black border-2 border-white dark:border-black overflow-hidden flex items-center justify-center">
                {avatar ? <img src={avatar} alt={`Logo de ${name}`} className="w-full h-full object-contain p-1" /> : <span className="text-2xl font-display font-bold opacity-40">{name.substring(0,2).toUpperCase()}</span>}
              </div>
            </div>
            <div className="flex-1 flex justify-between items-center text-center">
              <div className="flex flex-col"><span className="font-bold text-lg">{numPosts}</span><span className="text-xs">posts</span></div>
              <div className="flex flex-col"><span className="font-bold text-lg">{followers}</span><span className="text-xs">seguidores</span></div>
              <div className="flex flex-col"><span className="font-bold text-lg">{following}</span><span className="text-xs">seguindo</span></div>
            </div>
          </div>
          
          <div className="px-6 pb-6">
            <p className="font-bold text-sm mb-1">{name}</p>
            <p className="text-sm whitespace-pre-line leading-snug">{bio}</p>
          </div>

          <div className="flex items-center justify-around pb-0">
             <div className="w-1/3 flex justify-center border-b border-black dark:border-white pb-3">
               <LayoutTemplate className="w-6 h-6" />
             </div>
             <div className="w-1/3 flex justify-center pb-3 opacity-30">
               <PlayCircle className="w-6 h-6" />
             </div>
             <div className="w-1/3 flex justify-center pb-3 opacity-30">
               <Users className="w-6 h-6" />
             </div>
          </div>

          <div className="grid grid-cols-3 gap-[2px] bg-black/5 dark:bg-white/5 pb-12 min-h-[300px] content-start">
             {sortedPostKeys.map((date) => {
                const post = posts[date];
                const mainImg = post.feedImages?.[0] || post.coverImage || post.linkedinCover || post.storyImage;
                const isCarousel = post.type === 'carousel';
                const isReel = post.type === 'reel';

                return (
                   <div key={date} className="w-full aspect-square relative bg-zinc-200 dark:bg-zinc-800">
                       <img 
                         src={mainImg || "/img_placeholder/placeholder.png"} 
                         className={cn("w-full h-full object-cover", !mainImg && "grayscale opacity-40")} 
                       />
                      
                      <div className="absolute top-2 right-2 text-white drop-shadow-md">
                         {isCarousel && <div className="w-4 h-4 border border-white rounded-[2px]" style={{boxShadow: '2px 2px 0 0 white'}} />}
                         {isReel && <PlayCircle className="w-5 h-5 fill-black/30" />}
                      </div>
                   </div>
                );
             })}
          </div>
       </div>
       
        {userRole !== 'cliente' && (
          <div className="mt-16 w-full flex flex-col sm:flex-row items-center justify-center gap-4">
            <button onClick={onExit} className="px-8 py-4 rounded-full bg-black/10 dark:bg-white/10 hover:bg-black/15 dark:hover:bg-white/15 font-bold text-sm uppercase hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-3">
                <ArrowLeft className="w-5 h-5" /> Voltar ao Planejador
            </button>
            {canSend && (
              <button
                onClick={() => {
                  setInternalSent(true);
                  if (onSendToClient) onSendToClient();
                }}
                disabled={internalSent}
                className="px-10 py-5 rounded-full bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white font-bold text-lg uppercase hover:scale-[1.02] active:scale-[0.98] transition-all shadow-2xl shadow-[var(--color-primary)]/40 flex items-center justify-center gap-3 disabled:opacity-60 disabled:scale-100"
              >
                {internalSent ? (
                  <><CheckCircle2 className="w-6 h-6" /> Enviado para o Cliente!</>
                ) : (
                  <><ArrowUpRight className="w-6 h-6" /> Enviar para o Cliente</>
                )}
              </button>
            )}
          </div>
        )}

        <div className="mt-16 pt-8 border-t border-black/10 dark:border-white/10 flex flex-col items-center gap-3 opacity-40 text-[9px] font-bold uppercase tracking-[0.12em] relative z-10 w-full text-center whitespace-normal [overflow-wrap:break-word] [word-break:normal]">
           <span>Agência Terceiro Andar • {username} • {format(currentDate, 'MMMM yyyy', { locale: ptBR })}</span>
           {token && !isExport && (
             <div className="flex gap-3 lowercase tracking-normal text-[10px] font-sans font-semibold mt-1">
               <button onClick={() => window.open(api.getReviewExportUrl(token), '_blank')} className="underline hover:text-[var(--color-primary)] transition-colors">
                 visualizar pdf
               </button>
               <button onClick={() => api.downloadReviewPdf(token).catch(() => alert('Erro ao gerar PDF.'))} className="underline hover:text-[var(--color-primary)] transition-colors">
                 baixar versão pdf
               </button>
             </div>
           )}
        </div>
    </motion.div>
  );
}
