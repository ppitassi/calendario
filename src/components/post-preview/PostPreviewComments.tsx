import { MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { ROLE_LABELS, UserRole } from "../../types";
import { Input } from "../ui/Input/Input";
import { Button } from "../ui/Button/Button";
import styles from "./PostPreviewComments.module.css";

type PostPreviewCommentsProps = {
  comments: any[];
  loadingComments: boolean;
  canWriteComment: boolean;
  isExport: boolean;
  commentInput: string;
  setCommentInput: (val: string) => void;
  postId?: string;
  onSaveComment: () => void;
  userRole?: string;
};

export function PostPreviewComments({
  comments,
  loadingComments,
  canWriteComment,
  isExport,
  commentInput,
  setCommentInput,
  postId,
  onSaveComment,
  userRole,
}: PostPreviewCommentsProps) {
  return (
    <div className={styles.root}>
      <h3>
        <MessageSquare /> Comentários e Feedbacks{" "}
        {loadingComments && <span>carregando...</span>}
      </h3>
      <div className={styles.list}>
        {comments.map((c, idx) => (
          <div key={idx} className={styles.comment}>
            <div className={styles.commentMeta}>
              <span>
                {c.authorName} ({ROLE_LABELS[c.authorRole as UserRole] || c.authorRole})
              </span>
              <span>{format(new Date(c.createdAt), "dd/MM HH:mm")}</span>
            </div>
            <p>{c.content}</p>
          </div>
        ))}
        {!comments.length && <p className={styles.empty}>Sem comentários ainda.</p>}
      </div>

      {canWriteComment && !isExport && (
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            type="text"
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
            placeholder={!postId ? "Salve o post primeiro para poder comentar" : "Escreva um comentário, alteração ou feedback..."}
            disabled={!postId}
            className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && onSaveComment()}
          />
          <Button
            onClick={onSaveComment}
            disabled={!postId}
            variant="primary"
          >
            Enviar
          </Button>
        </div>
      )}
      {!canWriteComment && !isExport && (
        <p className={styles.readonlyHint}>
          Seu cargo ({ROLE_LABELS[userRole as UserRole] || userRole}) possui apenas permissão de visualização dos comentários.
        </p>
      )}
    </div>
  );
}
