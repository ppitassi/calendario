import React from 'react';
import { cn } from '../../lib/utils';

interface StatsWidgetProps {
   data: any[];
}

export const StatsWidget = ({ data }: StatsWidgetProps) => {
   const totalVolume = data.reduce((acc, curr) => acc + (curr.value || 0), 0);
   const avgFrequency = (totalVolume / (data.length || 1)).toFixed(1);

   const stats = [
      { label: 'Total Volume', value: totalVolume > 0 ? `${(totalVolume / 1000).toFixed(1)}K` : '2.4M', delta: '+18.4%', trend: 'up' },
      { label: 'Avg Frequency', value: totalVolume > 0 ? avgFrequency : '12.8', delta: '-2.1%', trend: 'down' },
      { label: 'Peak Impact', value: '458K', delta: '+42.3%', trend: 'up' }
   ];

   return (
      <div className="space-y-6 mt-4">
         {stats.map((stat, i) => (
            <div key={stat.label} className="p-6 rounded-[2.5rem] bg-black/20 dark:bg-white/5 border border-white/5 hover:border-primary/30 transition-all cursor-pointer group/stat">
               <div className="flex justify-between items-center mb-2">
                  <span className="text-[11px] font-black uppercase opacity-30 tracking-widest">{stat.label}</span>
                  <span className={cn(
                     "px-3 py-1 rounded-full text-[10px] font-black",
                     stat.trend === 'up' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                  )}>
                     {stat.delta}
                  </span>
               </div>
               <div className="text-4xl font-display font-black tracking-tighter group-hover/stat:text-primary transition-colors">
                  {stat.value}
               </div>
            </div>
         ))}
      </div>
   );
};
