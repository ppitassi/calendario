import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { ClientData } from '../types';
import { Info, X } from 'lucide-react';

interface PresentationStrategyProps {
  client: ClientData;
  sortedPostKeys: string[];
  staticPct: number;
  reelPct: number;
  carouselPct: number;
}

export function PresentationStrategy({ 
  client, 
  sortedPostKeys, 
  staticPct, 
  reelPct, 
  carouselPct 
}: PresentationStrategyProps) {
  const [expandedLevel, setExpandedLevel] = useState<number | null>(null);

  const funnelLevels = [
    { 
       title: "Topo de Funil", 
       subtitle: "Atração e Consciência", 
       desc: "Conteúdo focado em alcance e descoberta. Mostramos o problema ou despertamos um interesse latente no público frio.",
       items: ["Reels Virais", "Dicas Rápidas", "Notícias do Setor"],
       color: "bg-blue-500",
       hex: "var(--color-primary)",
       opacity: 0.3
    },
    { 
       title: "Meio de Funil", 
       subtitle: "Consideração e Desejo", 
       desc: "Conteúdo focado em educar e conectar. O público já te conhece e está avaliando sua expertise e autoridade.",
       items: ["Carrosséis Educativos", "Bastidores", "Estudos de Caso"],
       color: "bg-purple-500",
       hex: "var(--color-primary)",
       opacity: 0.6
    },
    { 
       title: "Fundo de Funil", 
       subtitle: "Decisão e Ação", 
       desc: "Conteúdo focado em conversão direta. Ofertas claras, quebra de objeções e chamadas para ação específicas.",
       items: ["Depoimentos", "Oferta Direta", "Dúvidas Frequentes"],
       color: "bg-[var(--color-primary)]",
       hex: "var(--color-primary)",
       opacity: 1
    }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 40 }} 
      whileInView={{ opacity: 1, y: 0 }} 
      viewport={{ once: true, margin: "-100px" }}
      className="print-strategy w-full space-y-32"
    >
       {/* STRATEGY HEADER CARD */}
       <div className="glass p-10 md:p-16 rounded-[3rem] relative flex flex-col border border-white/20 dark:border-white/10 shadow-3xl bg-white/40 dark:bg-black/40 backdrop-blur-2xl overflow-hidden">
          <div className="relative z-10 grid md:grid-cols-2 gap-16 items-center">
             <div className="space-y-8">
                <h2 className="text-4xl md:text-7xl font-display font-black leading-tight ">Direcionamento <br/>Estratégico</h2>
                <div className="space-y-6 opacity-80 text-lg leading-relaxed">
                   <p>Este planejamento visa unificar a comunicação da marca através de pilares de conteúdo que geram autoridade, conexão e conversão.</p>
                   <p>Focamos em formatos de alto desempenho no Instagram, utilizando carrosséis educativos, reels de engajamento e posts estáticos de branding.</p>
                </div>
                <div className="flex flex-wrap gap-4 pt-4">
                   {['Autoridade', 'Engajamento', 'Branding', 'Conversão'].map(pilar => (
                     <span key={pilar} className="px-4 py-2 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold text-xs uppercase  border border-[var(--color-primary)]/20">{pilar}</span>
                   ))}
                </div>
             </div>
             <div className="glass p-8 md:p-12 rounded-[2.5rem] border border-white/30 dark:border-white/10 shadow-2xl bg-white/60 dark:bg-black/60 backdrop-blur-xl">
                <div className="space-y-8">
                   <div>
                      <span className="text-xs font-bold uppercase  opacity-40 mb-2 block">Volume Mensal</span>
                      <p className="text-5xl font-display font-black text-[var(--color-primary)]">{sortedPostKeys.length} Publicações</p>
                   </div>
                   <div>
                      <span className="text-xs font-bold uppercase  opacity-40 mb-2 block">Mix de Conteúdo</span>
                      <div className="flex gap-2 h-3 mt-4 rounded-full overflow-hidden">
                         <div className="h-full bg-blue-500" style={{ width: `${staticPct}%` }} />
                         <div className="h-full bg-purple-500" style={{ width: `${reelPct}%` }} />
                         <div className="h-full bg-amber-500" style={{ width: `${carouselPct}%` }} />
                      </div>
                      <div className="flex justify-between text-[10px] font-bold mt-3 opacity-60 uppercase ">
                         <span>Posts {staticPct}%</span>
                         <span>Reels {reelPct}%</span>
                         <span>Carrosséis {carouselPct}%</span>
                      </div>
                   </div>
                </div>
             </div>
          </div>
       </div>

       {/* FUNNEL LEVELS INTERACTIVE */}
       <div className="print-funnel space-y-24 relative">
          <div className="text-center space-y-4">
             <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--color-primary)]">Metodologia de Funil</p>
             <h2 className="text-4xl md:text-6xl font-display font-black ">Níveis de Consciência</h2>
          </div>

          <div className="flex flex-col items-center justify-center max-w-4xl mx-auto gap-2 relative min-h-[520px] py-4">
             {funnelLevels.map((level, i) => {
                const isExpanded = expandedLevel === i;
                
                // Three contiguous sections of the same inverted triangle.
                // Every outer edge follows the exact same slope across levels.
                const paths = [
                  "M 42 0 Q 20 0 24 22 L 50 150 L 450 150 L 476 22 Q 480 0 458 0 Z",
                  "M 50 0 L 80 150 L 420 150 L 450 0 Z",
                  "M 80 0 L 108 130 Q 112 150 134 150 L 366 150 Q 388 150 392 130 L 420 0 Z"
                ];

                return (
                  <div key={i} className="relative w-full flex justify-center group">
                    <AnimatePresence mode="wait">
                      {!isExpanded ? (
                        <motion.div
                          layoutId={`funnel-${i}`}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 1.1 }}
                          whileHover={{ scale: 1.05, y: -5 }}
                          onClick={() => setExpandedLevel(i)}
                          className="cursor-pointer relative w-full max-w-[600px] h-[150px] flex items-center justify-center group"
                        >
                           {/* Tooltip */}
                           <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-xl text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl z-30">
                              Clique para mais informações
                           </div>

                           <svg viewBox="0 0 500 150" className="w-full h-full overflow-visible">
                              <motion.path 
                                d={paths[i]} 
                                fill={level.hex.includes('var') ? 'currentColor' : level.hex}
                                className={level.hex.includes('var') ? 'text-[var(--color-primary)]' : ''}
                                fillOpacity={level.opacity}
                                initial={{ pathLength: 0 }}
                                animate={{ pathLength: 1 }}
                                transition={{ duration: 1, delay: i * 0.2 }}
                              />
                           </svg>
                           
                           <div className="absolute inset-0 flex flex-col items-center justify-center text-white pointer-events-none">
                              <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60 mb-1">Nível {i+1}</span>
                              <h3 className="text-2xl font-display font-black uppercase tracking-tighter">{level.title}</h3>
                              <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <Info className="w-3 h-3" />
                                 <span className="text-[10px] font-bold uppercase">Ver Estratégia</span>
                              </div>
                           </div>
                        </motion.div>
                      ) : (
                        <motion.div
                          layoutId={`funnel-${i}`}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="w-full max-w-2xl glass p-10 rounded-[3rem] border-2 border-[var(--color-primary)] shadow-3xl bg-white dark:bg-zinc-900 z-50 relative"
                        >
                           <button 
                             onClick={(e) => { e.stopPropagation(); setExpandedLevel(null); }}
                             className="absolute top-6 right-6 p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                           >
                              <X className="w-6 h-6" />
                           </button>

                           <div className="flex items-center gap-6 mb-8">
                              <div className={cn("w-16 h-16 rounded-3xl flex items-center justify-center text-white font-black text-3xl shadow-lg", level.color)}>
                                 {i + 1}
                              </div>
                              <div>
                                 <h3 className="text-3xl font-display font-black uppercase">{level.title}</h3>
                                 <p className="text-sm font-bold text-[var(--color-primary)] uppercase tracking-widest">{level.subtitle}</p>
                              </div>
                           </div>

                           <p className="text-lg opacity-70 leading-relaxed font-medium mb-8 italic">"{level.desc}"</p>
                           
                           <div className="grid sm:grid-cols-2 gap-8">
                              <div className="space-y-4">
                                 <h4 className="text-xs font-black uppercase tracking-widest opacity-40">Formatos Chave</h4>
                                 <ul className="space-y-3">
                                    {level.items.map(item => (
                                       <li key={item} className="flex items-center gap-3 text-sm font-bold">
                                          <div className="w-2 h-2 rounded-full bg-[var(--color-primary)]" />
                                          {item}
                                       </li>
                                    ))}
                                 </ul>
                              </div>
                              <div className="p-6 rounded-[2rem] bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/10">
                                 <h4 className="text-xs font-black uppercase tracking-widest opacity-40 mb-3">Objetivo Principal</h4>
                                 <p className="text-sm font-medium leading-relaxed">
                                    {i === 0 ? "Transformar desconhecidos em visitantes e seguidores." : 
                                     i === 1 ? "Nutrir o interesse e criar desejo pela solução oferecida." : 
                                     "Converter a audiência em clientes e defensores da marca."}
                                 </p>
                              </div>
                           </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
             })}
          </div>
       </div>
    </motion.div>
  );
}
