import React from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronRight } from 'lucide-react';

interface MyWorkWidgetProps {
  dashboardData: any;
  onOpenPost?: (clientId: string, postId: string) => void;
  onOpenProduction?: (filters?: any) => void;
}

export function MyWorkWidget({ dashboardData, onOpenPost, onOpenProduction }: MyWorkWidgetProps) {
  const items = dashboardData?.modules?.myWork || [];

  if (!items.length) {
    return (
      <div className="flex min-h-32 flex-col items-center justify-center text-center p-4">
        <CheckCircle2 className="mb-2 h-6 w-6 text-emerald-500 opacity-80" />
        <strong className="text-sm font-bold">Tudo em dia!</strong>
        <span className="text-xs opacity-50 mt-0.5">Nenhuma tarefa pendente sob sua responsabilidade agora.</span>
      </div>
    );
  }

  const visibleItems = items.slice(0, 5);

  return (
    <div className="flex flex-col gap-2">
      <div className="space-y-2">
        {visibleItems.map((item: any) => (
          <button
            key={item.id}
            onClick={() => onOpenPost?.(item.clientId, String(item.id))}
            className="group flex w-full items-center gap-3 rounded-xl border border-black/5 bg-black/[.025] p-3 text-left transition hover:border-primary/30 hover:bg-black/[.04] dark:border-white/10 dark:bg-white/[.035] dark:hover:bg-white/[.06]"
          >
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                item.isOverdue
                  ? 'bg-red-500 animate-pulse'
                  : item.workflowStatus === 'changes_requested'
                  ? 'bg-amber-500'
                  : 'bg-primary'
              }`}
            />
            <div className="min-w-0 flex-1">
              <strong className="block truncate text-xs font-bold group-hover:text-primary transition-colors">
                {item.title || item.head || 'Postagem sem título'}
              </strong>
              <span className="block truncate text-[10px] opacity-50">
                {item.clientName} · {item.isAction ? 'Próxima ação' : 'Responsável'} · {String(item.currentStage || '').replaceAll('_', ' ')}
              </span>
            </div>
            {item.isOverdue && (
              <span className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-1.5 py-0.5 text-[9px] font-bold text-red-500">
                <AlertTriangle className="h-3 w-3" /> Atrasada
              </span>
            )}
            <ArrowRight className="h-4 w-4 opacity-30 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
          </button>
        ))}
      </div>
      {items.length > 5 && (
        <button
          onClick={() => onOpenProduction?.()}
          className="mt-1 flex items-center justify-center gap-1 text-[11px] font-bold text-primary hover:underline py-1.5"
        >
          Ver todas ({items.length}) <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

