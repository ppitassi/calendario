import { useState, useEffect } from "react";
import { Image as ImageIcon, Target, ArrowUpRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { auth } from "../lib/auth";
import { api } from "../lib/api";
import { PostData, ROLE_PERMISSIONS, UserRole } from "../types";
import { PostPreviewVisualsOnly } from "./PostPreviewVisualsOnly";
import { SlideshowViewer } from "../widgets/SlideshowViewer";
import { Lightbox } from "./Lightbox";
import { PostPreviewComments } from "./post-preview/PostPreviewComments";
import styles from "./PostPreview.module.css";

export function PostPreview({
  post,
  date,
  postTypeConfig,
  postNumber,
  reviewToken,
  isExport = false,
}: {
  post: PostData;
  date: string;
  postTypeConfig?: any;
  key?: string | number;
  postNumber: number;
  reviewToken?: string;
  isExport?: boolean;
}) {
  const token = reviewToken;
  const [commentInput, setCommentInput] = useState("");
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
      console.error("Erro ao buscar comentários:", e);
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
        const author = auth.currentUser?.displayName || auth.currentUser?.email || "Cliente";
        await api.addPublicPostComment(token, Number(post.id), author, commentInput);
      } else {
        await api.addPostComment(Number(post.id), commentInput);
      }
      setCommentInput("");
      fetchComments();
    } catch (err: any) {
      console.error("Erro ao salvar comentário:", err.message);
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

  return (
    <div className={styles.root}>
      <div className={styles.heading}>
        <h2>Modo de Visualização</h2>
      </div>

      <div className={styles.card}>
        <div className={styles.glow} />

        <div className={styles.content}>
          <div className={styles.overview}>
            <div className={styles.copy}>
              <div className={styles.metadata}>
                <div className={styles.postNumberGroup}>
                  <div className={styles.postNumber}>
                    Post {String(postNumber).padStart(2, "0")}
                  </div>
                  <div className={styles.postArrow}>
                    <ArrowUpRight />
                  </div>
                </div>
                <div className={styles.metaPill}>
                  {format(new Date(date + "T00:00:00"), "dd MMM, yyyy", { locale: ptBR })}
                </div>
                <div className={styles.metaPill}>
                  <Icon /> {postTypeConfig?.label}
                </div>
                {post.funnelStage && (
                  <div className={styles.funnelPill}>
                    Funil: {post.funnelStage === "topo" ? "Topo" : post.funnelStage === "meio" ? "Meio" : "Fundo"}
                  </div>
                )}
              </div>

              <div className={styles.titleBlock}>
                <h1>
                  {post.head || post.artHeadline || (post as any).headline || <span className="opacity-40">Não informado</span>}
                </h1>
                {post.subhead && <h2>{post.subhead}</h2>}
              </div>

              <div className={styles.caption}>
                <p>
                  {post.subtitle || post.caption || <span className="opacity-40">Não informado</span>}
                </p>
              </div>

              <div className={styles.details}>
                {post.type === "reel" && (
                  <div className={styles.scriptCard}>
                    <div>
                      <span>Tema</span>
                      <strong>{post.theme || "Não informado"}</strong>
                    </div>
                    <div>
                      <span>Rascunho de Roteiro</span>
                      <div className={styles.scriptText}>
                        {post.script || "Não informado"}
                      </div>
                    </div>
                  </div>
                )}

                <div className={styles.objective}>
                  <div className={styles.objectiveIcon}>
                    <Target />
                  </div>
                  <div>
                    <span>Objetivo</span>
                    <strong>{post.objective || "Não informado"}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.visuals}>
              {post.type === "carousel" ? (
                <SlideshowViewer images={Array.isArray(post.feedImages) ? post.feedImages : post.feedImages ? [post.feedImages] : []} expandable />
              ) : (
                <PostPreviewVisualsOnly post={post} onClick={() => setLightboxOpen(true)} />
              )}
            </div>
          </div>

          <PostPreviewComments
            comments={comments}
            loadingComments={loadingComments}
            canWriteComment={canWriteComment}
            isExport={isExport}
            commentInput={commentInput}
            setCommentInput={setCommentInput}
            postId={post.id}
            onSaveComment={handleSaveComment}
            userRole={auth.currentUser?.role}
          />
        </div>
      </div>
      <Lightbox
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        images={([...(post.feedImages || []), post.coverImage, post.linkedinCover, post.storyImage].filter(Boolean) as string[])}
      />
    </div>
  );
}
