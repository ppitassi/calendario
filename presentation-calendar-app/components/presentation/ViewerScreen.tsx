"use client";
/** Apresentação do calendário para leitura, compartilhamento e impressão. */


import { useMemo } from "react";
import { motion } from "motion/react";
import { LayoutTemplate } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { CalendarRecord, ContentItem } from "@/lib/types";
import { POST_TYPES } from "@/lib/constants";
import { shiftMonth } from "@/lib/date";
import { BackgroundEffects } from "./BackgroundEffects";
import { PresentationCurveBg } from "./PresentationCurveBg";
import { ViewerHeader } from "./ViewerHeader";
import { PresentationStrategy } from "./PresentationStrategy";
import { PresentationCalendar } from "./PresentationCalendar";
import { PostPreview } from "./PostPreview";
import styles from "./ViewerScreen.module.css";

/** Compõe capa, estratégia, visão mensal e cartões cronológicos do planejamento. */
export function ViewerScreen({
  calendar,
  month,
  items,
  onClose,
  onMonthChange,
}: {
  calendar: CalendarRecord;
  month: Date;
  items: ContentItem[];
  onClose: () => void;
  onMonthChange?: (newMonth: Date) => void;
}) {
  /** Ordena uma cópia dos posts por data sem modificar a ordem recebida do Studio. */
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.date.localeCompare(b.date)),
    [items]
  );

  const brandInitials = (calendar.brand || "CP").slice(0, 2).toUpperCase();

  return (
    <div
      className={styles.root}
      style={
        {
          "--color-action-primary": calendar.accent || "#ef5d3d",
          "--tenant-primary": calendar.accent || "#ef5d3d",
        } as React.CSSProperties
      }
    >
      <BackgroundEffects />
      <PresentationCurveBg />

      <ViewerHeader
        calendar={calendar}
        currentDate={month}
        onExit={onClose}
        onPrevMonth={() => onMonthChange && onMonthChange(shiftMonth(month, -1))}
        onNextMonth={() => onMonthChange && onMonthChange(shiftMonth(month, 1))}
      />

      {/* UI: documento contínuo que também serve de base para impressão/PDF. */}
      <main className={styles.main}>
        {/* UI: capa com logo, marca e contexto da proposta. */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className={styles.hero}
        >
          {calendar.client_logo_url ? (
            <motion.img
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              src={calendar.client_logo_url}
              alt={calendar.brand}
              className={styles.heroLogoImage}
            />
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className={styles.logo}
            >
              <span>{brandInitials}</span>
            </motion.div>
          )}

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
            Planejamento de conteúdo de <strong>{calendar.brand}</strong>.
          </motion.p>
        </motion.div>

        {/* UI: indicadores de formatos, funil e estratégia cadastrada. */}
        <PresentationStrategy calendar={calendar} items={sortedItems} />

        {/* UI: visão mensal com atalhos para os cartões completos. */}
        <PresentationCalendar currentDate={month} items={sortedItems} />

        {/* UI: lista cronológica dos briefings e respectivas artes. */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className={styles.postsSection}
        >
          <div className={styles.sectionHeading}>
            <p>Calendário de Conteúdo</p>
            <h2>Postagens do Mês</h2>
          </div>

          {sortedItems.length === 0 ? (
            <div className={styles.empty}>
              <LayoutTemplate />
              <h2>Nenhum conteúdo cadastrado para este mês</h2>
              <p>O planejamento não possui publicações cadastradas para esta competência.</p>
            </div>
          ) : (
            <div className={styles.postsList}>
              {sortedItems.map((post, idx) => {
                // O meio-dia evita mudança de data; IDs internos e nomes PT-BR aceitam formatos legados.
                const dateObj = new Date(post.date + "T12:00:00");
                const formattedDate = format(
                  dateObj,
                  "EEEE, dd 'de' MMMM",
                  { locale: ptBR }
                );
                const postTypeConfig = POST_TYPES.find(
                  (pt) =>
                    pt.id === post.type.toLowerCase() ||
                    (pt.id === "post" && post.type === "Post") ||
                    (pt.id === "carousel" && post.type === "Carrossel") ||
                    (pt.id === "reel" && post.type === "Reel") ||
                    (pt.id === "story" && post.type === "Story")
                );

                return (
                  <div
                    key={post.id}
                    id={`post-${post.id}`}
                    className={styles.postItem}
                  >
                    <div className={styles.postDate}>
                      <div />
                      <h3>{formattedDate}</h3>
                      <div />
                    </div>

                    <PostPreview
                      post={post}
                      date={post.date}
                      postTypeConfig={postTypeConfig}
                      postNumber={idx + 1}
                    />

                    {idx < sortedItems.length - 1 && (
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
          )}

          <div className={styles.footer}>
            <span>
              Agência Terceiro Andar • {calendar.brand} •{" "}
              {format(month, "MMMM yyyy", { locale: ptBR })}
            </span>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
