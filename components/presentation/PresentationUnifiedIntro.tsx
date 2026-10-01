"use client";
/**
 * Card Macro Unificado da Apresentação:
 * Junta Capa (Hero), Resumo Estratégico (Formatos e Funil) e Calendário Mensal em um único bloco.
 */

import { useMemo } from "react";
import { motion } from "motion/react";
import { format, getDaysInMonth, startOfMonth, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Layers } from "lucide-react";
import type { CalendarRecord, ContentItem } from "@/lib/types";
import styles from "./PresentationUnifiedIntro.module.css";

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function PresentationUnifiedIntro({
  calendar,
  month,
  items,
}: {
  calendar: CalendarRecord;
  month: Date;
  items: ContentItem[];
}) {
  const brandInitials = (calendar.brand || "CP").slice(0, 2).toUpperCase();

  // Métricas calculadas das publicações
  const metrics = useMemo(() => {
    const total = items.length;
    if (total === 0) {
      return {
        total: 0,
        formats: [
          { label: "Feed e Story", value: 0, color: "#8b5cf6" },
          { label: "Feed", value: 0, color: "#3b82f6" },
          { label: "Stories", value: 0, color: "#ec4899" },
          { label: "Carrossel", value: 0, color: "#10b981" },
          { label: "Reels", value: 0, color: "#f59e0b" },
        ],
        funnel: [
          { label: "Topo", value: 0, color: "#3b82f6" },
          { label: "Meio", value: 0, color: "#8b5cf6" },
          { label: "Fundo", value: 0, color: "#ef4444" },
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
        { label: "Feed e Story", value: pct(counts["Feed e Story"]), color: "#8b5cf6" },
        { label: "Feed", value: pct(counts.Feed), color: "#3b82f6" },
        { label: "Stories", value: pct(counts.Story), color: "#ec4899" },
        { label: "Carrossel", value: pct(counts.Carrossel), color: "#10b981" },
        { label: "Reels", value: pct(counts.Reels), color: "#f59e0b" },
      ],
      funnel: [
        { label: "Topo", value: pct(funnelCounts.Topo), color: "#3b82f6" },
        { label: "Meio", value: pct(funnelCounts.Meio), color: "#8b5cf6" },
        { label: "Fundo", value: pct(funnelCounts.Fundo), color: "#ef4444" },
      ],
    };
  }, [items]);

  // Indexação de posts por data para o calendário
  const postsByDate = useMemo(() => {
    const map = new Map<string, ContentItem[]>();
    items.forEach((item) => {
      const list = map.get(item.date) || [];
      list.push(item);
      map.set(item.date, list);
    });
    return map;
  }, [items]);

  const scrollToPost = (postId: string) => {
    const element = document.getElementById(`post-${postId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const daysCount = getDaysInMonth(month);
  const firstDay = getDay(startOfMonth(month));

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={styles.unifiedCard}
    >
      {/* 1. TOPO: Identidade da Marca e Título da Apresentação */}
      <div className={styles.cardHeader}>
        <div className={styles.brandLogoBox}>
          {calendar.client_logo_url ? (
            <img
              src={calendar.client_logo_url}
              alt={calendar.brand}
              className={styles.brandLogoImg}
            />
          ) : (
            <span className={styles.brandInitials}>{brandInitials}</span>
          )}
        </div>

        <div className={styles.headerInfo}>
          <span className={styles.headerBadge}>Planejamento de Conteúdo</span>
          <h1 className={styles.heroTitle}>
            Proposta de <span>Conteúdo Social</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Apresentação oficial de <strong>{calendar.brand}</strong> •{" "}
            {format(month, "MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
      </div>

      {/* 2. CORPO: Resumo do Planejamento (Esquerda) e Calendário Mensal (Direita) */}
      <div className={styles.mainGrid}>
        {/* COLUNA ESQUERDA: Indicadores Estratégicos */}
        <div className={styles.strategyCol}>
          <div className={styles.colHeader}>
            <h3>Resumo do planejamento</h3>
            <p>Indicadores calculados a partir das publicações cadastradas.</p>
          </div>

          <div className={styles.metricsRow}>
            {/* Volume */}
            <div className={styles.volumeBox}>
              <span className={styles.metricBoxLabel}>Volume</span>
              <p className={styles.volumeNum}>{metrics.total}</p>
            </div>

            {/* Formatos */}
            <div className={styles.barsBox}>
              <span className={styles.barsTitle}>Formatos</span>
              {metrics.formats.map((f) => (
                <div key={f.label} className={styles.barRow}>
                  <div className={styles.barMeta}>
                    <span>{f.label}</span>
                    <span>{f.value}%</span>
                  </div>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{ width: `${f.value}%`, background: f.color }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Funil */}
            <div className={styles.barsBox}>
              <span className={styles.barsTitle}>Etapas do Funil</span>
              {metrics.funnel.map((fn) => (
                <div key={fn.label} className={styles.barRow}>
                  <div className={styles.barMeta}>
                    <span>{fn.label}</span>
                    <span>{fn.value}%</span>
                  </div>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{ width: `${fn.value}%`, background: fn.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dados descritivos da marca */}
          <div className={styles.brandDetailsList}>
            <div className={styles.detailItem}>
              <span>Segmento</span>
              <strong>{calendar.segment || "Geral"}</strong>
            </div>
            <div className={styles.detailItem}>
              <span>Tom de Voz</span>
              <strong>{calendar.tone || "Profissional e acolhedor"}</strong>
            </div>
            <div className={styles.detailItem}>
              <span>Público-Alvo</span>
              <strong>{calendar.audience || "Público qualificado"}</strong>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: Visão Macro • Calendário Mensal */}
        <div className={styles.calendarCol}>
          <div className={styles.colHeader}>
            <span className={styles.headerBadge}>Visão Macro</span>
            <h3>Calendário Mensal</h3>
          </div>

          <div className={styles.calendarCardInner}>
            <div className={styles.calGrid}>
              {DAY_NAMES.map((name) => (
                <div key={name} className={styles.dayHeader}>
                  {name}
                </div>
              ))}

              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`pre-${i}`} className={`${styles.dayCell} ${styles.empty}`} />
              ))}

              {Array.from({ length: daysCount }).map((_, i) => {
                const day = i + 1;
                const dateStr = format(
                  new Date(month.getFullYear(), month.getMonth(), day),
                  "yyyy-MM-dd"
                );
                const dayPosts = postsByDate.get(dateStr) || [];
                const hasPost = dayPosts.length > 0;
                const primaryPost = dayPosts[0];

                return (
                  <button
                    key={dateStr}
                    type="button"
                    className={`${styles.dayCell} ${hasPost ? styles.hasPost : ""}`}
                    onClick={() => {
                      if (primaryPost) scrollToPost(primaryPost.id);
                    }}
                    title={
                      hasPost
                        ? `${dayPosts.length} publicação(ões) no dia ${day}. Clique para visualizar.`
                        : `Dia ${day}`
                    }
                  >
                    <span>{day}</span>
                    {dayPosts.length > 1 && (
                      <span className={styles.calCountBadge}>{dayPosts.length}</span>
                    )}
                    {hasPost && (
                      <span className={styles.calIndicatorIcon}>
                        <Layers size={9} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
