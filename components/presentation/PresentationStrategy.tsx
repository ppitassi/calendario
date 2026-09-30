/** Resume volume, formatos, funil e dados estratégicos do calendário apresentado. */

import { useMemo } from "react";
import { motion } from "motion/react";
import type { CalendarRecord, ContentItem } from "@/lib/types";
import styles from "./PresentationStrategy.module.css";

/** Calcula indicadores somente a partir dos posts e combina-os com os dados persistidos. */
export function PresentationStrategy({
  calendar,
  items,
}: {
  calendar: CalendarRecord;
  items: ContentItem[];
}) {
  /** Distribui os posts por formato e funil; valores desconhecidos caem em Feed e Story e Topo. */
  const metrics = useMemo(() => {
    const total = items.length;
    if (total === 0) {
      return {
        total: 0,
        formats: [
          { label: "Feed e Story", value: 0, tone: styles.feedStory },
          { label: "Feed", value: 0, tone: styles.feed },
          { label: "Stories", value: 0, tone: styles.story },
        ],
        funnel: [
          { label: "Topo", value: 0, tone: styles.top },
          { label: "Meio", value: 0, tone: styles.middle },
          { label: "Fundo", value: 0, tone: styles.bottom },
        ],
      };
    }

    const counts = { "Feed e Story": 0, Feed: 0, Story: 0 };
    const funnelCounts = { Topo: 0, Meio: 0, Fundo: 0 };

    for (const item of items) {
      const rawType = (item.type || "").toLowerCase();
      if (rawType === "feed") {
        counts.Feed++;
      } else if (rawType === "story" || rawType === "stories") {
        counts.Story++;
      } else {
        // "feed e story", "post", "carrossel", "reel" e qualquer outro → Feed e Story
        counts["Feed e Story"]++;
      }

      const stage = item.funnelStage || "Topo";
      if (funnelCounts[stage] !== undefined) funnelCounts[stage]++;
      else funnelCounts.Topo++;
    }

    /** Converte uma contagem em percentual inteiro do total de publicações. */
    const pct = (n: number) => Math.round((n / total) * 100);

    return {
      total,
      formats: [
        { label: "Feed e Story", value: pct(counts["Feed e Story"]), tone: styles.feedStory },
        { label: "Feed", value: pct(counts.Feed), tone: styles.feed },
        { label: "Stories", value: pct(counts.Story), tone: styles.story },
      ],
      funnel: [
        { label: "Topo", value: pct(funnelCounts.Topo), tone: styles.top },
        { label: "Meio", value: pct(funnelCounts.Meio), tone: styles.middle },
        { label: "Fundo", value: pct(funnelCounts.Fundo), tone: styles.bottom },
      ],
    };
  }, [items]);

  // Exibe dados cadastrados; campos essenciais recebem um texto padrão quando vazios.
  const persisted = Object.entries({
    Segmento: calendar.segment || "Geral",
    "Tom de voz": calendar.tone || "Profissional, acolhedor e estratégico",
    "Público-alvo": calendar.audience || "Público qualificado da marca",
    Observações: calendar.strategy || calendar.objective || "",
  }).filter((entry): entry is [string, string] => Boolean(entry[1]));

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`print-strategy ${styles.root}`}
    >
      <h2 className={styles.title}>Resumo do planejamento</h2>
      <p className={styles.description}>
        Indicadores calculados exclusivamente a partir das publicações cadastradas.
      </p>

      {/* UI: volume absoluto e distribuições percentuais do mês. */}
      <div className={styles.metricsGrid}>
        {/* UI: quantidade total de publicações cadastradas. */}
        <div className={styles.card}>
          <span className={styles.label}>Volume mensal</span>
          <p className={styles.total}>{metrics.total}</p>
        </div>

        <MetricCard title="Formatos" items={metrics.formats} />
        <MetricCard title="Etapas do funil informadas" items={metrics.funnel} />
      </div>

      {persisted.length > 0 && (
        <dl className={styles.detailsGrid}>
          {persisted.map(([label, value]) => (
            <div key={label}>
              <dt className={styles.label}>{label}</dt>
              <dd className={styles.detailValue}>{value}</dd>
            </div>
          ))}
          {calendar.pillars && (
            <div>
              <dt className={styles.label}>Colunas de conteúdo</dt>
              <dd className={styles.detailValue}>{calendar.pillars}</dd>
            </div>
          )}
        </dl>
      )}
    </motion.section>
  );
}

/** Renderiza uma série de percentuais com rótulo, valor e barra colorida. */
function MetricCard({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: number; tone: string }>;
}) {
  return (
    <div className={styles.card}>
      <h3 className={styles.label}>{title}</h3>
      {items.map((item) => (
        <div key={item.label} className={styles.metric}>
          {/* UI: alinha o nome da métrica ao percentual que dimensiona a barra abaixo. */}
          <div className={styles.metricHeader}>
            <span>{item.label}</span>
            <span>{item.value}%</span>
          </div>
          <div className={styles.track}>
            <div
              className={`${styles.fill} ${item.tone}`}
              style={{ width: `${item.value}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
