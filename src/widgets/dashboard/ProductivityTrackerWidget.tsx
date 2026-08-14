import { useEffect, useState } from "react";
import { Flame, MousePointer2 } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button/Button";
import styles from "./Dashboard.module.css";

type Stats = { period: { start: string }; performance: { completed: number; pending: number; onTimeRate: number | null; averageStageTimeMinutes: number | null; streakWorkingDays: number; ranking: null } };

export function ProductivityTrackerWidget({ onOpenAdmin }: { onOpenAdmin?: () => void }) {
  const [data, setData] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { const load = () => api.getPerformanceStats().then(setData).finally(() => setLoading(false)); void load(); window.addEventListener("posts-updated", load); return () => window.removeEventListener("posts-updated", load); }, []);
  if (loading) return <div className={styles.widgetEmpty}>Analisando seu desempenho...</div>;
  if (!data) return <div className={styles.widgetError}>Indicadores indisponíveis.</div>;
  const performance = data.performance;
  return <div className={styles.productivity}>
    <div className={styles.productivityHeader}><span>Mês atual</span>{onOpenAdmin ? <Button onClick={onOpenAdmin} size="small" variant="ghost">Gestão de equipe</Button> : null}</div>
    <div className={styles.productivitySummary}><div className={styles.rate}><div><strong>{performance.onTimeRate == null ? "—" : `${performance.onTimeRate}%`}</strong><span>No prazo</span></div></div><div className={styles.metricGrid}><Metric label="Concluídos" value={performance.completed} /><Metric label="Pendentes" value={performance.pending} /><Metric label="Atrasados" value={(data as any).workload?.overdue ?? 0} danger /><Metric label="Tempo médio" value={performance.averageStageTimeMinutes == null ? "—" : formatMinutes(performance.averageStageTimeMinutes)} /></div></div>
    {performance.completed === 0 && performance.onTimeRate == null ? <div className={styles.productivityEmpty}>Nenhuma tarefa concluída neste período.</div> : <div className={styles.streak}><Flame /><strong>{performance.streakWorkingDays} dias úteis com entregas</strong></div>}
    <div className={styles.productivityFootnote}><MousePointer2 />Dados calculados por atribuições e eventos reais</div>
  </div>;
}

function Metric({ label, value, danger = false }: { label: string; value: string | number; danger?: boolean }) { return <div className={styles.metric}><strong data-danger={danger}>{value}</strong><span>{label}</span></div>; }
function formatMinutes(value: number) { if (value < 60) return `${value} min`; const hours = Math.round(value / 60); return hours < 24 ? `${hours} h` : `${Math.round(hours / 24)} d`; }
