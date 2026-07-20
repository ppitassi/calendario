import React, { useState, useEffect } from 'react';
import { 
  PenTool, 
  PlayCircle, 
  Search, 
  MessageSquare, 
  CheckCircle2, 
  LayoutTemplate,
  TrendingUp,
  ChevronRight,
  Activity
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { api } from '../../lib/api';
import { PostData } from '../../types';
import { motion } from 'motion/react';

export function ProductionBIWidget() {
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllPosts = async () => {
      try {
        const allPosts = await api.getAllPosts();
        setPosts(allPosts);
      } catch (e) {
        console.error("Error fetching BI data", e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAllPosts();

    window.addEventListener('posts-updated', fetchAllPosts);
    const interval = setInterval(fetchAllPosts, 10000);

    return () => {
      window.removeEventListener('posts-updated', fetchAllPosts);
      clearInterval(interval);
    };
  }, []);

  const steps = [
    { id: 'pending', label: 'Briefing', icon: PenTool, color: 'bg-zinc-500', glow: 'shadow-zinc-500/20' },
    { id: 'producing', label: 'Criação', icon: PlayCircle, color: 'bg-blue-500', glow: 'shadow-blue-500/20' },
    { id: 'review', label: 'Revisão', icon: Search, color: 'bg-amber-500', glow: 'shadow-amber-500/20' },
    { id: 'waiting', label: 'Aprovação', icon: MessageSquare, color: 'bg-purple-500', glow: 'shadow-purple-500/20' },
    { id: 'approved', label: 'Concluído', icon: CheckCircle2, color: 'bg-emerald-500', glow: 'shadow-emerald-500/20' },
  ];

  if (loading) return <div className="h-full flex items-center justify-center opacity-20 animate-pulse">Calculando métricas...</div>;

  const total = posts.length || 1;

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex justify-end select-none">
        <div className="px-3 py-1 rounded-full bg-primary/8 text-primary text-[9px] font-black uppercase flex items-center gap-1">
          <Activity className="w-3 h-3" /> {posts.length} posts no ciclo
        </div>
      </div>

      <div className="flex-1 grid grid-cols-5 gap-4 relative">
        {steps.map((step, idx) => {
          const count = posts.filter(p => {
            if (step.id === 'pending') return !p.status || p.status === 'pending';
            return p.status === step.id;
          }).length;
          const percentage = Math.round((count / total) * 100);

          return (
            <div key={step.id} className="relative group">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="flex flex-col items-center gap-4 p-4 rounded-[22px] bg-zinc-50 dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.06] group-hover:border-primary/20 group-hover:-translate-y-0.5 transition-all h-full"
              >
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xl", step.color, step.glow)}>
                  <step.icon className="w-6 h-6" />
                </div>
                
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-display font-black leading-none">{count}</span>
                  <span className="text-[9px] font-bold uppercase opacity-40 mt-1 tracking-tighter">{step.label}</span>
                </div>

                <div className="w-full mt-auto">
                   <div className="h-1 w-full bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        className={cn("h-full", step.color)}
                      />
                   </div>
                   <div className="flex justify-between mt-1 text-[8px] font-black opacity-20">
                      <span>{percentage}%</span>
                      <span>DISTRIBUÍDO</span>
                   </div>
                </div>
              </motion.div>
              {idx < 4 && (
                <div className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 opacity-10">
                  <ChevronRight className="w-6 h-6" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
