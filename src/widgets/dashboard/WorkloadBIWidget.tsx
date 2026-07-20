import React, { useState, useEffect } from 'react';
import { 
  Target, 
  CheckCircle, 
  AlertCircle, 
  TrendingUp, 
  Zap,
  BarChart2
} from 'lucide-react';
import { api } from '../../lib/api';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

interface WorkloadStat {
  clientId: string;
  clientName: string;
  expected: number;
  created: number;
  finished: number;
}

export function WorkloadBIWidget() {
  const [stats, setStats] = useState<WorkloadStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.getWorkloadStats();
        setStats(res);
      } catch (e) {
        console.error("Error fetching workload stats", e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <div className="h-full flex items-center justify-center opacity-20 animate-pulse">Cruzando dados de entrega...</div>;

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Sleek Legend Bar */}
      <div className="flex justify-end gap-4 select-none">
         <div className="flex items-center gap-2 text-[9px] font-bold opacity-40">
            <div className="w-2 h-2 rounded-full bg-primary" /> ESPERADO
         </div>
         <div className="flex items-center gap-2 text-[9px] font-bold opacity-40">
            <div className="w-2 h-2 rounded-full bg-emerald-500" /> FINALIZADO
         </div>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar flex flex-col gap-4">
        {stats.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center rounded-[22px] border border-dashed border-black/10 bg-zinc-50/70 text-center dark:border-white/10 dark:bg-white/[0.03]">
            <BarChart2 className="mb-3 h-7 w-7 text-primary opacity-55" />
            <p className="text-sm font-bold">Sem produção neste ciclo</p>
            <p className="mt-1 text-[11px] opacity-40">Os indicadores aparecem conforme os posts avançam.</p>
          </div>
        )}
        {stats.map((stat, idx) => {
          const efficiency = stat.expected > 0 ? Math.min(100, Math.round((stat.finished / stat.expected) * 100)) : 0;
          
          return (
            <motion.div 
              key={stat.clientId}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-white/5 flex flex-col gap-3 group hover:bg-white/10 transition-all"
            >
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold truncate max-w-[150px]">{stat.clientName}</span>
                <span className={cn(
                  "text-[10px] font-black px-2 py-0.5 rounded-lg",
                  efficiency >= 80 ? "bg-emerald-500/10 text-emerald-500" : 
                  efficiency >= 50 ? "bg-amber-500/10 text-amber-500" : "bg-rose-500/10 text-rose-500"
                )}>
                  {efficiency}% Eficiência
                </span>
              </div>

              <div className="relative h-2 w-full bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                {/* Expected Bar (Shadow) */}
                <div 
                  className="absolute inset-0 bg-primary/20" 
                  style={{ width: `${Math.min(100, (stat.expected / 20) * 100)}%` }} 
                />
                {/* Created Bar */}
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (stat.created / 20) * 100)}%` }}
                  className="absolute inset-y-0 left-0 bg-primary opacity-40"
                />
                {/* Finished Bar */}
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (stat.finished / 20) * 100)}%` }}
                  className="absolute inset-y-0 left-0 bg-emerald-500"
                />
              </div>

              <div className="flex items-center justify-between text-[8px] font-black uppercase opacity-30">
                 <div className="flex gap-4">
                    <span>Meta: {stat.expected}</span>
                    <span>Criados: {stat.created}</span>
                    <span className="text-emerald-500 opacity-100">Prontos: {stat.finished}</span>
                 </div>
                 {stat.finished >= stat.expected && <CheckCircle className="w-3 h-3 text-emerald-500" />}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
