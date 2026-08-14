import { AlertTriangle, ArrowRight, CheckCircle2, ChevronRight } from 'lucide-react';
import { Button } from '../../components/ui/Button/Button';
import styles from './Dashboard.module.css';

interface MyWorkWidgetProps {
  dashboardData: any;
  onOpenPost?: (clientId: string, postId: string) => void;
  onOpenProduction?: (filters?: any) => void;
}

export function MyWorkWidget({ dashboardData, onOpenPost, onOpenProduction }: MyWorkWidgetProps) {
  const items = dashboardData?.modules?.myWork || [];

  if (!items.length) {
    return (
      <div className={styles.workEmpty}>
        <CheckCircle2 />
        <strong>Tudo em dia!</strong>
        <span>Nenhuma tarefa pendente sob sua responsabilidade agora.</span>
      </div>
    );
  }

  const visibleItems = items.slice(0, 5);

  return (
    <div className="flex flex-col gap-2">
      <div className="space-y-2">
        {visibleItems.map((item: any) => (
          /* style-architecture-button-exception: work rows are feature-specific navigable records. */
          <button
            key={item.id}
            onClick={() => onOpenPost?.(item.clientId, String(item.id))}
            className={styles.workItem}
          >
            <span className={styles.workStatus} data-status={item.isOverdue ? "overdue" : item.workflowStatus === "changes_requested" ? "changes" : "active"} />
            <div className="min-w-0 flex-1">
              <strong className={styles.workTitle}>
                {item.title || item.head || 'Postagem sem título'}
              </strong>
              <span className={styles.workMeta}>
                {item.clientName} · {item.isAction ? 'Próxima ação' : 'Responsável'} · {String(item.currentStage || '').replaceAll('_', ' ')}
              </span>
            </div>
            {item.isOverdue && (
              <span className={styles.overdueBadge}>
                <AlertTriangle /> Atrasada
              </span>
            )}
            <ArrowRight className={styles.workArrow} />
          </button>
        ))}
      </div>
      {items.length > 5 && (
        <Button
          onClick={() => onOpenProduction?.()}
          className="mt-1"
          size="small"
          variant="ghost"
          icon={<ChevronRight />}
        >
          Ver todas ({items.length})
        </Button>
      )}
    </div>
  );
}

