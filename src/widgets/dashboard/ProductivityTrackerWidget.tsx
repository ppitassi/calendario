import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Target, 
  Flame, 
  Clock,
  ArrowUpRight,
  MousePointer2,
  CheckCircle
} from 'lucide-react';
import { auth } from '../../lib/auth';
import { api } from '../../lib/api';
import { PostData } from '../../types';
import { motion } from 'motion/react';

interface ProductivityTrackerWidgetProps {
  onOpenAdmin?: () => void;
}

const calculateStreak = (posts: PostData[]): number => {
  if (posts.length === 0) return 0;
  
  const datesSet = new Set<string>();
  posts.forEach(p => {
    if (p.createdAt) {
      const d = new Date(p.createdAt);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      datesSet.add(`${yyyy}-${mm}-${dd}`);
    }
    if (p.updatedAt) {
      const d = new Date(p.updatedAt);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      datesSet.add(`${yyyy}-${mm}-${dd}`);
    }
    if (p.date) {
      const dateStr = p.date.split('T')[0];
      datesSet.add(dateStr);
    }
  });

  const getLocalDateString = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const todayStr = getLocalDateString(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterday);

  if (!datesSet.has(todayStr) && !datesSet.has(yesterdayStr)) {
    return 0;
  }

  let startCheck = todayStr;
  if (!datesSet.has(todayStr) && datesSet.has(yesterdayStr)) {
    startCheck = yesterdayStr;
  }

  let currentStreak = 0;
  const parseDateStr = (str: string) => {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  let pivot = parseDateStr(startCheck);
  while (true) {
    const pivotStr = getLocalDateString(pivot);
    if (datesSet.has(pivotStr)) {
      currentStreak++;
      pivot.setDate(pivot.getDate() - 1);
    } else {
      break;
    }
  }

  return currentStreak;
};

export function ProductivityTrackerWidget({ onOpenAdmin }: ProductivityTrackerWidgetProps) {
  const [personalStats, setPersonalStats] = useState({
    total: 0,
    approved: 0,
    pending: 0,
    streak: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPersonalStats = async () => {
      if (!auth.currentUser) return;
      try {
        const allPosts = await api.getAllPosts();
        const myPosts = allPosts.filter(p => p.assignedTo === auth.currentUser?.uid);
        
        const streak = calculateStreak(myPosts);
        
        setPersonalStats({
          total: myPosts.length,
          approved: myPosts.filter(p => p.status === 'approved').length,
          pending: myPosts.filter(p => p.status !== 'approved').length,
          streak
        });
      } catch (e) {
        console.error("Error fetching productivity stats", e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPersonalStats();

    window.addEventListener('posts-updated', fetchPersonalStats);
    const interval = setInterval(fetchPersonalStats, 10000);

    return () => {
      window.removeEventListener('posts-updated', fetchPersonalStats);
      clearInterval(interval);
    };
  }, []);

  if (loading) return <div className="h-full flex items-center justify-center opacity-20 animate-pulse">Analizando seu desempenho...</div>;

  const completionRate = personalStats.total > 0 ? Math.round((personalStats.approved / personalStats.total) * 100) : 0;

  const userRole = auth.currentUser?.role || 'designer';
  const canManageTeam = ['admin', 'gerente'].includes(userRole);

  return (
    <div className="flex flex-col h-full gap-4">
      {canManageTeam && onOpenAdmin && (
        <div className="flex justify-end select-none">
          <button 
            onClick={onOpenAdmin}
            className="px-4 py-2 bg-black/5 dark:bg-white/5 border border-white/5 hover:bg-primary/20 hover:border-primary/30 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all"
          >
            Gestão de Equipe
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col gap-6">
        {/* Main Stats Circle or Hero */}
        <div className="flex items-center gap-6">
           <div className="relative w-24 h-24 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  className="text-black/5 dark:text-white/5"
                />
                <motion.circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={251.2}
                  initial={{ strokeDashoffset: 251.2 }}
                  animate={{ strokeDashoffset: 251.2 - (251.2 * completionRate) / 100 }}
                  className="text-primary"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-black">{completionRate}%</span>
                <span className="text-[7px] font-bold uppercase opacity-40">Taxa</span>
              </div>
           </div>

           <div className="flex-1 grid grid-cols-2 gap-4">
              <div className="flex flex-col">
                 <span className="text-2xl font-black leading-none">{personalStats.approved}</span>
                 <span className="text-[9px] font-bold uppercase opacity-40 mt-1">Concluídos</span>
              </div>
              <div className="flex flex-col">
                 <span className="text-2xl font-black leading-none">{personalStats.pending}</span>
                 <span className="text-[9px] font-bold uppercase opacity-40 mt-1">Pendentes</span>
              </div>
           </div>
        </div>

        {/* Badges/Achievements */}
        <div className="grid grid-cols-1 gap-3">
           <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-between group">
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center text-white">
                    <Flame className="w-4 h-4" />
                 </div>
                 <div>
                    <span className="text-[10px] font-bold uppercase block leading-none">Streak Atual</span>
                    <span className="text-sm font-black">{personalStats.streak} dias seguidos</span>
                 </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-orange-500 opacity-40 group-hover:opacity-100 transition-opacity" />
           </div>

           <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-between group">
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-white">
                    <Trophy className="w-4 h-4" />
                 </div>
                 <div>
                    <span className="text-[10px] font-bold uppercase block leading-none">Status</span>
                    <span className="text-sm font-black">Top Contributor</span>
                 </div>
              </div>
              <CheckCircle className="w-4 h-4 text-primary opacity-40 group-hover:opacity-100 transition-opacity" />
           </div>
        </div>
      </div>

      <div className="mt-auto flex items-center gap-2 px-4 py-2 bg-black/5 dark:bg-white/5 rounded-xl border border-white/5 cursor-pointer hover:bg-white/10 transition-colors">
         <MousePointer2 className="w-3 h-3 opacity-40" />
         <span className="text-[9px] font-bold uppercase opacity-40 tracking-widest">Abrir Relatório Completo</span>
      </div>
    </div>
  );
}
