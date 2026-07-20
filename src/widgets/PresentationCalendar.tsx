import React, { useState } from 'react';
import { getDaysInMonth, startOfMonth, getDay, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowUpRight, X, Calendar as CalendarIcon, ImageIcon, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import { DAY_NAMES, POST_TYPES } from '../lib/constants';
import { PostData } from '../types';

interface PresentationCalendarProps {
  currentDate: Date;
  posts: Record<string, PostData>;
}

export function PresentationCalendar({ currentDate, posts }: PresentationCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const handleDayClick = (dateStr: string) => {
    if (posts[dateStr]) {
      setSelectedDate(dateStr === selectedDate ? null : dateStr);
    }
  };

  const scrollToPost = (dateStr: string) => {
    const element = document.getElementById(`post-${dateStr}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setSelectedDate(null);
    }
  };

  return (
    <div className="print-calendar space-y-12 relative">
      <div className="text-center space-y-4">
         <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--color-primary)]">Visão Macro</p>
         <h2 className="text-4xl md:text-6xl font-display font-black ">Calendário Mensal</h2>
      </div>

      <div className="glass p-8 md:p-12 rounded-[3rem] border border-white/20 shadow-3xl bg-white/20 dark:bg-black/20 backdrop-blur-3xl overflow-visible relative">
         <div className="grid grid-cols-7 gap-2 md:gap-4 max-w-2xl mx-auto relative">
            {DAY_NAMES.map(name => <div key={name} className="text-center font-bold text-[10px]  uppercase opacity-40 pb-4">{name}</div>)}
            
            {Array.from({ length: getDay(startOfMonth(currentDate)) }).map((_, i) => (
              <div key={`pre-${i}`} className="aspect-square rounded-[1.5rem] bg-black/5 dark:bg-white/5 opacity-10" />
            ))}
            
            {Array.from({ length: getDaysInMonth(currentDate) }).map((_, i) => {
               const day = i + 1;
               const dateStr = format(new Date(currentDate.getFullYear(), currentDate.getMonth(), day), 'yyyy-MM-dd');
               const post = posts[dateStr];
               const postTypeConfig = post ? POST_TYPES.find(pt => pt.id === post.type) : null;
               const Icon = postTypeConfig?.icon;
               const isSelected = selectedDate === dateStr;

               return (
                  <div key={day} className="relative">
                    <motion.button 
                      onClick={() => handleDayClick(dateStr)}
                      whileHover={post ? { scale: 1.05, y: -2 } : {}}
                      whileTap={post ? { scale: 0.95 } : {}}
                      className={cn(
                        "w-full aspect-square rounded-[1.5rem] flex flex-col items-center justify-center gap-1 border transition-all shadow-sm relative overflow-hidden",
                        post ? "bg-[var(--color-primary)] border-transparent text-white shadow-xl shadow-[var(--color-primary)]/30 z-10 cursor-pointer" : "bg-black/5 dark:bg-white/5 border-transparent opacity-30 cursor-default",
                        isSelected && "ring-4 ring-white/50 dark:ring-white/20 scale-110 shadow-2xl"
                      )}
                    >
                       <span className="text-lg md:text-xl font-display font-bold relative z-10">{day}</span>
                       {post?.deadline && (
                          <div className="absolute top-1.5 right-1.5 opacity-80 z-20">
                             <Clock className="w-3.5 h-3.5 text-white/80" />
                          </div>
                       )}
                       {post && Icon && (
                          <div className="absolute bottom-2 right-2 opacity-40">
                             <Icon className="w-4 h-4" />
                          </div>
                       )}
                    </motion.button>

                    {/* Popover Card surgindo de cima do botão */}
                    <AnimatePresence>
                      {isSelected && post && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.9, x: '-50%' }}
                          animate={{ opacity: 1, y: -10, scale: 1, x: '-50%' }}
                          exit={{ opacity: 0, y: 10, scale: 0.9, x: '-50%' }}
                          className="absolute bottom-full left-1/2 z-[100] w-64 glass p-4 rounded-3xl border border-white/40 dark:border-white/10 shadow-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-3xl flex flex-col gap-3 mb-2 origin-bottom pointer-events-auto"
                        >
                          {/* Post Image Preview */}
                          <div className="w-full aspect-video rounded-2xl bg-black/10 dark:bg-white/10 overflow-hidden relative group">
                            {post.feedImages && post.feedImages.length > 0 ? (
                              <img src={post.feedImages[0]} alt="Preview" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center opacity-20">
                                <ImageIcon className="w-8 h-8" />
                              </div>
                            )}
                            <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 backdrop-blur-md rounded-lg text-[8px] font-bold text-white uppercase tracking-widest">
                               {postTypeConfig?.label || 'Post'}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <h4 className="text-xs font-display font-black line-clamp-1 uppercase tracking-tight">{post.head || 'Sem título'}</h4>
                            <p className="text-[10px] opacity-60 line-clamp-2 leading-relaxed">{post.subhead || post.theme || 'Conteúdo estratégico planejado para esta data.'}</p>
                            {post.deadline && (
                              <div className="flex items-center gap-1 text-[9px] font-black uppercase text-[var(--color-primary)] mt-1.5 bg-[var(--color-primary)]/10 px-2 py-0.5 rounded-md w-fit">
                                <Clock className="w-2.5 h-2.5" />
                                <span>
                                  Prazo: {(() => {
                                    try {
                                      const d = post.deadline;
                                      if (typeof d === 'number') {
                                        return format(new Date(d), 'dd/MM/yyyy');
                                      }
                                      if (typeof d === 'string') {
                                        if (d.includes('T')) {
                                          return format(new Date(d), 'dd/MM/yyyy');
                                        }
                                        return format(new Date(d + 'T00:00:00'), 'dd/MM/yyyy');
                                      }
                                      return format(new Date(d), 'dd/MM/yyyy');
                                    } catch (e) {
                                      return 'Inválido';
                                    }
                                  })()}
                                </span>
                              </div>
                            )}
                          </div>

                          <button 
                            onClick={(e) => {
                               e.stopPropagation();
                               scrollToPost(dateStr);
                            }}
                            className="w-full py-3 rounded-xl bg-[var(--color-primary)] text-white text-[10px] font-bold flex items-center justify-center gap-2 hover:bg-[var(--color-primary)]/90 transition-all shadow-lg shadow-[var(--color-primary)]/20"
                          >
                            VER POST COMPLETO <ArrowUpRight className="w-3 h-3" />
                          </button>

                          {/* Arrow pointing down to the button */}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-white/95 dark:border-t-zinc-900/95" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
               );
            })}
         </div>

         {/* Overlay to close when clicking outside */}
         {selectedDate && (
           <div 
             className="fixed inset-0 z-40" 
             onClick={() => setSelectedDate(null)} 
           />
         )}
      </div>
    </div>
  );
}
