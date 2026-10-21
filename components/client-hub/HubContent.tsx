"use client";
import { onboardingFields, estimatedImpacts, type HubDocument, type Report } from "@/lib/client-hub-types";
import { shortDate } from "./HubFields";
import styles from "./Hub.module.css";

/** Relatório mantém analytics dentro do follow-up e distingue números observados de estimativas. */
export function ReportView({ report }: { report: Report }) {
  return <article className={styles.card}>
    <span className={styles.eyebrow}>Follow-up · {shortDate(report.start)} a {shortDate(report.end)}</span>
    <h2>{report.title}</h2><p className={styles.text}>{report.summary}</p>
    {report.social.length > 0 && <><h3>Analytics de redes sociais</h3><div className={styles.grid}>
      {report.social.map(metric => <div className={styles.metric} key={metric.id}>
        <span className={styles.muted}>{metric.channel} · {metric.metric}</span>
        <strong className={styles.number}>{metric.value.toLocaleString("pt-BR")}</strong>
        <p className={styles.muted}>Fonte: {metric.source}</p>
      </div>)}
    </div></>}
    {report.outdoor.length > 0 && <div className={styles.stack} style={{ marginTop: 24 }}><h3>Mídia exterior · estimativas</h3>
      {report.outdoor.map(metric => <div className={styles.subcard} key={metric.id}>
        <span className={styles.badge}>{metric.medium} · {metric.location}</span>
        <h2 style={{ marginTop: 12 }}>{estimatedImpacts(metric).toLocaleString("pt-BR")} oportunidades de exposição</h2>
        <p className={styles.muted}>{metric.dailyFlow.toLocaleString("pt-BR")} passagens/dia por unidade × {metric.days} dias × {metric.units} unidades × fator {metric.factor.toLocaleString("pt-BR")}.</p>
        <p className={styles.text}>Fonte: {metric.source}{"\n"}Premissas: {metric.assumptions}</p>
        <p className={styles.muted}>Estimativa bruta com possíveis repetições. Não representa pessoas únicas nem visualizações comprovadas.</p>
      </div>)}
    </div>}
    <div className={styles.grid} style={{ marginTop: 24 }}>
      <div><h3>Aprendizados</h3><p className={styles.text}>{report.learnings || "Ainda não registrados."}</p></div>
      <div><h3>Próximos passos, responsáveis e prazos</h3><p className={styles.text}>{report.nextSteps || "Ainda não definidos."}</p></div>
    </div>
  </article>;
}
/** Renderização comum à prévia interna e ao portal publicado. */
export function HubContent({ document, section }: { document: HubDocument; section: string }) {
  if (section === "onboarding") return <article className={styles.card}>
    <div className={styles.eyebrow}>Documento de kickoff</div><h2>Vamos começar pelo que importa.</h2>
    <p className={styles.muted}>Informações do briefing, organizadas para alinhar o início do trabalho.</p>
    <div className={styles.grid}>{Object.entries(onboardingFields).filter(([key]) => document.onboarding[key as keyof typeof onboardingFields]).map(([key, label]) =>
      <section key={key} className={styles.subcard}><h3>{label}</h3><div className={styles.text}>{document.onboarding[key as keyof typeof onboardingFields]}</div></section>
    )}</div>
    {!Object.values(document.onboarding).some(Boolean) && <div className={styles.empty}>O onboarding será exibido aqui quando estiver disponível.</div>}
  </article>;
  if (section === "deliveries") return <div className={styles.stack}>
    <section className={styles.card}><div className={styles.eyebrow}>Do planejamento à entrega</div><h2>Materiais entregues</h2>
      {document.deliveries.length ? document.deliveries.map(item => <article className={styles.row} key={item.id}>
        <div><span className={styles.muted}>{shortDate(item.date)}</span><h3>{item.title}</h3><p className={styles.text}>{item.description}</p></div>
        {item.url && <a className={styles.button} href={item.url} target="_blank" rel="noreferrer">Abrir material ↗</a>}
      </article>) : <div className={styles.empty}>As próximas entregas aparecerão aqui.</div>}
    </section>
    {document.reports.map(report => <ReportView key={report.id} report={report} />)}
    {!document.reports.length && <div className={styles.empty}>Nenhum relatório de follow-up disponível.</div>}
  </div>;
  const brand = document.brand;
  const colors = brand.colors.match(/#[0-9a-fA-F]{6}\b/g) || [];
  return <div className={styles.stack}>
    <article className={styles.card}><div className={styles.eyebrow}>Manual digital da marca</div><h2>Uma identidade. Em todos os pontos de contato.</h2>
      <p className={styles.text}>{brand.description || "O manual da marca está em preparação."}</p>
      <h3>Paleta de cores</h3><div className={styles.swatches}>{colors.map((color, index) => <div className={styles.swatch} key={`${color}-${index}`}><span style={{ background: color }} /><code>{color}</code></div>)}</div>
      <p className={styles.text}>{brand.colors}</p>
      <div className={styles.grid}><section><h3>Tipografia</h3><p className={styles.text}>{brand.typography || "A definir."}</p></section><section><h3>Tom de voz</h3><p className={styles.text}>{brand.voice || "A definir."}</p></section></div>
      <h3>Diretrizes de uso</h3><p className={styles.text}>{brand.rules || "A definir."}</p>
    </article>
    <div className={styles.grid}>{brand.assets.map(asset => <article className={styles.card} key={asset.id}>
      <span className={styles.badge}>{asset.kind}</span><h3 style={{ marginTop: 14 }}>{asset.title}</h3>
      <p className={styles.text}>{asset.description}</p><a href={asset.url} target="_blank" rel="noreferrer" className={styles.button}>Abrir / baixar arquivo ↗</a>
    </article>)}</div>
  </div>;
}
