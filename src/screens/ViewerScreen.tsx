import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ArrowLeft,
  LayoutTemplate,
  Target,
  PenTool,
  X,
  PlayCircle,
  ArrowUpRight,
  MoreHorizontal,
  Users
} from 'lucide-react';
import { useTheme } from '../components/ThemeProvider';
import { cn } from '../lib/utils';
import { format, getDaysInMonth, startOfMonth, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { BackgroundEffects } from "../components/BackgroundEffects";
import { EditableText } from "../components/EditableText";
import { LayoutEditToggle } from "../components/LayoutEditToggle";
import { PostPreview } from "../components/PostPreview";
import { PresentationCurveBg } from "../components/PresentationCurveBg";
import { ThemeToggle } from "../components/ThemeToggle";
import { PresentationStrategy } from "../widgets/PresentationStrategy";
import { PresentationCalendar } from "../widgets/PresentationCalendar";
import { PresentationFeedPreview } from "../widgets/PresentationFeedPreview";
import { POST_TYPES } from "../lib/constants";
import { PostData, ClientData } from "../types";
import { MainLayout } from "../components/MainLayout";
import { api } from "../lib/api";

export function ViewerScreen({
  posts,
  client,
  userRole,
  currentDate,
  onExit,
  onSendToClient,
  username,
  onPrevMonth,
  onNextMonth,
  user,
  currentClient,
  onNavigate,
  reviewToken,
  isExport = false
}: {
  posts: Record<string, PostData>,
  client: ClientData,
  userRole: string,
  currentDate: Date,
  onExit: () => void,
  onSendToClient?: () => void,
  username?: string,
  onPrevMonth: () => void,
  onNextMonth: () => void,
  user?: any,
  currentClient?: ClientData | null,
  onNavigate?: (screen: string) => void,
  reviewToken?: string,
  isExport?: boolean
}) {
  const { isDark } = useTheme();
  const token = reviewToken;
  const canSend = userRole === 'admin' || userRole === 'atendimento';
  const [sent, setSent] = React.useState(false);

  // Sort and filter posts by the specific month
  const targetMonth = currentDate.getMonth();
  const targetYear = currentDate.getFullYear();

  const sortedPostKeys = Object.keys(posts).filter(dateStr => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
  }).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  const postCounts = sortedPostKeys.reduce((acc, date) => {
    const type = posts[date].type || 'post';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalPosts = sortedPostKeys.length || 1;
  const staticCount = (postCounts['post'] || 0) + (postCounts['linkedin'] || 0);
  const reelCount = postCounts['reel'] || 0;
  const carouselCount = postCounts['carousel'] || 0;

  const staticPct = Math.round((staticCount / totalPosts) * 100) || 0;
  const reelPct = Math.round((reelCount / totalPosts) * 100) || 0;
  const carouselPct = Math.round((carouselCount / totalPosts) * 100) || 0;

  const stats = client.instagramStats || {};
  const handle = stats.handle || client.name.toLowerCase().replace(/\s+/g, '.');
  const name = stats.name || client.name;
  const numPosts = Number(stats.postsCount || sortedPostKeys.length);
  const followers = stats.followers || '-';
  const following = stats.following || '-';
  const bio = stats.bio || 'Conteúdo oficial em planejamento ';
  const avatar = client.logoUrl || null;

  const renderHeader = () => {
    if (isExport) {
      return (
        <div className="px-14 pt-8 pb-4 flex items-center justify-between w-full border-b border-black/5 dark:border-white/10 print-header bg-white dark:bg-zinc-950">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-bold text-xs uppercase">
              {client.name.substring(0, 2).toUpperCase()}
            </div>
            <div className="flex flex-col text-left">
              <h1 className="text-2xl font-display font-black tracking-tight">{client.name}</h1>
              <span className="text-[10px] font-bold uppercase opacity-40 tracking-wider">Apresentação Estratégica de Conteúdo</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
            </span>
          </div>
        </div>
      );
    }

    if (userRole) {
      return (
        <div className="px-14 pt-8 pb-4 flex flex-col md:flex-row items-center justify-between gap-6 w-full">
          <div className="flex items-center gap-4">
            <button onClick={onExit} className="p-3 rounded-2xl bg-black/5 dark:bg-white/5 hover:bg-black/10 transition-all border border-white/5"><ArrowLeft className="w-5 h-5" /></button>
            <div className="flex flex-col">
              <h1 className="text-3xl font-display font-black tracking-tight">{client.name}</h1>
              <span className="text-xs font-bold uppercase opacity-40 tracking-widest mt-1">Apresentação do Calendário de Posts</span>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-black/5 dark:bg-white/5 px-4 py-2 rounded-2xl border border-black/5 dark:border-white/10 shadow-inner">
            <button onClick={onPrevMonth} className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors"><ChevronLeft className="w-5 h-5" /></button>
            <span className="text-xs font-bold uppercase tracking-widest min-w-[120px] text-center">
              {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
            </span>
            <button onClick={onNextMonth} className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors"><ChevronRight className="w-5 h-5" /></button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                try {
                  const opened = window.open(api.getPresentationExportUrl(client.id, currentDate), '_blank');
                  if (!opened) alert('Pop-up bloqueado. Permita pop-ups para visualizar o PDF.');
                } catch (e: any) {
                  alert(`Erro ao abrir a versão estática: ${e.message || 'URL inválida.'}`);
                }
              }}
              className="px-6 py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg"
            >
              Visualizar PDF
            </button>
            <button
              onClick={async () => {
                try {
                  await api.downloadPresentationPdf(client.id, currentDate);
                } catch (e: any) {
                  alert(`Erro ao exportar PDF: ${e.message || 'verifique Playwright/Chromium.'}`);
                }
              }}
              className="px-6 py-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg"
            >
              Exportar PDF
            </button>
            {canSend && (
              <button
                onClick={async () => {
                  try {
                    const tokenObj = await api.createApprovalToken(client.id, currentDate);
                    await navigator.clipboard.writeText(`${window.location.origin}/review/${tokenObj.id}`);
                    setSent(true);
                    setTimeout(() => setSent(false), 2000);
                  } catch (e) {
                    console.error(e);
                  }
                }}
                className="px-6 py-3 rounded-2xl bg-primary text-white text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg"
              >
                {sent ? 'Link Copiado!' : 'Compartilhar'}
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <header className="sticky top-0 z-50 w-full glass border-b-0 py-4 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onExit}
            className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors group"
            title="Voltar para Edição"
          >
            <ArrowLeft className="w-5 h-5 opacity-40 group-hover:opacity-100 transition-opacity" />
          </button>

          <div className="h-8 w-px bg-black/10 dark:bg-white/10 mx-2 hidden sm:block"></div>

          <div className="flex items-center gap-4">
            <div className="h-12 flex items-center justify-center">
              <AnimatePresence mode="wait">
                {isDark ? (
                  ((user as any)?.agencyLogoDark || (user as any)?.agencyLogo) && (
                    <motion.img
                      key="logo-dark"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      src={(user as any).agencyLogoDark || (user as any).agencyLogo}
                      className="h-full max-w-[180px] object-contain"
                      alt="Agency Logo Dark"
                    />
                  )
                ) : (
                  ((user as any)?.agencyLogo || (user as any)?.agencyLogoDark) && (
                    <motion.img
                      key="logo-light"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      src={(user as any).agencyLogo || (user as any).agencyLogoDark}
                      className="h-full max-w-[180px] object-contain"
                      alt="Agency Logo"
                    />
                  )
                )}
              </AnimatePresence>
              {(!(user as any)?.agencyLogo && !(user as any)?.agencyLogoDark) && (
                <div className="w-10 h-10 rounded-2xl bg-black dark:bg-white flex items-center justify-center text-white dark:text-black shadow-lg">
                  <span className="font-display font-black text-xs">{(user as any)?.agencyName?.substring(0, 2).toUpperCase() || '3F'}</span>
                </div>
              )}
            </div>
            <div className="flex flex-col justify-center">
              <span className="font-display font-bold text-sm tracking-tighter leading-none">{(user as any)?.agencyName || 'Third Floor'}</span>
              <span className="text-[10px] font-bold uppercase opacity-40 leading-none">Agência</span>
            </div>
            <div className="h-6 w-px bg-black/10 dark:bg-white/10 mx-2 hidden sm:block"></div>
            <span className="font-display font-medium text-lg hidden sm:inline-block opacity-60">
              {(user as any)?.agencySlogan || 'Apresentação Estratégica'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {!isExport && token && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.open(api.getReviewExportUrl(token), '_blank')}
                className="px-4 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 font-bold uppercase text-[10px] tracking-wider transition-all border border-purple-500/15"
              >
                Visualizar PDF
              </button>
              <button
                onClick={() => api.downloadReviewPdf(token).catch((e: any) => alert(`Erro ao exportar PDF: ${e.message || 'verifique Playwright/Chromium e FRONTEND_URL.'}`))}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold uppercase text-[10px] tracking-wider transition-all border border-purple-500/15"
              >
                Exportar PDF
              </button>
            </div>
          )}
          <LayoutEditToggle />
          <ThemeToggle />
        </div>
      </header>
    );
  };

  const mainContent = (
    <div className={cn(
      "flex-1 flex flex-col relative",
      !userRole && "min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans transition-colors duration-500 relative tracking-wide selection:bg-[var(--color-primary)] selection:text-white"
    )}>
      {!userRole && !isExport && <BackgroundEffects />}
      {!userRole && !isExport && <PresentationCurveBg />}

      {renderHeader()}

      <main className={cn(
        "flex-1 w-full z-10 p-4 lg:p-8 pt-8",
        isExport ? "print-main max-w-[90%] mx-auto space-y-32 md:space-y-64 pb-64" : (userRole ? "max-w-[1600px] mx-auto space-y-12 pb-64" : "max-w-[90%] mx-auto space-y-32 md:space-y-64 pb-64")
      )}>
        {sortedPostKeys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 opacity-50">
            <LayoutTemplate className="w-16 h-16 mb-6 opacity-30" />
            <EditableText id="viewer_no_content_title" defaultText="Sem conteúdo ainda" as="h2" className="text-2xl font-display font-bold" />
            <EditableText id="viewer_no_content_subtitle" defaultText="Volte ao planejador e selecione algumas datas." as="p" />
          </div>
        ) : (
          <>
            {/* PAGE 1: COVER */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              className="print-compact-section w-full glass relative flex flex-col items-center justify-center text-center overflow-hidden border border-white/20 dark:border-white/10 shadow-3xl bg-white/40 dark:bg-black/40 backdrop-blur-2xl p-10 md:p-16 rounded-[3rem] min-h-[40vh]"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="relative z-10 bg-white/80 dark:bg-zinc-900/80 shadow-2xl flex items-center justify-center overflow-hidden border border-white/40 dark:border-white/10 backdrop-blur-xl w-32 h-32 md:w-48 md:h-48 rounded-[3rem] mb-12"
              >
                {avatar ? <img src={avatar} alt={`Logo de ${client.name}`} className="w-full h-full object-contain p-3 md:p-5" /> : <span className="text-4xl md:text-6xl font-display font-bold opacity-20">{client.name.substring(0, 2).toUpperCase()}</span>}
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="relative z-10 font-display font-black mb-4 leading-tight whitespace-normal [overflow-wrap:break-word] [word-break:normal] text-5xl md:text-9xl"
              >
                Proposta de <br /><span className="text-[var(--color-primary)]">Conteúdo Social</span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
                className="relative z-10 opacity-60 font-medium max-w-xl text-lg md:text-2xl"
              >
                Planejamento estratégico e visual desenvolvido para <strong className="text-[var(--color-primary)]">{client.name}</strong>.
              </motion.p>
            </motion.div>

            {/* PAGE 2: STRATEGY / FUNNEL */}
            <PresentationStrategy
              client={client}
              sortedPostKeys={sortedPostKeys}
              staticPct={staticPct}
              reelPct={reelPct}
              carouselPct={carouselPct}
            />

            {/* CALENDAR OVERVIEW PAGE */}
            <PresentationCalendar currentDate={currentDate} posts={posts} />

            {/* POSTS IN A SINGLE GIANT CARD */}
            {sortedPostKeys.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                className="print-posts-section w-full glass relative flex flex-col border border-white/20 dark:border-white/10 shadow-3xl bg-white/40 dark:bg-black/40 backdrop-blur-2xl overflow-hidden p-10 md:p-16 rounded-[3rem]"
              >
                <div className="relative z-10 w-full text-center mb-16">
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--color-primary)] mb-4">Calendário de Conteúdo</p>
                  <h2 className="font-display font-black whitespace-normal [overflow-wrap:break-word] [word-break:normal] text-4xl md:text-5xl">Postagens do Mês</h2>
                </div>

                <div className="relative z-10 flex flex-col w-full">
                  {sortedPostKeys.map((dateStr, idx) => {
                    const post = posts[dateStr];
                    const postTypeConfig = POST_TYPES.find(pt => pt.id === post.type);
                    return (
                      <div key={dateStr} id={`post-${dateStr}`} className="space-y-4 scroll-mt-24">
                        <div className="flex items-center gap-4 text-[var(--color-primary)] opacity-80 mb-4 pl-6">
                          <div className="w-2 h-2 rounded-full bg-current" />
                          <h3 className="font-display font-bold  uppercase">{format(new Date(dateStr + 'T00:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })}</h3>
                          <div className="flex-1 h-px bg-current opacity-20" />
                        </div>
                        <PostPreview key={dateStr} post={post} date={dateStr} postTypeConfig={postTypeConfig} postNumber={idx + 1} reviewToken={reviewToken} isExport={isExport} />
                        {idx < sortedPostKeys.length - 1 && (
                          <div className="w-full flex items-center justify-center opacity-30 mt-24 mb-24">
                            <div className="h-px w-full max-w-xs bg-gradient-to-r from-transparent via-black dark:via-white to-transparent" />
                            <LayoutTemplate className="w-6 h-6 mx-4" />
                            <div className="h-px w-full max-w-xs bg-gradient-to-r from-transparent via-black dark:via-white to-transparent" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-black/10 dark:border-white/10 flex justify-center opacity-40 text-[9px] font-bold uppercase tracking-[0.12em] relative z-10 w-full text-center whitespace-normal [overflow-wrap:break-word] [word-break:normal] mt-16 pt-8">
                  <span>Agência Terceiro Andar • {username} • {format(currentDate, 'MMMM yyyy', { locale: ptBR })}</span>
                </div>
              </motion.div>
            )}

            {/* FINAL PAGE: FEED PREVIEW & FOOTER */}
            {(
              <PresentationFeedPreview
              handle={handle}
              name={name}
              numPosts={numPosts}
              followers={followers}
              following={following}
              bio={bio}
              avatar={avatar}
              sortedPostKeys={sortedPostKeys}
              posts={posts}
              userRole={userRole}
              canSend={canSend}
              sent={sent}
              onExit={onExit}
              onSendToClient={onSendToClient}
              currentDate={currentDate}
              username={username}
              token={token}
              isExport={isExport}
              />
            )}
          </>
        )}
      </main>
    </div>
  );

  if (userRole && onNavigate) {
    return (
      <MainLayout activeScreen="viewer" onNavigate={onNavigate} currentClient={currentClient}>
        {mainContent}
      </MainLayout>
    );
  }
  return mainContent;
}



