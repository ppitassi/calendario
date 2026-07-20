import React, { FC } from 'react';
import { motion, useDragControls } from 'motion/react';
import { LucideIcon, Move, Minus, Maximize2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { WidgetState, Platform } from './types';
import { WidgetControlBar } from './WidgetControlBar';

interface DraggableWidgetProps {
   key?: React.Key;
   id: string;
   title: string;
   icon: LucideIcon;
   colorClass: string;
   className?: string;
   children: React.ReactNode;
   state: WidgetState;
   platforms: Platform[];
   containerRef: React.RefObject<HTMLDivElement | null>;
   onTogglePlatform: (widgetId: string, platformId: string) => void;
   onUpdateWidget: (widgetId: string, updates: Partial<WidgetState>) => void;
   onHide: (id: string) => void;
   onExpand?: (id: string) => void;
}

export function DraggableWidget({ 
   id, 
   title, 
   icon: Icon, 
   colorClass, 
   className, 
   children, 
   state, 
   platforms, 
   containerRef,
   onTogglePlatform,
   onUpdateWidget,
   onHide,
   onExpand
}: DraggableWidgetProps) {
   const dragControls = useDragControls();

   return (
      <motion.div
         layout
         initial={{ scale: 0.8, opacity: 0 }}
         animate={{ scale: 1, opacity: 1 }}
         exit={{ scale: 0.8, opacity: 0 }}
         drag
         dragControls={dragControls}
         dragListener={false}
         dragConstraints={containerRef}
         dragElastic={0}
         dragMomentum={false}
         dragTransition={{
            power: 0,
            timeConstant: 200,
            modifyTarget: (target) => Math.round(target / 20) * 20
         }}
         className={cn("glass rounded-[3rem] p-8 border border-white/10 flex flex-col shadow-2xl relative backdrop-blur-xl", className)}
      >
         <div className="flex items-center justify-between mb-6 cursor-grab active:cursor-grabbing" onPointerDown={(e) => dragControls.start(e)}>
            <div className="flex items-center gap-4">
               <div className={cn("p-4 rounded-3xl", colorClass)}><Icon className="w-6 h-6" /></div>
               <h3 className="text-xl font-black uppercase italic">{title}</h3>
            </div>
            <div className="flex items-center gap-2">
               {onExpand && (
                  <button 
                     onClick={(e) => { e.stopPropagation(); onExpand(id); }}
                     className="p-2.5 bg-white/5 rounded-xl opacity-20 hover:opacity-100 hover:bg-primary/20 hover:text-primary transition-all"
                     title="Expandir para tela cheia"
                  >
                     <Maximize2 className="w-4 h-4" />
                  </button>
               )}
               <button 
                  onClick={(e) => { e.stopPropagation(); onHide(id); }}
                  className="p-2.5 bg-white/5 rounded-xl opacity-20 hover:opacity-100 hover:bg-rose-500/20 hover:text-rose-500 transition-all"
               >
                  <Minus className="w-4 h-4" />
               </button>
               <Move className="w-4 h-4 opacity-20" />
            </div>
         </div>
         <WidgetControlBar 
            id={id} 
            state={state} 
            platforms={platforms} 
            onTogglePlatform={onTogglePlatform} 
            onUpdateWidget={onUpdateWidget} 
         />
         <div className="flex-1 w-full min-h-0">{children}</div>
      </motion.div>
   );
};
