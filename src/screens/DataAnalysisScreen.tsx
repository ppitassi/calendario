import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
   Zap, 
   Users as UsersIcon, 
   ArrowLeft, 
   Globe, 
   Layers,
   UserPlus,
   Eye,
   Clock as ClockIcon,
   PlayCircle,
   Trophy,
   Layout,
   Minus,
   Move,
   Download,
   Share2,
   RefreshCw,
   TrendingUp,
   Facebook,
   Instagram,
   Video,
   Youtube,
   Linkedin,
   Twitter,
   BarChart3,
   GitCompare,
   WifiOff,
   Loader2
} from 'lucide-react';
import { 
   AreaChart, Area, XAxis, YAxis, CartesianGrid, 
   Tooltip as RechartsTooltip, ResponsiveContainer, 
   LineChart, Line, BarChart, Bar, ScatterChart, 
   Scatter, ZAxis, PieChart, Pie, Cell, ComposedChart, 
   Legend, Brush 
} from 'recharts';
import { format, subDays } from 'date-fns';
import { cn } from '../lib/utils';
import { ClientData, UserRole } from '../types';
import { api } from '../lib/api';
import { BackgroundEffects } from "../components/BackgroundEffects";
import { ThemeToggle } from "../components/ThemeToggle";
import { DraggableWidget } from '../widgets/analytics/DraggableWidget';
import { WidgetState, Platform } from '../widgets/analytics/types';
import { OmnichannelWidget } from '../widgets/analytics/OmnichannelWidget';
import { StatsWidget } from '../widgets/analytics/StatsWidget';
import { GrowthWidget } from '../widgets/analytics/GrowthWidget';
import { VisibilityWidget } from '../widgets/analytics/VisibilityWidget';
import { PrimeTimeWidget } from '../widgets/analytics/PrimeTimeWidget';
import { VideoWidget } from '../widgets/analytics/VideoWidget';
import { AudienceWidget } from '../widgets/analytics/AudienceWidget';
import { HallOfFameWidget } from '../widgets/analytics/HallOfFameWidget';
import { MainLayout } from '../components/MainLayout';


interface DataAnalysisScreenProps {
   client: ClientData;
   userRole: UserRole;
   onExit: () => void;
   currentClient: ClientData | null;
   onNavigate: (screen: string) => void;
}

export function DataAnalysisScreen({ client, userRole, onExit, currentClient, onNavigate }: DataAnalysisScreenProps) {
   const containerRef = useRef<HTMLDivElement>(null);
   const [hiddenWidgets, setHiddenWidgets] = useState<string[]>([]);
   const [syncing, setSyncing] = useState(false);
   const [syncResult, setSyncResult] = useState<string | null>(null);

   // --- REAL ANALYTICS STATE ---
   const [analyticsData, setAnalyticsData] = useState<{ hasData: boolean; records: any[] }>({ hasData: false, records: [] });
   const [postAnalytics, setPostAnalytics] = useState<any[]>([]);
   const [selectedPostIds, setSelectedPostIds] = useState<number[]>([]);
   const [loadingAnalytics, setLoadingAnalytics] = useState(true);

   const initialWidgetState: WidgetState = {
      dateRange: '7d',
      platforms: ['facebook', 'instagram', 'tiktok', 'youtube', 'x', 'linkedin']
   };

   const [widgetStates, setWidgetStates] = useState<Record<string, WidgetState>>({
      omnichannel: { ...initialWidgetState },
      stats: { ...initialWidgetState },
      growth: { ...initialWidgetState },
      visibility: { ...initialWidgetState },
      primetime: { ...initialWidgetState },
      video: { ...initialWidgetState },
      audience: { ...initialWidgetState },
      halloffame: { ...initialWidgetState },
   });

   const updateWidget = (id: string, updates: Partial<WidgetState>) => {
      setWidgetStates(prev => ({ ...prev, [id]: { ...prev[id], ...updates } }));
   };

   const togglePlatformForWidget = (widgetId: string, platformId: string) => {
      const current = widgetStates[widgetId].platforms;
      const next = current.includes(platformId) ? current.filter(p => p !== platformId) : [...current, platformId];
      updateWidget(widgetId, { platforms: next });
   };

   const platforms: Platform[] = [
      { id: 'facebook', label: 'Facebook', icon: Facebook, color: '#1877F2' },
      { id: 'instagram', label: 'Instagram', icon: Instagram, color: '#E4405F' },
      { id: 'x', label: 'X', icon: Twitter, color: '#000000' },
      { id: 'tiktok', label: 'TikTok', icon: Video, color: '#FE2C55' },
      { id: 'youtube', label: 'YouTube', icon: Youtube, color: '#FF0000' },
      { id: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: '#0A66C2' },
   ];

   // --- FETCH REAL ANALYTICS DATA ---
   const fetchAnalytics = useCallback(async (dateRange = '30d') => {
      setLoadingAnalytics(true);
      const endDate = format(new Date(), 'yyyy-MM-dd');
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd');
      try {
         const [timeseries, posts] = await Promise.all([
            api.getAnalytics(client.id, { startDate, endDate, granularity: 'daily', platforms: platforms.map(p => p.id) }),
            api.getAnalyticsPosts(client.id),
         ]);
         setAnalyticsData(timeseries);
         setPostAnalytics(posts);
      } catch (e) {
         console.error('Error fetching analytics:', e);
         setAnalyticsData({ hasData: false, records: [] });
      } finally {
         setLoadingAnalytics(false);
      }
   }, [client.id]);

   useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

   // --- SYNC BUTTON HANDLER ---
   const handleSync = async () => {
      setSyncing(true);
      setSyncResult(null);
      try {
         const result = await api.syncAnalytics(client.id);
         const synced = result.synced?.join(', ') || 'nenhuma';
         setSyncResult(`✅ Sincronizado: ${synced}`);
         await fetchAnalytics();
      } catch (e: any) {
         setSyncResult('❌ Erro ao sincronizar. Verifique as credenciais.');
      } finally {
         setSyncing(false);
         setTimeout(() => setSyncResult(null), 5000);
      }
   };

   // --- POST COMPARISON CHART DATA ---
   const selectedPostsData = useMemo(() =>
      postAnalytics.filter(p => selectedPostIds.includes(p.id)).map(p => ({
         name: p.head ? String(p.head).substring(0, 24) + '...' : `Post ${p.id}`,
         Curtidas: p.likes,
         Comentários: p.comments,
         Visualizações: p.views,
         Alcance: p.reach,
      })),
   [postAnalytics, selectedPostIds]);

   // Pass real records to widgets when available
   const getWidgetData = useMemo(() => (id: string) => {
      if (analyticsData.hasData && analyticsData.records.length > 0) {
         return analyticsData.records;
      }
      return [];
   }, [analyticsData]);

   const widgets = [
      { id: 'omnichannel', title: 'Intelligence Unit', icon: Zap, colorClass: 'bg-primary/20 text-primary', className: 'md:col-span-4 min-h-[650px]' },
      { id: 'stats', title: 'Live Pulse', icon: Layers, colorClass: 'bg-emerald-500/20 text-emerald-500', className: 'md:col-span-2 min-h-[650px]' },
      { id: 'growth', title: 'Net Growth', icon: UserPlus, colorClass: 'bg-green-500/20 text-green-500', className: 'md:col-span-3 min-h-[500px]' },
      { id: 'visibility', title: 'Visibility Hub', icon: Eye, colorClass: 'bg-cyan-500/20 text-cyan-500', className: 'md:col-span-3 min-h-[500px]' },
      { id: 'primetime', title: 'Peak Engagement', icon: ClockIcon, colorClass: 'bg-amber-500/20 text-amber-500', className: 'md:col-span-2 min-h-[500px]' },
      { id: 'video', title: 'Video Intelligence', icon: PlayCircle, colorClass: 'bg-purple-500/20 text-purple-500', className: 'md:col-span-2 min-h-[500px]' },
      { id: 'audience', title: 'Demographics', icon: UsersIcon, colorClass: 'bg-indigo-500/20 text-indigo-500', className: 'md:col-span-2 min-h-[500px]' },
      { id: 'halloffame', title: 'Hall of Fame', icon: Trophy, colorClass: 'bg-rose-500/20 text-rose-500', className: 'md:col-span-6 min-h-[400px]' },
   ];

   // Widget ID -> dedicated fullscreen route
   const expandMap: Record<string, string> = {
      growth: 'analytics_growth',
      visibility: 'analytics_visibility',
      primetime: 'analytics_primetime',
      video: 'analytics_content',
      halloffame: 'analytics_content',
   };

   // --- EMPTY STATE OVERLAY ---
   const EmptyState = () => (
      <motion.div
         initial={{ opacity: 0 }}
         animate={{ opacity: 1 }}
         className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-[2rem] backdrop-blur-xl bg-black/40 border border-white/10 text-center p-12"
      >
         <div className="p-6 rounded-full bg-white/5 border border-white/10 mb-6">
            <WifiOff className="w-12 h-12 opacity-30" />
         </div>
         <h3 className="text-xl font-bold mb-2">Nenhum dado detectado</h3>
         <p className="text-sm opacity-40 max-w-sm">
            Conecte as contas das redes sociais do cliente na aba <strong>Integrações</strong> e clique em <strong>Sincronizar Métricas</strong>.
         </p>
      </motion.div>
   );

   return (
      <MainLayout activeScreen="data_analysis" onNavigate={onNavigate} currentClient={currentClient}>
         <div className="flex-1 flex flex-col p-8 pt-12">
            {/* Sub-header / Quick Actions Area */}
            <div className="flex items-center justify-between mb-8">
               <div className="flex items-center gap-4">
                  <button onClick={onExit} className="p-3 rounded-2xl bg-black/5 dark:bg-white/5 hover:bg-black/10 transition-all border border-white/5"><ArrowLeft className="w-5 h-5" /></button>
                  <div className="flex flex-col">
                     <h1 className="text-3xl font-display font-black tracking-tight">{client.name}</h1>
                     <span className="text-xs font-bold uppercase opacity-40 tracking-widest mt-1">Analytics BI & Desempenho Omnichannel</span>
                  </div>
               </div>
               <div className="flex items-center gap-4">
                  {syncResult && (
                     <motion.span
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-xs font-bold px-4 py-2 rounded-full bg-white/10"
                     >
                        {syncResult}
                     </motion.span>
                  )}
                  <button
                     onClick={handleSync}
                     disabled={syncing}
                     className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary text-white text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
                  >
                     {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                     {syncing ? 'Sincronizando...' : 'Sincronizar Métricas'}
                  </button>
               </div>
            </div>

            <div ref={containerRef} className="flex-1 w-full max-w-[1600px] mx-auto z-10 relative min-h-[2000px]">
               <div className="grid grid-cols-1 md:grid-cols-6 gap-8">
               <AnimatePresence mode="popLayout">
                  {widgets.map(w => (
                     <DraggableWidget 
                        key={w.id} 
                        id={w.id}
                        title={w.title}
                        icon={w.icon}
                        colorClass={w.colorClass}
                        className={w.className}
                        state={widgetStates[w.id]}
                        platforms={platforms}
                        containerRef={containerRef}
                        onTogglePlatform={togglePlatformForWidget}
                        onUpdateWidget={updateWidget}
                        onHide={(id) => setHiddenWidgets(prev => [...prev, id])}
                        onExpand={expandMap[w.id] ? () => onNavigate(expandMap[w.id]) : undefined}
                     >
                        {/* Empty state overlay if no data */}
                        {!loadingAnalytics && !analyticsData.hasData && <EmptyState />}

                        {w.id === 'omnichannel' && <OmnichannelWidget data={getWidgetData('omnichannel')} state={widgetStates.omnichannel} platforms={platforms} />}
                        {w.id === 'stats' && <StatsWidget data={getWidgetData('stats')} />}
                        {w.id === 'growth' && <GrowthWidget data={getWidgetData('growth')} state={widgetStates.growth} platforms={platforms} />}
                        {w.id === 'visibility' && <VisibilityWidget data={getWidgetData('visibility')} state={widgetStates.visibility} platforms={platforms} />}
                        {w.id === 'primetime' && <PrimeTimeWidget data={getWidgetData('primetime')} state={widgetStates.primetime} platforms={platforms} />}
                        {w.id === 'video' && <VideoWidget data={getWidgetData('video')} />}
                        {w.id === 'audience' && <AudienceWidget />}
                        {w.id === 'halloffame' && <HallOfFameWidget data={getWidgetData('halloffame')} platforms={platforms} />}
                     </DraggableWidget>
                  ))}
               </AnimatePresence>

               {/* --- PER-POST COMPARISON WIDGET --- */}
               <motion.div
                  layout
                  className="md:col-span-6 glass rounded-[2.5rem] p-8 border border-white/10 shadow-2xl space-y-6"
               >
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-violet-500/20 text-violet-400">
                           <GitCompare className="w-5 h-5" />
                        </div>
                        <div>
                           <h3 className="font-bold text-sm">Comparador de Posts</h3>
                           <p className="text-[10px] opacity-40 font-bold uppercase tracking-widest">Selecione posts para comparar métricas</p>
                        </div>
                     </div>
                     <span className="text-[10px] opacity-30 italic">
                        {postAnalytics.length} posts disponíveis
                     </span>
                  </div>

                  {/* Post selector */}
                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto no-scrollbar">
                     {postAnalytics.length === 0 ? (
                        <p className="text-xs opacity-30 italic p-4">Nenhum post com dados de analytics. Sincronize as métricas.</p>
                     ) : postAnalytics.map(post => {
                        const selected = selectedPostIds.includes(post.id);
                        return (
                           <button
                              key={post.id}
                              onClick={() => setSelectedPostIds(prev =>
                                 selected ? prev.filter(id => id !== post.id) : [...prev, post.id]
                              )}
                              className={cn(
                                 'px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-wide border transition-all',
                                 selected
                                    ? 'bg-violet-500/20 border-violet-400/40 text-violet-300'
                                    : 'bg-white/5 border-white/10 opacity-50 hover:opacity-100'
                              )}
                           >
                              {post.head ? String(post.head).substring(0, 30) : `Post ${post.id}`}
                              <span className="ml-2 opacity-40">{format(new Date(post.date), 'dd/MM')}</span>
                           </button>
                        );
                     })}
                  </div>

                  {/* Comparison chart */}
                  {selectedPostsData.length > 0 ? (
                     <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={selectedPostsData} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                           <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} angle={-25} textAnchor="end" interval={0} />
                           <RechartsTooltip contentStyle={{ backgroundColor: 'rgba(10,10,10,0.95)', borderRadius: '1.5rem', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                           <Legend wrapperStyle={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', paddingTop: 20 }} />
                           <Bar dataKey="Curtidas" fill="#E4405F" radius={[6, 6, 0, 0]} />
                           <Bar dataKey="Comentários" fill="#1877F2" radius={[6, 6, 0, 0]} />
                           <Bar dataKey="Visualizações" fill="#FE2C55" radius={[6, 6, 0, 0]} />
                           <Bar dataKey="Alcance" fill="#0A66C2" radius={[6, 6, 0, 0]} />
                        </BarChart>
                     </ResponsiveContainer>
                  ) : (
                     <div className="h-48 flex items-center justify-center opacity-20 border-2 border-dashed border-white/10 rounded-3xl">
                        <p className="text-xs font-bold uppercase">Selecione posts acima para comparar</p>
                     </div>
                  )}
               </motion.div>
            </div>
         </div>
      </div>

         <AnimatePresence>
            {hiddenWidgets.length > 0 && (
               <motion.footer
                  initial={{ y: 100 }}
                  animate={{ y: 0 }}
                  exit={{ y: 100 }}
                  className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60]"
               >
                  <div className="glass px-6 py-4 rounded-full shadow-3xl border border-white/20 flex items-center gap-4">
                     <div className="flex items-center gap-2 pr-4 border-r border-white/10">
                        <Layout className="w-4 h-4 opacity-40" />
                        <span className="text-[10px] font-black uppercase opacity-40">Minimized</span>
                     </div>
                     <div className="flex items-center gap-3">
                        {hiddenWidgets.map(id => {
                           const w = widgets.find(widget => widget.id === id);
                           if (!w) return null;
                           const Icon = w.icon;
                           return (
                              <button
                                 key={id}
                                 onClick={() => setHiddenWidgets(prev => prev.filter(hid => hid !== id))}
                                 className="group relative p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-primary/20 hover:border-primary/40 transition-all"
                                 title={`Restore ${w.title}`}
                              >
                                 <Icon className="w-4 h-4" />
                                 <div className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1 rounded-lg bg-black text-[8px] font-black uppercase text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                    {w.title}
                                 </div>
                              </button>
                           );
                        })}
                     </div>
                  </div>
               </motion.footer>
            )}
         </AnimatePresence>

         <footer className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase hover:text-primary transition-colors">
               <button className="flex items-center gap-2 text-[10px] font-bold uppercase hover:text-primary transition-colors">
                  <Share2 className="w-4 h-4" /> Compartilhar BI
               </button>
            </div>
         </footer>
      </MainLayout>
   );
}
