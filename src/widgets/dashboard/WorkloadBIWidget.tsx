import { useEffect, useState, type ComponentType } from 'react';
import { AlertTriangle, BarChart2, Clock, Layers3 } from 'lucide-react';
import { api } from '../../lib/api';
import styles from './WorkloadBIWidget.module.css';

type Stats = { period: { start: string; end: string }; workload: { activePrimary: number; activeActions: number; overdue: number; distribution: { stage: string; count: number }[] }; performance: { completed: number; onTimeRate: number | null; averageStageTimeMinutes: number | null } };
const month = (value: string) => new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(value));

export function WorkloadBIWidget() {
  const [data, setData] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => { api.getPerformanceStats().then(setData).catch(() => setError(true)).finally(() => setLoading(false)); }, []);

  if (loading) return <div className={styles.state}>Carregando dados do período...</div>;
  if (error || !data) return <div className={`${styles.state} ${styles.error}`}>Não foi possível carregar os indicadores.</div>;
  const total = data.workload.activePrimary + data.workload.activeActions;
  if (!total && !data.performance.completed) return <div className={styles.empty}><BarChart2 /><strong>Nenhuma tarefa neste período</strong><span>{month(data.period.start)}</span></div>;

  return <div className={styles.root}>
    <div className={styles.header}><span>{month(data.period.start)}</span><strong>{total} em andamento</strong></div>
    <div className={styles.metrics}>
      <Metric icon={Layers3} label="Responsável principal" value={data.workload.activePrimary} />
      <Metric icon={Layers3} label="Próximas ações" value={data.workload.activeActions} />
      <Metric icon={AlertTriangle} label="Atrasadas" value={data.workload.overdue} danger />
      <Metric icon={Clock} label="Tempo médio" value={data.performance.averageStageTimeMinutes == null ? '—' : formatMinutes(data.performance.averageStageTimeMinutes)} />
    </div>
    <div className={styles.distribution}><p>Distribuição por etapa</p>{data.workload.distribution.map(item => <div key={item.stage} className={styles.distributionRow}><span>{item.stage.replaceAll('_', ' ')}</span><strong>{item.count}</strong></div>)}</div>
  </div>;
}

function Metric({ icon: Icon, label, value, danger = false }: { icon: ComponentType<{ className?: string }>; label: string; value: string | number; danger?: boolean }) {
  return <div className={styles.metric}><Icon className={danger ? styles.dangerIcon : styles.metricIcon} /><strong>{value}</strong><span>{label}</span></div>;
}

function formatMinutes(value: number) { if (value < 60) return `${value} min`; const hours = Math.round(value / 60); return hours < 24 ? `${hours} h` : `${Math.round(hours / 24)} d`; }
