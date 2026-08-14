import React from "react";
import { motion } from "motion/react";
import { LayoutTemplate } from "lucide-react";
import { useTheme } from "../components/ThemeProvider";
import { cn } from "../lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { BackgroundEffects } from "../components/BackgroundEffects";
import { PostPreview } from "../components/PostPreview";
import { PresentationCurveBg } from "../components/PresentationCurveBg";
import { PresentationStrategy } from "../widgets/PresentationStrategy";
import { PresentationCalendar } from "../widgets/PresentationCalendar";
import { POST_TYPES } from "../lib/constants";
import { PostData, ClientData } from "../types";
import { MainLayout } from "../components/MainLayout";
import { ViewerHeader } from "./viewer/ViewerHeader";
import type { PresentationViewModel } from "../../lib/presentation-model";
import styles from "./ViewerScreen.module.css";

export function ViewerScreen({
  posts,
  client,
  userRole,
  currentDate,
  onExit,
  username,
  onPrevMonth,
  onNextMonth,
  user,
  currentClient,
  onNavigate,
  reviewToken,
  isExport = false,
  presentationModel,
}: {
  posts: Record<string, PostData>;
  client: ClientData;
  userRole: string;
  currentDate: Date;
  onExit: () => void;
  onSendToClient?: () => void;
  username?: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  user?: any;
  currentClient?: ClientData | null;
  onNavigate?: (screen: string) => void;
  reviewToken?: string;
  isExport?: boolean;
  presentationModel?: PresentationViewModel;
}) {
  const { isDark } = useTheme();
  const token = reviewToken;
  const canSend = userRole === "admin" || userRole === "atendimento";
  const [sent, setSent] = React.useState(false);
  const [remoteModel,setRemoteModel]=React.useState<PresentationViewModel|null>(presentationModel||null);
  const [modelError,setModelError]=React.useState("");
  const monthKey=format(currentDate,"yyyy-MM");
  React.useEffect(()=>{setRemoteModel(presentationModel||null);if(presentationModel||!userRole||!client.id)return;const controller=new AbortController();setModelError("");fetch(`/api/presentation/${encodeURIComponent(client.id)}/${monthKey}`,{credentials:"include",signal:controller.signal}).then(async response=>{if(!response.ok)throw new Error(response.status===403?"Acesso negado.":"Não foi possível carregar a apresentação.");return response.json()}).then(setRemoteModel).catch(error=>{if(error?.name!=="AbortError")setModelError(error instanceof Error?error.message:"Falha ao carregar a apresentação.")});return()=>controller.abort()},[client.id,monthKey,userRole,presentationModel]);
  const activeModel=remoteModel?.cliente.id===String(client.id)&&remoteModel.competencia===monthKey?remoteModel:null;
  const modelLoading=Boolean(userRole&&!presentationModel&&!activeModel&&!modelError);
  const viewPosts=React.useMemo(()=>{if(!activeModel)return userRole?{}:posts;const sourceById=new Map(Object.values(posts).map(post=>[String(post.id),post]));return Object.fromEntries(activeModel.posts.map(item=>{const original=sourceById.get(item.id)||({} as PostData);return [`${item.data}#${item.id}`,{...original,id:item.id,date:item.data,type:item.formato==="feed"?"post":item.formato,head:item.titulo||"",subhead:item.subtitulo||"",subtitle:item.subtitulo||"",caption:item.legenda||"",objective:item.objetivo||"",theme:item.tema||"",script:item.roteiro||"",funnelStage:item.etapaFunil||undefined,videoUrl:item.videoUrl||undefined,feedImages:item.midias.filter(media=>media.state==="ready"&&media.url).map(media=>media.url!)} as PostData] }))},[posts,activeModel,userRole]);

  const targetMonth = currentDate.getMonth();
  const targetYear = currentDate.getFullYear();

  const sortedPostKeys = Object.keys(viewPosts)
    .filter((postKey) => {
      const dateStr = viewPosts[postKey].date || postKey.split("#")[0];
      const d = new Date(dateStr + "T00:00:00");
      return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
    })
    .sort((a, b) => {
      const dateA = viewPosts[a].date || a.split("#")[0], dateB = viewPosts[b].date || b.split("#")[0];
      return dateA.localeCompare(dateB) || String(viewPosts[a].id || a).localeCompare(String(viewPosts[b].id || b), "pt-BR", { numeric: true });
    });

  const canonicalClient = React.useMemo(() => activeModel ? {...client,name:activeModel.cliente.nome,logoUrl:activeModel.cliente.logoState==="ready"?activeModel.cliente.logoUrl||undefined:undefined} : client,[client,activeModel]);
  const avatar = activeModel ? (activeModel.cliente.logoState==="ready"?activeModel.cliente.logoUrl:null) : (userRole?null:client.logoUrl||null);

  const mainContent = (
    <div
      className={cn(
        styles.root,
        !userRole && styles.publicRoot,
      )}
    >
      {!userRole && !isExport && <BackgroundEffects />}
      {!userRole && !isExport && <PresentationCurveBg />}

      <ViewerHeader
        isExport={isExport}
        userRole={userRole}
        client={canonicalClient}
        currentDate={currentDate}
        onExit={onExit}
        onPrevMonth={onPrevMonth}
        onNextMonth={onNextMonth}
        canSend={canSend}
        sent={sent}
        setSent={setSent}
        user={user}
        token={token}
        isDark={isDark}
      />

      <main
        className={cn(
          styles.main,
          isExport
            ? cn("print-main", styles.exportMain)
            : userRole
              ? styles.appMain
              : styles.publicMain,
        )}
      >
        {modelError ? <div role="alert" className={styles.error}>{modelError}</div> : null}
        {modelLoading ? <div role="status" aria-live="polite" className={styles.loading}>Carregando apresentação validada…</div> : sortedPostKeys.length === 0 ? (
          <div className={styles.empty}>
            <LayoutTemplate />
            <h2>Nenhum conteúdo aprovado para esta competência</h2>
            <p>O planejamento não possui publicações disponíveis para apresentação.</p>
          </div>
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              className={cn("print-compact-section", styles.hero)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className={styles.logo}
              >
                {avatar ? (
                  <img src={avatar} alt={`Logo de ${canonicalClient.name}`} />
                ) : (
                  <span>{canonicalClient.name.substring(0, 2).toUpperCase()}</span>
                )}
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className={styles.heroTitle}
              >
                Proposta de <br />
                <span>Conteúdo Social</span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
                className={styles.heroSubtitle}
              >
                Planejamento de conteúdo de <strong>{canonicalClient.name}</strong>.
              </motion.p>
            </motion.div>

            <PresentationStrategy model={activeModel!} />

            <PresentationCalendar currentDate={currentDate} posts={viewPosts} />

            {sortedPostKeys.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                className={cn("print-posts-section", styles.postsSection)}
              >
                <div className={styles.sectionHeading}>
                  <p>Calendário de Conteúdo</p>
                  <h2>Postagens do Mês</h2>
                </div>

                <div className={styles.postsList}>
                  {sortedPostKeys.map((postKey, idx) => {
                    const post = viewPosts[postKey];
                    const dateStr = post.date || postKey.split("#")[0];
                    const postTypeConfig = POST_TYPES.find((pt) => pt.id === post.type);
                    return (
                      <div key={postKey} id={`post-${post.id || postKey}`} className={styles.postItem}>
                        <div className={styles.postDate}>
                          <div />
                          <h3>{format(new Date(dateStr + "T00:00:00"), "EEEE, dd 'de' MMMM", { locale: ptBR })}</h3>
                          <div />
                        </div>
                        <PostPreview key={dateStr} post={post} date={dateStr} postTypeConfig={postTypeConfig} postNumber={idx + 1} reviewToken={reviewToken} isExport={isExport} />
                        {idx < sortedPostKeys.length - 1 && (
                          <div className={styles.separator}>
                            <div />
                            <LayoutTemplate />
                            <div />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className={styles.footer}>
                  <span>
                    Agência Terceiro Andar • {username} • {format(currentDate, "MMMM yyyy", { locale: ptBR })}
                  </span>
                </div>
              </motion.div>
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
