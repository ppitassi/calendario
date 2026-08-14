import styles from "./Dashboard.module.css";

export function ProductionBIWidget({ dashboardData, onOpenDetails }: { dashboardData?: any; onOpenDetails?: (filters?: any) => void }) {
  const rows = dashboardData?.modules?.pipeline || [];
  const countByStage = new Map(rows.map((row: any) => [String(row.stage), Number(row.count)]));
  const stages = [["copy", "Copy"], ["design", "Design"], ["revisao_interna", "Revisão"], ["approval", "Aprovação"], ["agendado", "Agendamento"], ["publicado", "Publicação"]];
  const total = stages.reduce((sum, [id]) => sum + Number(countByStage.get(id) || 0), 0);
  if (!rows.length) return <div className={styles.widgetEmpty}>Nenhuma postagem na esteira.</div>;
  return <div className={styles.pipelineList}>{stages.map(([id, label]) => { const value = Number(countByStage.get(id) || 0); const percentage = total ? Math.round(value / total * 100) : 0; return (
    /* style-architecture-button-exception: pipeline rows are feature-specific dashboard drilldowns. */
    <button key={id} onClick={() => onOpenDetails?.({ status: id })} className={styles.pipelineRow}><span>{label}</span><span className={styles.pipelineTrack}><span className={styles.pipelineFill} style={{ width: `${percentage}%` }} /></span><strong>{value}</strong></button>
  ); })}</div>;
}
