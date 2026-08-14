import React from "react";
import { motion } from "motion/react";
import { ChevronRight, Trash2, Instagram, Youtube } from "lucide-react";
import { ClientData } from "../../types";
import { IconButton } from "../../components/ui/IconButton/IconButton";
import styles from "./ClientCard.module.css";

type ClientCardProps = {
  client: ClientData;
  idx: number;
  viewMode: "grid" | "list";
  isAdmin: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
};

export function ClientCard({
  client,
  idx,
  viewMode,
  isAdmin,
  onSelect,
  onDelete,
}: ClientCardProps) {
  const hasMeta = !!client.meta_account_id;
  const hasYT = !!client.youtube_channel_id;

  return (
    <motion.div
      key={client.id}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.03 }}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Abrir áreas de trabalho de ${client.name}`}
      className={styles.card}
      data-view={viewMode}
    >
      <div className={styles.glow} />

      <div className={styles.identity}>
        <div className={styles.logo}>
          {client.logoUrl ? (
            <img src={client.logoUrl} alt={client.name} />
          ) : (
            <span>
              {client.name.substring(0, 2).toUpperCase()}
            </span>
          )}
        </div>
        <div className={styles.copy}>
          <h4>
            {client.name}
          </h4>
          <div className={styles.integrations}>
            {hasMeta && (
              <span data-platform="instagram" title="Instagram Integrado">
                <Instagram />
              </span>
            )}
            {hasYT && (
              <span data-platform="youtube" title="YouTube Integrado">
                <Youtube />
              </span>
            )}
            {!hasMeta && !hasYT && (
              <span className={styles.noApi}>
                Sem API
              </span>
            )}
          </div>
        </div>
      </div>

      {viewMode === "grid" ? (
        <div className={styles.cardFooter}>
          <div className={styles.manageLabel}>
            Gerenciar Marca <ChevronRight />
          </div>

          {isAdmin && (
            <IconButton
              label={`Excluir ${client.name}`}
              onClick={onDelete}
              className={styles.deleteGrid}
              variant="danger"
              size="small"
            >
              <Trash2 />
            </IconButton>
          )}
        </div>
      ) : (
        <div className={styles.listActions}>
          {isAdmin && (
            <IconButton
              label={`Excluir ${client.name}`}
              onClick={onDelete}
              className={styles.deleteList}
              variant="danger"
            >
              <Trash2 />
            </IconButton>
          )}
          <ChevronRight />
        </div>
      )}
    </motion.div>
  );
}
