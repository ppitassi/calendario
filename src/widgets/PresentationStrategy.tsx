import { motion } from "motion/react";
import { presentationMetrics, type PresentationViewModel } from "../../lib/presentation-model";
import styles from "./PresentationStrategy.module.css";

export function PresentationStrategy({ model }: { model: PresentationViewModel }) {
  const metrics = presentationMetrics(model);
  const formats = [
    { label: "Feed", value: metrics.formatPercent.feed, tone: styles.feed },
    { label: "Stories", value: metrics.formatPercent.story, tone: styles.story },
    { label: "Reels", value: metrics.formatPercent.reel, tone: styles.reel },
    { label: "Carrosséis", value: metrics.formatPercent.carousel, tone: styles.carousel },
  ];
  const funnel = [
    { label: "Topo", value: metrics.funnelPercent.topo, tone: styles.top },
    { label: "Meio", value: metrics.funnelPercent.meio, tone: styles.middle },
    { label: "Fundo", value: metrics.funnelPercent.fundo, tone: styles.bottom },
  ];
  const persisted = Object.entries({
    Segmento: model.estrategia.segmento,
    "Tom de voz": model.estrategia.tomDeVoz,
    "Público-alvo": model.estrategia.publicoAlvo,
    Observações: model.estrategia.observacoes,
  }).filter((entry): entry is [string, string] => Boolean(entry[1]));

  return (
    <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className={`print-strategy ${styles.root}`}>
      <h2 className={styles.title}>Resumo do planejamento</h2>
      <p className={styles.description}>Indicadores calculados exclusivamente a partir das publicações cadastradas.</p>
      <div className={styles.metricsGrid}>
        <div className={styles.card}>
          <span className={styles.label}>Volume mensal</span>
          <p className={styles.total}>{metrics.total}</p>
        </div>
        <MetricCard title="Formatos" items={formats} />
        <MetricCard title="Etapas do funil informadas" items={funnel} />
      </div>
      {persisted.length || model.estrategia.colunasDeConteudo.length ? (
        <dl className={styles.detailsGrid}>
          {persisted.map(([label, value]) => (
            <div key={label}><dt className={styles.label}>{label}</dt><dd className={styles.detailValue}>{value}</dd></div>
          ))}
          {model.estrategia.colunasDeConteudo.length ? (
            <div><dt className={styles.label}>Colunas de conteúdo</dt><dd className={styles.detailValue}>{model.estrategia.colunasDeConteudo.join(" · ")}</dd></div>
          ) : null}
        </dl>
      ) : null}
    </motion.section>
  );
}

function MetricCard({ title, items }: { title: string; items: Array<{ label: string; value: number; tone: string }> }) {
  return (
    <div className={styles.card}>
      <h3 className={styles.label}>{title}</h3>
      {items.map((item) => (
        <div key={item.label} className={styles.metric}>
          <div className={styles.metricHeader}><span>{item.label}</span><span>{item.value}%</span></div>
          <div className={styles.track}><div className={`${styles.fill} ${item.tone}`} style={{ width: `${item.value}%` }} /></div>
        </div>
      ))}
    </div>
  );
}
