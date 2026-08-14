import { Image as ImageIcon, Users } from "lucide-react";
import { ClientData, UserProfile } from "../../types";
import { elapsed, extractImages, GalleryPost, statusLabel } from "./gallery-helpers";
import styles from "./GalleryCard.module.css";

type GalleryCardProps = {
  post: GalleryPost;
  clients: ClientData[];
  members: UserProfile[];
  onOpenPost: (client: ClientData, post: GalleryPost) => void;
};

export function GalleryCard({
  post,
  clients,
  members,
  onOpenPost,
}: GalleryCardProps) {
  const client = clients.find((item) => item.id === post.clientId);
  const media = extractImages(post);
  const assignee = members.find(
    (user) =>
      user.uid ===
      String(
        post.currentAssigneeId || post.assigneeId || post.assignedTo || "",
      ),
  );

  return (
    /* style-architecture-button-exception: gallery cards are feature-specific navigable media records. */
    <button
      key={String(post.id || `${post.clientId}-${post.date}`)}
      onClick={() => client && onOpenPost(client, post)}
      className={styles.card}
    >
      <div className={styles.media}>
        {media[0] ? (
          <img
            src={media[0]}
            alt=""
            loading="lazy"
            className={styles.image}
          />
        ) : (
          <div className={styles.mediaEmpty}>
            <ImageIcon />
          </div>
        )}
        {media.length > 1 && (
          <span className={styles.mediaCount}>
            +{media.length - 1}
          </span>
        )}
        <span
          className={styles.status}
          data-status={statusLabel(post.status)}
        >
          {statusLabel(post.status, post.currentStage)}
        </span>
      </div>
      <div className={styles.content}>
        <div className={styles.meta}>
          <span className="truncate">{client?.name || "Cliente"}</span>
          <span>
            {String(post.date || "")
              .split("-")
              .reverse()
              .join("/")}
          </span>
        </div>
        <h3>
          {post.title || post.head || "Post sem título"}
        </h3>
        <div className={styles.assignment}>
          <span className="flex min-w-0 items-center gap-1 truncate">
            <Users />
            {assignee?.displayName || "Sem responsável"}
          </span>
          <span className="uppercase">{post.type || "post"}</span>
        </div>
        <div className={styles.stageMeta}>
          <span>{elapsed(post.stageEnteredAt)} na etapa</span>
          <span>
            {post.artworkCurrentVersion
              ? `V${post.artworkCurrentVersion}`
              : "Sem arte"}
          </span>
        </div>
      </div>
    </button>
  );
}
