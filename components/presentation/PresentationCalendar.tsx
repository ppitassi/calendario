/** Visão mensal resumida, com atalhos das datas para os cartões completos. */

import { useState, useMemo } from "react";
import { getDaysInMonth, startOfMonth, getDay, format } from "date-fns";
import { motion, AnimatePresence } from "motion/react";
import { ArrowUpRight, Image as ImageIcon, Clock } from "lucide-react";
import { DAY_NAMES, POST_TYPES } from "@/lib/constants";
import type { ContentItem } from "@/lib/types";
import { Button } from "../ui/Button/Button";
import styles from "./PresentationCalendar.module.css";

/** Competência e publicações que formam a grade da apresentação. */
interface PresentationCalendarProps {
  currentDate: Date;
  items: ContentItem[];
}

/** Agrupa posts por data e abre um popover navegável somente em dias preenchidos. */
export function PresentationCalendar({
  currentDate,
  items,
}: PresentationCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);



  /** Indexa os posts por data para preencher células e popovers sem refiltrar a lista. */
  const postsByDate = useMemo(() => {
    const map = new Map<string, ContentItem[]>();
    items.forEach((item) => {
      // Preserva a ordem recebida quando existe mais de um post na mesma data.
      const list = map.get(item.date) || [];
      list.push(item);
      map.set(item.date, list);
    });
    return map;
  }, [items]);

  /** Abre ou fecha somente dias preenchidos; datas vazias não criam popover. */
  const handleDayClick = (dateStr: string) => {
    if (postsByDate.has(dateStr)) {
      setSelectedDate(dateStr === selectedDate ? null : dateStr);
    }
  };

  /** Rola suavemente até o cartão completo do post e fecha o popover. */
  const scrollToPost = (postId: string) => {
    const element = document.getElementById(`post-${postId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setSelectedDate(null);
    }
  };

  const daysCount = getDaysInMonth(currentDate);
  const firstDay = getDay(startOfMonth(currentDate));

  return (
    <div className={`print-calendar ${styles.root}`}>
      <div className={styles.heading}>
        <p>Visão Macro</p>
        <h2>Calendário Mensal</h2>
      </div>

      {/* UI: cartão macro que contém grade, popover e camada de fechamento. */}
      <div className={styles.calendarCard}>
        {/* UI: cabeçalhos semanais, vazios iniciais e uma célula para cada dia do mês. */}
        <div className={styles.calendarGrid}>
          {DAY_NAMES.map((name) => (
            <div key={name} className={styles.dayName}>
              {name}
            </div>
          ))}

          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`pre-${i}`} className={styles.emptyDay} />
          ))}

          {Array.from({ length: daysCount }).map((_, i) => {
            // A primeira publicação determina ícone; a contagem representa todas as demais.
            const day = i + 1;
            const dateStr = format(
              new Date(currentDate.getFullYear(), currentDate.getMonth(), day),
              "yyyy-MM-dd"
            );
            const dayPosts = postsByDate.get(dateStr) || [];
            const primaryPost = dayPosts[0];
            const postTypeConfig = primaryPost
              ? POST_TYPES.find(
                  (pt) =>
                    pt.id === primaryPost.type.toLowerCase() ||
                    ((pt.id === "feed" || pt.id === "post") && (primaryPost.type === "Feed" || primaryPost.type === "Post")) ||
                    (pt.id === "carousel" && primaryPost.type === "Carrossel") ||
                    (pt.id === "reel" && primaryPost.type === "Reel") ||
                    (pt.id === "story" && (primaryPost.type === "Story" || (primaryPost.type as string) === "Stories"))
                )
              : null;
            const Icon = postTypeConfig?.icon;
            const isSelected = selectedDate === dateStr;

            return (
              <div key={day} style={{ position: "relative" }}>
                <motion.button
                  type="button"
                  onClick={() => handleDayClick(dateStr)}
                  whileHover={dayPosts.length > 0 ? { scale: 1.05, y: -2 } : {}}
                  whileTap={dayPosts.length > 0 ? { scale: 0.95 } : {}}
                  className={styles.day}
                  data-has-post={dayPosts.length > 0 || undefined}
                  data-selected={isSelected || undefined}
                >
                  <span>{day}</span>
                  {dayPosts.length === 1 && (
                    <>
                      <div className={styles.dayDeadline}>
                        <Clock />
                      </div>
                      {Icon && (
                        <div className={styles.dayType}>
                          <Icon />
                        </div>
                      )}
                    </>
                  )}
                  {dayPosts.length > 1 && (
                    <div style={{ position: "absolute", top: "3px", right: "3px", background: "var(--color-action-primary, #e3002f)", color: "#fff", borderRadius: "999px", fontSize: "9px", fontWeight: 900, minWidth: "16px", height: "16px", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 2px" }}>
                      {dayPosts.length}
                    </div>
                  )}
                </motion.button>

                {/* UI: popover lista os posts do dia e oferece atalho para cada cartão completo. */}
                <AnimatePresence>
                  {isSelected && dayPosts.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.9, x: "-50%" }}
                      animate={{ opacity: 1, y: -10, scale: 1, x: "-50%" }}
                      exit={{ opacity: 0, y: 10, scale: 0.9, x: "-50%" }}
                      className={styles.popover}
                      style={{ maxHeight: "360px", overflowY: "auto", width: "300px" }}
                    >
                      {dayPosts.map((post: ContentItem, pIdx: number) => (
                        <div key={post.id} style={{ borderBottom: pIdx < dayPosts.length - 1 ? "1px solid rgba(0,0,0,0.08)" : "none", paddingBottom: pIdx < dayPosts.length - 1 ? "12px" : "0", marginBottom: pIdx < dayPosts.length - 1 ? "12px" : "0" }}>
                          {/* UI: miniatura ou marcador vazio da mídia persistida no post. */}
                          <div className={styles.preview}>
                            {post.imageUrl ? (
                              <img src={post.imageUrl} alt="Preview" />
                            ) : (
                              <div className={styles.previewEmpty}>
                                <ImageIcon />
                              </div>
                            )}
                            <div className={styles.typeBadge}>
                              {post.type === "Post" ? "Feed" : post.type}
                              {post.isCollab ? " · Collab" : post.profile ? ` · ${post.profile}` : ""}
                            </div>
                          </div>

                          <div className={styles.popoverCopy}>
                            <h4>{post.head || post.title || "Sem título"}</h4>
                            {(post.subhead || post.caption) && (
                              <p style={{ maxHeight: "40px", overflow: "hidden" }}>{post.subhead || post.caption}</p>
                            )}
                            <div className={styles.deadlineBadge}>
                              <Clock />
                              <span>Status: {post.status}</span>
                            </div>
                          </div>

                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              scrollToPost(post.id);
                            }}
                            className="w-full"
                            variant="primary"
                            size="small"
                            icon={<ArrowUpRight />}
                          >
                            VER POST {dayPosts.length > 1 ? `#${pIdx + 1}` : "COMPLETO"}
                          </Button>
                        </div>
                      ))}

                      <div className={styles.arrow} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {selectedDate && (
          <div
            className={styles.closeLayer}
            onClick={() => setSelectedDate(null)}
          />
        )}
      </div>
    </div>
  );
}
