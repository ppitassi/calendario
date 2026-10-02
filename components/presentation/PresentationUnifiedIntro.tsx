"use client";
/**
 * Card Macro Unificado da Apresentação:
 * Junta Capa (Hero), Resumo Estratégico (Formatos e Funil) e Calendário Mensal
 * em um ÚNICO card longo contínuo, preservando integralmente o conteúdo e proporções originais
 * dos 3 blocos empilhados verticalmente com divisores sutis em vidro.
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { format, getDaysInMonth, startOfMonth, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowUpRight,
  Image as ImageIcon,
  Clock,
} from "lucide-react";
import type { CalendarRecord, ContentItem } from "@/lib/types";
import { DAY_NAMES, POST_TYPES } from "@/lib/constants";
import { Button } from "../ui/Button/Button";
import styles from "./PresentationUnifiedIntro.module.css";

interface PresentationUnifiedIntroProps {
  calendar: CalendarRecord;
  month: Date;
  items: ContentItem[];
  isPreCalendar?: boolean;
}

export function PresentationUnifiedIntro({
  calendar,
  month,
  items,
  isPreCalendar = false,
}: PresentationUnifiedIntroProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const brandInitials = (calendar.brand || "CP").slice(0, 2).toUpperCase();

  // 1. Métricas calculadas para o Resumo do Planejamento
  const metrics = useMemo(() => {
    const total = items.length;
    if (total === 0) {
      return {
        total: 0,
        formats: [
          { label: "Feed e Story", value: 0, tone: styles.feedStory },
          { label: "Feed", value: 0, tone: styles.feed },
          { label: "Stories", value: 0, tone: styles.story },
          { label: "Carrossel", value: 0, tone: styles.middle },
          { label: "Reels", value: 0, tone: styles.bottom },
        ],
        funnel: [
          { label: "Topo", value: 0, tone: styles.top },
          { label: "Meio", value: 0, tone: styles.middle },
          { label: "Fundo", value: 0, tone: styles.bottom },
        ],
      };
    }

    const counts = { "Feed e Story": 0, Feed: 0, Story: 0, Carrossel: 0, Reels: 0 };
    const funnelCounts = { Topo: 0, Meio: 0, Fundo: 0 };

    for (const item of items) {
      const rawType = (item.type || "").toLowerCase();
      if (rawType === "feed") counts.Feed++;
      else if (rawType === "story" || rawType === "stories") counts.Story++;
      else if (rawType === "carrossel" || rawType === "carousel") counts.Carrossel++;
      else if (rawType === "reels" || rawType === "reel") counts.Reels++;
      else counts["Feed e Story"]++;

      const stage = item.funnelStage || "Topo";
      if (funnelCounts[stage] !== undefined) funnelCounts[stage]++;
      else funnelCounts.Topo++;
    }

    const pct = (n: number) => Math.round((n / total) * 100);

    return {
      total,
      formats: [
        { label: "Feed e Story", value: pct(counts["Feed e Story"]), tone: styles.feedStory },
        { label: "Feed", value: pct(counts.Feed), tone: styles.feed },
        { label: "Stories", value: pct(counts.Story), tone: styles.story },
        { label: "Carrossel", value: pct(counts.Carrossel), tone: styles.middle },
        { label: "Reels", value: pct(counts.Reels), tone: styles.bottom },
      ],
      funnel: [
        { label: "Topo", value: pct(funnelCounts.Topo), tone: styles.top },
        { label: "Meio", value: pct(funnelCounts.Meio), tone: styles.middle },
        { label: "Fundo", value: pct(funnelCounts.Fundo), tone: styles.bottom },
      ],
    };
  }, [items]);

  // Metadados estratégicos cadastrados
  const persistedDetails = useMemo(() => {
    return Object.entries({
      Segmento: calendar.segment || "Geral",
      "Tom de voz": calendar.tone || "Profissional, acolhedor e estratégico",
      "Público-alvo": calendar.audience || "Público qualificado da marca",
      Observações: calendar.strategy || calendar.objective || "",
    }).filter((entry): entry is [string, string] => Boolean(entry[1]));
  }, [calendar]);

  // 2. Indexação de posts por data para o Calendário Mensal
  const postsByDate = useMemo(() => {
    const map = new Map<string, ContentItem[]>();
    items.forEach((item) => {
      const list = map.get(item.date) || [];
      list.push(item);
      map.set(item.date, list);
    });
    return map;
  }, [items]);

  const handleDayClick = (dateStr: string) => {
    if (postsByDate.has(dateStr)) {
      setSelectedDate(dateStr === selectedDate ? null : dateStr);
    }
  };

  const scrollToPost = (postId: string) => {
    const element = document.getElementById(`post-${postId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setSelectedDate(null);
    }
  };

  const safeMonth = month instanceof Date && !isNaN(month.getTime()) ? month : new Date();
  const daysCount = getDaysInMonth(safeMonth);
  const firstDay = getDay(startOfMonth(safeMonth));

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={styles.unifiedCard}
    >
      {/* ============================================================== */}
      {/* 1. SEÇÃO HERO / CAPA (Conteúdo original preservado integralmente) */}
      {/* ============================================================== */}
      <section className={styles.heroSection}>
        {calendar.client_logo_url ? (
          <motion.img
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            src={calendar.client_logo_url}
            alt={calendar.brand}
            className={styles.heroLogoImage}
          />
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={styles.logoBadge}
          >
            <span>{brandInitials}</span>
          </motion.div>
        )}

        {isPreCalendar ? (
          <span className={styles.preCalendarHeroBadge}>
            📝 Pré-Calendário • Validação de Copywriting
          </span>
        ) : (
          <span className={styles.heroPretitle}>Planejamento de Conteúdo</span>
        )}

        <h1 className={styles.heroTitle}>
          Proposta de <br />
          <span>Conteúdo Social</span>
        </h1>

        <p className={styles.heroSubtitle}>
          Apresentação oficial de <strong>{calendar.brand}</strong> •{" "}
          {format(month, "MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </section>

      {/* Divisor elegante sutil entre blocos do card longo */}
      <div className={styles.sectionDivider} />

      {/* ============================================================== */}
      {/* 2. SEÇÃO RESUMO DO PLANEJAMENTO (3 colunas originais preservadas) */}
      {/* ============================================================== */}
      <section className={styles.strategySection}>
        <div className={styles.sectionHeadingLeft}>
          <h2 className={styles.sectionTitle}>Resumo do planejamento</h2>
          <p className={styles.sectionDescription}>
            Indicadores calculados exclusivamente a partir das publicações cadastradas.
          </p>
        </div>

        {/* Grade de 3 colunas: Volume mensal | Formatos | Etapas do funil */}
        <div className={styles.metricsGrid}>
          {/* Card Volume */}
          <div className={styles.metricCard}>
            <span className={styles.metricCardLabel}>Volume mensal</span>
            <p className={styles.volumeTotal}>{metrics.total}</p>
          </div>

          {/* Card Formatos */}
          <div className={styles.metricCard}>
            <span className={styles.metricCardLabel}>Formatos</span>
            <div className={styles.barsList}>
              {metrics.formats.map((f) => (
                <div key={f.label} className={styles.metricItem}>
                  <div className={styles.metricHeader}>
                    <span>{f.label}</span>
                    <span>{f.value}%</span>
                  </div>
                  <div className={styles.track}>
                    <div
                      className={`${styles.fill} ${f.tone}`}
                      style={{ width: `${f.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card Funil */}
          <div className={styles.metricCard}>
            <span className={styles.metricCardLabel}>Etapas do funil informadas</span>
            <div className={styles.barsList}>
              {metrics.funnel.map((fn) => (
                <div key={fn.label} className={styles.metricItem}>
                  <div className={styles.metricHeader}>
                    <span>{fn.label}</span>
                    <span>{fn.value}%</span>
                  </div>
                  <div className={styles.track}>
                    <div
                      className={`${styles.fill} ${fn.tone}`}
                      style={{ width: `${fn.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Detalhes estratégicos em 2 colunas */}
        {persistedDetails.length > 0 && (
          <dl className={styles.detailsGrid}>
            {persistedDetails.map(([label, value]) => (
              <div key={label} className={styles.detailItem}>
                <dt className={styles.detailLabel}>{label}</dt>
                <dd className={styles.detailValue}>{value}</dd>
              </div>
            ))}
            {calendar.pillars && (
              <div className={styles.detailItem}>
                <dt className={styles.detailLabel}>Colunas de conteúdo</dt>
                <dd className={styles.detailValue}>{calendar.pillars}</dd>
              </div>
            )}
          </dl>
        )}
      </section>

      {/* Divisor elegante sutil entre blocos do card longo */}
      <div className={styles.sectionDivider} />

      {/* ============================================================== */}
      {/* 3. SEÇÃO CALENDÁRIO MENSAL (Grade original completa com popover) */}
      {/* ============================================================== */}
      <section className={styles.calendarSection}>
        <div className={styles.calendarHeading}>
          <p className={styles.calendarPretitle}>Visão Macro</p>
          <h2 className={styles.calendarTitle}>Calendário Mensal</h2>
        </div>

        <div className={styles.calendarCardInner}>
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
              const day = i + 1;
              const dateStr = format(
                new Date(safeMonth.getFullYear(), safeMonth.getMonth(), day),
                "yyyy-MM-dd"
              );
              const dayPosts = postsByDate.get(dateStr) || [];
              const primaryPost = dayPosts[0];
              const postTypeConfig = primaryPost
                ? POST_TYPES.find((pt) => {
                    const t = primaryPost.type.toLowerCase();
                    return (
                      pt.id === t ||
                      (pt.id === "feed" && (t === "feed" || t === "post")) ||
                      (pt.id === "story" && (t === "story" || t === "stories")) ||
                      (pt.id === "carrossel" && (t === "carrossel" || t === "carousel")) ||
                      (pt.id === "reels" && (t === "reels" || t === "reel" || t === "vídeo" || t === "video")) ||
                      (pt.id === "feed e story" &&
                        !["feed", "story", "stories", "post", "carrossel", "carousel", "reels", "reel", "video", "vídeo"].includes(t))
                    );
                  })
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
                      <div className={styles.multiCountBadge}>
                        {dayPosts.length}
                      </div>
                    )}
                  </motion.button>

                  {/* Popover completo de publicações com navegação direta */}
                  <AnimatePresence>
                    {isSelected && dayPosts.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.9, x: "-50%" }}
                        animate={{ opacity: 1, y: -10, scale: 1, x: "-50%" }}
                        exit={{ opacity: 0, y: 10, scale: 0.9, x: "-50%" }}
                        className={styles.popover}
                      >
                        {dayPosts.map((post: ContentItem, pIdx: number) => (
                          <div
                            key={post.id}
                            className={styles.popoverItem}
                            style={{
                              borderBottom:
                                pIdx < dayPosts.length - 1
                                  ? "1px solid var(--glass-border, rgba(0,0,0,0.08))"
                                  : "none",
                            }}
                          >
                            {!isPreCalendar && (
                              <div className={styles.popoverPreview}>
                                {post.imageUrl ? (
                                  <img src={post.imageUrl} alt="Preview" />
                                ) : (
                                  <div className={styles.popoverPreviewEmpty}>
                                    <ImageIcon />
                                  </div>
                                )}
                                <div className={styles.popoverTypeBadge}>
                                  {post.type}
                                  {post.isCollab
                                    ? " · Collab"
                                    : post.profile
                                    ? ` · ${post.profile}`
                                    : ""}
                                </div>
                              </div>
                            )}

                            <div className={styles.popoverCopy}>
                              <h4>{post.head || post.title || "Sem título"}</h4>
                              {(post.subhead || post.caption) && (
                                <p>{post.subhead || post.caption}</p>
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
                              {isPreCalendar
                                ? `VER COPY ${dayPosts.length > 1 ? `#${pIdx + 1}` : "COMPLETO"}`
                                : `VER POST ${dayPosts.length > 1 ? `#${pIdx + 1}` : "COMPLETO"}`}
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
      </section>
    </motion.div>
  );
}
