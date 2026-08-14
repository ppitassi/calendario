import { ClientData } from "../../types";
import styles from "./PlannerStrategyView.module.css";

type PlannerStrategyViewProps = { currentClient: ClientData | null };

export function PlannerStrategyView({ currentClient }: PlannerStrategyViewProps) {
  const fields = [
    ["Segmento", currentClient?.segment, false],
    ["Frequência de postagem", currentClient?.postFrequency, false],
    ["Tom de voz", currentClient?.voiceTone, true],
    ["Público-alvo", currentClient?.targetAudience, true],
    ["Pilares de conteúdo", currentClient?.contentColumns, false],
    ["Redes e canais", currentClient?.networks, false],
    ["Diretrizes da marca", currentClient?.brandNotes, true],
    ["Diretrizes visuais", currentClient?.visualInfo, true],
  ] as const;
  return (
    <div className={styles.view}>
      <header className={styles.header}>
        <div className={styles.avatar}>{currentClient?.name?.substring(0, 2).toUpperCase()}</div>
        <div><h1>{currentClient?.name}</h1><p>Painel Editorial &amp; Estratégico</p></div>
      </header>
      <div className={styles.grid}>
        {fields.map(([label, value, wide]) => <section key={label} className={wide ? `${styles.card} ${styles.wide}` : styles.card}><span>{label}</span><p>{value || <em>Não informado</em>}</p></section>)}
      </div>
    </div>
  );
}
