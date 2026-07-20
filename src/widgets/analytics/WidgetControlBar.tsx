import React from 'react';
import { cn } from '../../lib/utils';
import { Platform, WidgetState } from './types';

interface WidgetControlBarProps {
   id: string;
   state: WidgetState;
   platforms: Platform[];
   onTogglePlatform: (widgetId: string, platformId: string) => void;
   onUpdateWidget: (widgetId: string, updates: Partial<WidgetState>) => void;
}

export const WidgetControlBar = ({ id, state, platforms, onTogglePlatform, onUpdateWidget }: WidgetControlBarProps) => (
   <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-black/20 dark:bg-white/5 rounded-3xl border border-white/10 mb-6 backdrop-blur-md">
      <div className="flex items-center gap-4">
         {/* PLATFORMS */}
         <div className="flex gap-1 p-1 bg-black/20 rounded-2xl border border-white/5">
            {platforms.map(p => (
               <button 
                  key={p.id} 
                  onClick={(e) => { e.stopPropagation(); onTogglePlatform(id, p.id); }} 
                  className={cn(
                     "p-2.5 rounded-xl transition-all hover:scale-110 active:scale-95",
                     state.platforms.includes(p.id) ? "bg-white/10 shadow-lg" : "opacity-20 hover:opacity-50"
                  )}
                  title={p.label}
               >
                  <p.icon className="w-4 h-4" style={{ color: state.platforms.includes(p.id) ? p.color : 'white' }} />
               </button>
            ))}
         </div>

         <div className="w-px h-6 bg-white/10" />

         {/* TIME RANGE */}
         <div className="flex gap-1 p-1 bg-black/20 rounded-2xl border border-white/5">
            {['7d', '30d', '90d', '1y'].map(range => (
               <button
                  key={range}
                  onClick={(e) => { e.stopPropagation(); onUpdateWidget(id, { dateRange: range }); }}
                  className={cn(
                     "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all",
                     state.dateRange === range ? "bg-primary text-white shadow-lg shadow-primary/20" : "opacity-30 hover:opacity-100"
                  )}
               >
                  {range}
               </button>
            ))}
         </div>
      </div>

      <div className="flex items-center gap-3">
         {/* COMPARISON TOGGLE */}
         <button
            onClick={(e) => { e.stopPropagation(); onUpdateWidget(id, { isComparing: !state.isComparing }); }}
            className={cn(
               "flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-black uppercase border transition-all",
               state.isComparing 
                  ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-500 shadow-lg shadow-emerald-500/10" 
                  : "bg-white/5 border-white/10 opacity-30 hover:opacity-100"
            )}
         >
            <div className={cn("w-1.5 h-1.5 rounded-full", state.isComparing ? "bg-emerald-500 animate-pulse" : "bg-white")} />
            Comparar
         </button>
      </div>
   </div>
);
