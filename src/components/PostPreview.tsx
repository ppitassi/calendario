import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Image as ImageIcon, 
  CheckCircle2, 
  FileText,
  Target,
  MessageSquare,
  ArrowUpRight
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { auth } from '../lib/auth';
import { api } from '../lib/api';
import { PostData, ROLE_PERMISSIONS, ROLE_LABELS, UserRole } from "../types";
import { PostPreviewVisualsOnly } from "./PostPreviewVisualsOnly";
import { SlideshowViewer } from "../widgets/SlideshowViewer";
import { Lightbox } from "./Lightbox";

export function PostPreview({ post, date, postTypeConfig, postNumber, reviewToken, isExport = false }: { post: PostData, date: string, postTypeConfig?: any, key?: string | number, postNumber: number, reviewToken?: string, isExport?: boolean }) {
  const token = reviewToken;
  const [commentInput, setCommentInput] = useState('');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [comments, setComments] = useState<any[]>(post.comments || []);
  const [loadingComments, setLoadingComments] = useState(false);

  const fetchComments = async () => {
    if (!post.id) return;
    setLoadingComments(true);
    try {
      let data: any[] = [];
      if (token) {
        data = await api.getPublicPostComments(token, Number(post.id));
      } else {
        data = await api.getPostComments(Number(post.id));
      }
      setComments(data);
    } catch (e) {
      console.error('Erro ao buscar comentários:', e);
    } finally {
      setLoadingComments(false);
    }
  };

  useEffect(() => {
    setComments(post.comments || []);
  }, [post.id, post.comments]);
  
  const handleSaveComment = async () => {
    if (!commentInput.trim() || !post.id) return;
    try {
      if (token) {
        const author = auth.currentUser?.displayName || auth.currentUser?.email || 'Cliente';
        await api.addPublicPostComment(token, Number(post.id), author, commentInput);
      } else {
        await api.addPostComment(Number(post.id), commentInput);
      }
      setCommentInput('');
      fetchComments();
    } catch(err: any) {
      console.error('Erro ao salvar comentário:', err.message);
    }
  };

  const currentUser = auth.currentUser;
  const canWriteComment = (() => {
    if (!currentUser) {
      return !!token;
    }
    const rolePermissions = ROLE_PERMISSIONS[currentUser.role as UserRole];
    return rolePermissions?.canComment || false;
  })();
  

  const Icon = postTypeConfig?.icon || ImageIcon;
  const feedImages = Array.isArray(post.feedImages) ? post.feedImages : post.feedImages ? [post.feedImages] : [];
  const mediaPreview = feedImages[0] || post.coverImage || post.linkedinCover || post.storyImage;

  if (false && isExport) {
    const title = post.head || post.artHeadline || (post as any).headline || post.title;
    const caption = post.caption || post.subtitle;
    const briefing = post.visualBriefing || post.artText;

    return (
      <article className="post-export-block w-full rounded-2xl border border-black/10 bg-white p-5 text-zinc-950 shadow-none">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase text-zinc-500">
          <span>{format(new Date(date + 'T00:00:00'), 'dd MMM yyyy', { locale: ptBR })}</span>
          <span>Post {String(postNumber).padStart(2, '0')}</span>
          <span>{postTypeConfig?.label || post.type || 'Post'}</span>
          {post.funnelStage && <span>Funil: {post.funnelStage}</span>}
          {post.status && <span>Status: {post.status}</span>}
        </div>

        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_120px]">
          <div className="min-w-0 space-y-4">
            <div>
              <h2 className="text-2xl font-display font-black leading-tight whitespace-normal [overflow-wrap:break-word] [word-break:normal]">
                {title || 'Titulo da arte'}
              </h2>
              {post.subhead && (
                <p className="mt-1 text-sm font-semibold text-[var(--color-primary)] whitespace-normal [overflow-wrap:break-word] [word-break:normal]">
                  {post.subhead}
                </p>
              )}
            </div>

            {caption && (
              <section>
                <h3 className="mb-1 text-[10px] font-bold uppercase text-zinc-400">Legenda</h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:break-word] [word-break:normal]">{caption}</p>
              </section>
            )}

            {post.objective && (
              <section>
                <h3 className="mb-1 text-[10px] font-bold uppercase text-zinc-400">Objetivo</h3>
                <p className="text-sm leading-relaxed [overflow-wrap:break-word] [word-break:normal]">{post.objective}</p>
              </section>
            )}

            {briefing && (
              <section>
                <h3 className="mb-1 text-[10px] font-bold uppercase text-zinc-400">Briefing da arte</h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:break-word] [word-break:normal]">{briefing}</p>
              </section>
            )}

            {(post.cta || post.hashtags) && (
              <section className="grid gap-3 sm:grid-cols-2">
                {post.cta && (
                  <div>
                    <h3 className="mb-1 text-[10px] font-bold uppercase text-zinc-400">CTA</h3>
                    <p className="text-sm leading-relaxed [overflow-wrap:break-word] [word-break:normal]">{post.cta}</p>
                  </div>
                )}
                {post.hashtags && (
                  <div>
                    <h3 className="mb-1 text-[10px] font-bold uppercase text-zinc-400">Hashtags</h3>
                    <p className="text-sm leading-relaxed [overflow-wrap:break-word] [word-break:normal]">{post.hashtags}</p>
                  </div>
                )}
              </section>
            )}
          </div>

          {(mediaPreview || post.videoUrl) && (
            <button type="button" onClick={() => setLightboxOpen(true)} className="print-hide h-28 w-full overflow-hidden rounded-xl border border-black/10 bg-zinc-100 md:w-[120px]">
              {post.videoUrl ? (
                <video src={post.videoUrl} preload="metadata" className="h-full w-full object-cover" />
              ) : (
                <img src={mediaPreview} alt="" className="h-full w-full object-cover" />
              )}
            </button>
          )}
        </div>
      </article>
    );
  }
  
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between px-4">
        <h2 className="text-xl font-display font-medium opacity-50 uppercase ">Modo de Visualização</h2>
      </div>

      <div className="w-full glass rounded-[3rem] p-5 sm:p-6 md:p-8 border border-white/20 dark:border-white/5 relative overflow-hidden group shadow-2xl">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[var(--color-primary)]/10 blur-[100px] rounded-full mix-blend-multiply dark:mix-blend-lighten pointer-events-none transition-transform duration-1000 group-hover:scale-110" />
        
        <div className="relative z-10 flex flex-col h-full min-h-[400px] min-w-0">
          <div className="flex flex-col md:flex-row gap-8 items-start mb-6">
            <div className="flex-1 w-full min-w-0">
              {/* HEADER WITH POST NUMBER AND DATE */}
              <div className="flex items-center gap-2 mb-6">
                <div className="flex items-center gap-1.5">
                  <div className="px-5 py-2.5 bg-[var(--color-primary)] text-white rounded-2xl font-black text-sm uppercase ">
                    Post {String(postNumber).padStart(2, '0')}
                  </div>
                  <div className="w-10 h-10 bg-[var(--color-primary)] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-[var(--color-primary)]/20">
                    <ArrowUpRight className="w-5 h-5" />
                  </div>
                </div>
                <div className="px-4 py-2.5 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 text-xs font-bold  uppercase opacity-70 ml-2">
                  {format(new Date(date + 'T00:00:00'), 'dd MMM, yyyy', { locale: ptBR })}
                </div>
                <div className="px-4 py-2.5 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 text-xs font-bold  uppercase opacity-70 ml-2 flex items-center gap-2">
                  <Icon className="w-4 h-4" /> {postTypeConfig?.label}
                </div>
                {post.funnelStage && (
                  <div className="px-4 py-2.5 rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 text-xs font-black uppercase ml-2">
                    Funil: {post.funnelStage === 'topo' ? 'Topo' : post.funnelStage === 'meio' ? 'Meio' : 'Fundo'}
                  </div>
                )}
              </div>

              {/* HEAD & SUBHEAD (GROUPED) */}
              <div className="flex flex-col gap-2 mb-6">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-black uppercase leading-[1.02] text-foreground/90 mix-blend-luminosity whitespace-normal [overflow-wrap:break-word] [word-break:normal]">
                  {post.head || post.artHeadline || (post as any).headline || <span className="opacity-20">TÍTULO DA ARTE</span>}
                </h1>
                {post.subhead && (
                  <h2 className="text-base md:text-lg font-medium text-[var(--color-primary)] italic">
                    {post.subhead}
                  </h2>
                )}
              </div>

              {/* CAPTION / SUBTITLE IN SEPARATORS */}
              <div className="border-t border-b border-black/10 dark:border-white/10 py-5 mb-6 relative">
                <p className="text-sm opacity-80 whitespace-pre-wrap leading-relaxed font-medium">
                  {post.subtitle || post.caption || <span className="opacity-30 italic">A legenda do post aparecerá aqui...</span>}
                </p>
              </div>

              <div className="flex flex-col gap-4">
                 {post.type === 'reel' && (
                    <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-6 backdrop-blur-sm border border-black/5 dark:border-white/5 space-y-4 max-w-xl">
                      <div>
                        <span className="text-[10px] font-bold uppercase  opacity-50 block mb-1">Tema</span>
                        <span className="font-medium text-sm">{post.theme || 'Não especificado'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase  opacity-50 block mb-1">Rascunho de Roteiro</span>
                        <div className="font-mono text-xs opacity-80 whitespace-pre-wrap [overflow-wrap:break-word] [word-break:normal] border-l-2 border-[var(--color-primary)]/30 pl-3">
                          {post.script || 'Nenhum roteiro providenciado...'}
                        </div>
                      </div>
                    </div>
                  )}

                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-black/5 dark:bg-white/5">
                     <Target className="w-5 h-5 opacity-60" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase  opacity-60 dark:opacity-40 mb-0.5">Objetivo</span>
                    <span className="font-semibold text-sm">{post.objective || 'Não definido'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* VISUALS (RIGHT COLUMN) */}
                <div className="w-full md:w-[320px] shrink-0 pt-4 md:pt-0">
                   {post.type === 'carousel' ? (
                     <SlideshowViewer 
                       images={Array.isArray(post.feedImages) ? post.feedImages : post.feedImages ? [post.feedImages] : []} 
                       expandable 
                     />
                   ) : (
                 <PostPreviewVisualsOnly post={post} onClick={() => setLightboxOpen(true)} />
               )}
            </div>
          </div>

          {/* FULL WIDTH COMMENTS SECTION */}
          <div className="w-full bg-black/5 dark:bg-white/5 rounded-3xl p-5 md:p-6 border border-black/5 dark:border-white/5 mt-auto">
            <h3 className="font-bold text-sm  uppercase opacity-60 mb-6 flex items-center gap-2">
               <MessageSquare className="w-4 h-4" /> Comentários e Feedbacks {loadingComments && <span className="text-xs opacity-50 lowercase animate-pulse">carregando...</span>}
            </h3>
            <div className="space-y-4 mb-6">
              {comments.map((c, idx) => (
                <div key={idx} className="bg-white dark:bg-zinc-800 p-4 rounded-2xl text-sm border border-black/5 dark:border-white/5 shadow-sm">
                  <div className="flex justify-between items-center mb-2 opacity-50 text-[10px] font-bold uppercase ">
                     <span>{c.authorName} ({ROLE_LABELS[c.authorRole as UserRole] || c.authorRole})</span>
                     <span>{format(new Date(c.createdAt), 'dd/MM HH:mm')}</span>
                  </div>
                  <p className="font-medium leading-relaxed opacity-90">{c.content}</p>
                </div>
              ))}
              {!comments.length && <p className="text-sm opacity-40 italic">Sem comentários ainda.</p>}
            </div>
            
            {canWriteComment && !isExport && (
               <div className="flex flex-col sm:flex-row gap-3">
                 <input 
                   type="text" 
                   value={commentInput}
                   onChange={e => setCommentInput(e.target.value)}
                   placeholder={!post.id ? "Salve o post primeiro para poder comentar" : "Escreva um comentário, alteração ou feedback..."}
                   disabled={!post.id}
                   className="flex-1 bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-sm transition-all shadow-inner font-medium disabled:opacity-50"
                   onKeyDown={e => e.key === 'Enter' && handleSaveComment()}
                 />
                 <button 
                   onClick={handleSaveComment}
                   disabled={!post.id}
                   className="px-8 py-4 bg-[var(--color-primary)] text-white rounded-2xl text-sm font-bold uppercase hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-[var(--color-primary)]/30 disabled:opacity-50"
                 />
               </div>
            )}
            {!canWriteComment && !isExport && (
              <p className="text-xs opacity-40 italic">Seu cargo ({ROLE_LABELS[auth.currentUser?.role as UserRole] || auth.currentUser?.role}) possui apenas permissão de visualização dos comentários.</p>
            )}
          </div>

        </div>
      </div>
      <Lightbox 
         isOpen={lightboxOpen} 
         onClose={() => setLightboxOpen(false)} 
         images={
           [
              ...(post.feedImages || []),
              post.coverImage,
              post.linkedinCover,
              post.storyImage
           ].filter(Boolean) as string[]
         } 
      />
    </div>
  );
}
