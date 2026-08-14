import { MessageSquare, Send } from "lucide-react";
import { format } from "date-fns";
import { ClientData, PostData } from "../../types";
import { EditorCapabilities } from "../../lib/editor-capabilities";
import { useState } from "react";
import { Select } from "../../components/ui/Select/Select";
import { Input } from "../../components/ui/Input/Input";
import { IconButton } from "../../components/ui/IconButton/IconButton";
import { Button } from "../../components/ui/Button/Button";
import { Modal } from "../../components/ui/Modal/Modal";
import styles from "./PlannerPreviewPanel.module.css";

type PlannerPreviewPanelProps = {
  currentPost: PostData | null;
  currentClient: ClientData | null;
  comments: any[];
  newComment: string;
  setNewComment: (val: string) => void;
  handleAddComment: () => void;
  updateCurrentPost: (updates: Partial<PostData>) => void;
  editorCapabilities: EditorCapabilities;
};

export function PlannerPreviewPanel({
  currentPost,
  currentClient,
  comments,
  newComment,
  setNewComment,
  handleAddComment,
  updateCurrentPost,
  editorCapabilities,
}: PlannerPreviewPanelProps) {
  const [showAllComments, setShowAllComments] = useState(false);
  if (!currentPost) return null;

  return (
    <div className={styles.root}>
      <div className={styles.fieldGroup}>
        <span className={styles.sectionLabel}>Status da Publicação</span>
        <Select
          value={currentPost.status || "planejado"}
          onChange={(e) => updateCurrentPost({ status: e.target.value as any })}
          className="w-full"
        >
          <option value="planejado">Planejado</option>
          <option value="em produção">Em Produção</option>
          <option value="aguardando aprovação">Aguardando Aprovação</option>
          <option value="aprovado">Aprovado</option>
          <option value="ajuste solicitado">Ajuste Solicitado</option>
        </Select>
      </div>

      {currentPost.funnelStage && (
        <div className={styles.funnel}>
          <span>Etapa do Funil</span>
          <span>
            {currentPost.funnelStage === "topo"
              ? "Topo"
              : currentPost.funnelStage === "meio"
                ? "Meio"
                : "Fundo"}
          </span>
        </div>
      )}

      <div className={styles.previewArea}>
        <span className={styles.sectionLabel}>Prévia do Card (Feed)</span>
        <div className={styles.feedCard}>
          <div className={styles.feedHeader}>
            <div className={styles.avatar}>
              {currentClient?.name?.substring(0, 2).toUpperCase()}
            </div>
            <div className={styles.feedIdentity}>
              <strong>{currentClient?.name}</strong>
              <span>Patrocinado • Instagram</span>
            </div>
          </div>
          <div className={styles.media}>
            {(() => {
              const imgs = currentPost.feedImages || [];
              if (imgs.length > 0) {
                return <img src={imgs[0]} alt="Post preview" />;
              }
              return <span>Nenhuma mídia enviada</span>;
            })()}
          </div>
          <div className={styles.feedCopy}>
            <strong>{currentPost.head || currentPost.title}</strong>
            <p>{currentPost.subtitle || currentPost.caption}</p>
            {currentPost.cta && <em>{currentPost.cta}</em>}
            {currentPost.hashtags && <code>{currentPost.hashtags}</code>}
          </div>
        </div>
      </div>

      <div className={styles.commentsSection}>
        <span className={styles.sectionLabel}>
          <MessageSquare /> Comentários ({comments.length})
        </span>
        {comments.length > 3 ? <Button onClick={() => setShowAllComments(true)} size="small" variant="ghost">Ver todos os comentários</Button> : null}
        <div className={styles.commentList}>
          {comments.length === 0 ? (
            <p className={styles.empty}>Nenhum comentário.</p>
          ) : (
            comments.slice(-3).map((c, i) => (
              <div key={i} className={styles.comment}>
                <div className={styles.commentHeader}>
                  <strong>{c.authorName} ({c.authorRole})</strong>
                  <time>{format(new Date(c.createdAt), "dd/MM HH:mm")}</time>
                </div>
                <p>{c.content}</p>
              </div>
            ))
          )}
        </div>
        {editorCapabilities.canComment && (
          <div className={styles.composer}>
            <Input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Adicionar nota..."
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddComment();
              }}
            />
            <IconButton onClick={handleAddComment} label="Adicionar comentário" variant="glass">
              <Send />
            </IconButton>
          </div>
        )}
      </div>
      <Modal open={showAllComments} onClose={() => setShowAllComments(false)} title={`Todos os comentários (${comments.length})`} className="w-full max-w-lg">
        <div className={styles.modalComments}>
          {comments.map((comment, index) => <article key={index} className={styles.comment}><div className={styles.commentHeader}><strong>{comment.authorName} ({comment.authorRole})</strong><time>{format(new Date(comment.createdAt), "dd/MM HH:mm")}</time></div><p>{comment.content}</p></article>)}
        </div>
      </Modal>
    </div>
  );
}
