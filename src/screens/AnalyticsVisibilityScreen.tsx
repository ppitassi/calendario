import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Eye, Globe, Share2, ArrowUpRight, ArrowDownRight,
  Facebook, Instagram, Twitter, Video, Youtube, Linkedin,
  RefreshCw, Loader2, WifiOff, Image as ImageIcon, ExternalLink
} from 'lucide-react';
import { 
  BarChart, Bar, AreaChart, Area, ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, Legend, Brush, PieChart, Pie, Cell
} from 'recharts';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { api } from '../lib/api';
import { ClientData } from '../types';
import { MainLayout } from '../components/MainLayout';

interface AnalyticsVisibilityScreenProps {
  client: ClientData;
  onNavigate: (screen: string) => void;
}

const PLATFORMS = [
  { id: 'facebook', label: 'Facebook', icon: Facebook, color: '#1877F2' },
  { id: 'instagram', label: 'Instagram', icon: Instagram, color: '#E4405F' },
  { id: 'x', label: 'X', icon: Twitter, color: '#1DA1F2' },
  { id: 'tiktok', label: 'TikTok', icon: Video, color: '#FE2C55' },
  { id: 'youtube', label: 'YouTube', icon: Youtube, color: '#FF0000' },
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: '#0A66C2' },
];

const DATE_RANGES = [
  { label: '7 dias', value: '7d', days: 7 },
  { label: '30 dias', value: '30d', days: 30 },
  { label: '90 dias', value: '90d', days: 90 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-950/95 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-2xl min-w-[180px]">
      <p className="text-[10px] font-black uppercase opacity-50 mb-3 tracking-widest">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-6 py-1">
          <span className="text-[10px] font-bold text-zinc-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
            {entry.name}
          </span>
          <span className="text-xs font-black" style={{ color: entry.color }}>{Number(entry.value).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

export function AnalyticsVisibilityScreen({ client, onNavigate }: AnalyticsVisibilityScreenProps) {
  const [records, setRecords] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30d');
  const [activePlatforms, setActivePlatforms] = useState<string[]>(['facebook', 'instagram', 'tiktok']);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const days = DATE_RANGES.find(d => d.value === dateRange)?.days || 30;
    const endDate = format(new Date(), 'yyyy-MM-dd');
    const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd');
    try {
      const [ts, postsData] = await Promise.all([
        api.getAnalytics(client.id, { startDate, endDate, granularity: 'daily', platforms: PLATFORMS.map(p => p.id) }),
        api.getAnalyticsPosts(client.id),
      ]);
      setRecords(ts.records || []);
      setPosts(postsData || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [client.id, dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const togglePlatform = (id: string) => {
    setActivePlatforms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  // KPI totals
  const kpis = useMemo(() => {
    let totalReach = 0, totalImpressions = 0, totalShares = 0, totalSaves = 0;
    records.forEach(r => {
      PLATFORMS.forEach(p => {
        if (activePlatforms.includes(p.id)) {
          totalReach += r[`${p.id}_reach`] || 0;
          totalImpressions += r[`${p.id}_impressions`] || 0;
          totalShares += r[`${p.id}_shares`] || 0;
          totalSaves += r[`${p.id}_saves`] || 0;
        }
      });
    });
    return { totalReach, totalImpressions, totalShares, totalSaves };
  }, [records, activePlatforms]);

  // Chart data for reach over time
  const reachChartData = useMemo(() => {
    return records.map(r => ({
      date: r.date ? format(new Date(r.date), 'dd/MM', { locale: ptBR }) : '',
      ...PLATFORMS.reduce((acc, p) => {
        acc[`${p.label} Alcance`] = r[`${p.id}_reach`] || 0;
        acc[`${p.label} Impressões`] = r[`${p.id}_impressions`] || 0;
        return acc;
      }, {} as any)
    }));
  }, [records]);

  // Pie chart: reach distribution by platform
  const reachDistribution = useMemo(() => {
    return PLATFORMS.filter(p => activePlatforms.includes(p.id)).map(p => {
      const total = records.reduce((sum, r) => sum + (r[`${p.id}_reach`] || 0), 0);
      return { name: p.label, value: total, color: p.color };
    }).filter(d => d.value > 0);
  }, [records, activePlatforms]);

  // Top posts by reach
  const topPostsByReach = useMemo(() => {
    return [...posts].sort((a, b) => (b.reach || 0) - (a.reach || 0)).slice(0, 10);
  }, [posts]);

  const hasData = records.length > 0;

  const formatNum = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  return (
    <MainLayout activeScreen="analytics_visibility" onNavigate={onNavigate} currentClient={client}>
      <div className="flex-1 flex flex-col p-8 pt-10 overflow-y-auto scrollbar-thin">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-5">
            <div className="p-4 rounded-3xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/5 border border-cyan-500/20">
              <Eye className="w-7 h-7 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-black tracking-tight">Alcance & Visibilidade</h1>
              <p className="text-xs font-bold uppercase opacity-40 tracking-widest mt-1">
                Reach • Impressões • {client.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 p-1 rounded-2xl bg-black/5 dark:bg-white/5 border border-white/5">
              {DATE_RANGES.map(dr => (
                <button key={dr.value} onClick={() => setDateRange(dr.value)}
                  className={cn("px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
                    dateRange === dr.value ? "bg-primary text-white shadow-lg shadow-primary/20" : "opacity-40 hover:opacity-100"
                  )}>
                  {dr.label}
                </button>
              ))}
            </div>
            <button onClick={fetchData} disabled={loading} className="p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-white/5 hover:border-primary/30 transition-all">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Platform pills */}
        <div className="flex items-center gap-3 mb-8">
          <span className="text-[10px] font-black uppercase tracking-widest opacity-30 mr-2">Plataformas:</span>
          {PLATFORMS.map(p => {
            const active = activePlatforms.includes(p.id);
            const Icon = p.icon;
            return (
              <button key={p.id} onClick={() => togglePlatform(p.id)}
                className={cn("flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wider border transition-all",
                  active ? "border-white/20 text-white shadow-lg" : "border-white/5 opacity-30 hover:opacity-60"
                )}
                style={active ? { backgroundColor: `${p.color}20`, borderColor: `${p.color}40` } : {}}>
                <Icon className="w-3.5 h-3.5" style={active ? { color: p.color } : {}} />
                {p.label}
              </button>
            );
          })}
        </div>

        {!hasData && !loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center p-12 rounded-[3rem] glass border border-white/10">
              <div className="p-6 rounded-full bg-white/5 border border-white/10 mb-6 inline-flex"><WifiOff className="w-12 h-12 opacity-30" /></div>
              <h3 className="text-xl font-bold mb-2">Nenhum dado de alcance</h3>
              <p className="text-sm opacity-40 max-w-sm">Sincronize métricas para visualizar dados de visibilidade.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Alcance Total', value: kpis.totalReach, icon: Eye, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
                { label: 'Impressões', value: kpis.totalImpressions, icon: Globe, color: 'text-violet-400', bg: 'bg-violet-500/10' },
                { label: 'Compartilhamentos', value: kpis.totalShares, icon: Share2, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                { label: 'Salvos', value: kpis.totalSaves, icon: ImageIcon, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
              ].map((kpi, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="p-6 rounded-3xl glass border border-white/5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={cn("p-2.5 rounded-2xl", kpi.bg)}>
                      <kpi.icon className={cn("w-5 h-5", kpi.color)} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-40">{kpi.label}</span>
                  </div>
                  <p className="text-3xl font-black tracking-tight">{formatNum(kpi.value)}</p>
                </motion.div>
              ))}
            </div>

            {/* Reach & Impressions Timeline */}
            <div className="glass rounded-[2.5rem] p-8 border border-white/10 shadow-2xl">
              <h3 className="text-sm font-black uppercase tracking-widest mb-1">Alcance ao Longo do Tempo</h3>
              <p className="text-[10px] font-bold uppercase opacity-30 mb-6 tracking-wider">Comparativo reach vs impressões</p>
              <ResponsiveContainer width="100%" height={380}>
                <ComposedChart data={reachChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    {PLATFORMS.filter(p => activePlatforms.includes(p.id)).map(p => (
                      <linearGradient key={p.id} id={`vis-grad-${p.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={p.color} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={p.color} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', paddingTop: 16 }} />
                  {PLATFORMS.filter(p => activePlatforms.includes(p.id)).map(p => (
                    <React.Fragment key={p.id}>
                      <Area type="monotone" dataKey={`${p.label} Alcance`} stroke={p.color} strokeWidth={2.5}
                        fill={`url(#vis-grad-${p.id})`} dot={false} />
                      <Line type="monotone" dataKey={`${p.label} Impressões`} stroke={p.color} strokeWidth={1}
                        strokeDasharray="5 5" dot={false} />
                    </React.Fragment>
                  ))}
                  <Brush dataKey="date" height={30} stroke="rgba(255,255,255,0.1)" fill="rgba(0,0,0,0.3)" 
                    travellerWidth={8} startIndex={Math.max(0, reachChartData.length - 15)} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              {/* Reach Distribution */}
              <div className="lg:col-span-2 glass rounded-[2.5rem] p-8 border border-white/10 shadow-2xl">
                <h3 className="text-sm font-black uppercase tracking-widest mb-6">Distribuição de Alcance</h3>
                {reachDistribution.length > 0 ? (
                  <div className="flex flex-col items-center">
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={reachDistribution} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                          paddingAngle={4} dataKey="value" stroke="none">
                          {reachDistribution.map((entry, idx) => (
                            <Cell key={idx} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-3 mt-4 justify-center">
                      {reachDistribution.map(d => (
                        <div key={d.name} className="flex items-center gap-2 text-[10px] font-bold">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                          <span className="opacity-60">{d.name}</span>
                          <span className="font-black">{formatNum(d.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center opacity-20 text-xs font-bold uppercase">Sem dados</div>
                )}
              </div>

              {/* Top Posts by Reach */}
              <div className="lg:col-span-3 glass rounded-[2.5rem] p-8 border border-white/10 shadow-2xl">
                <h3 className="text-sm font-black uppercase tracking-widest mb-1">Top Posts por Alcance</h3>
                <p className="text-[10px] font-bold uppercase opacity-30 mb-6 tracking-wider">Clique para ver detalhes</p>
                <div className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-thin pr-2">
                  {topPostsByReach.length === 0 ? (
                    <div className="h-32 flex items-center justify-center opacity-20 text-xs font-bold uppercase">Nenhum post com dados</div>
                  ) : topPostsByReach.map((post, i) => {
                    let thumbnail = null;
                    try {
                      const imgs = typeof post.feedImages === 'string' ? JSON.parse(post.feedImages) : post.feedImages;
                      thumbnail = Array.isArray(imgs) && imgs.length > 0 ? imgs[0] : null;
                    } catch { /* ignore */ }

                    return (
                      <button
                        key={post.id}
                        onClick={() => setSelectedPost(selectedPost?.id === post.id ? null : post)}
                        className={cn(
                          "w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left group",
                          selectedPost?.id === post.id
                            ? "border-primary/40 bg-primary/5"
                            : "border-white/5 hover:border-white/15 bg-black/5 dark:bg-white/3"
                        )}
                      >
                        <span className="text-[10px] font-black opacity-20 w-6 shrink-0 text-center">#{i + 1}</span>
                        <div className="w-12 h-12 rounded-xl bg-black/30 overflow-hidden shrink-0">
                          {thumbnail ? <img src={thumbnail} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center opacity-20"><ImageIcon className="w-5 h-5" /></div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate">{post.head || `Post ${post.id}`}</p>
                          <p className="text-[9px] font-bold uppercase opacity-30 mt-0.5">{post.date ? format(new Date(post.date), 'dd MMM yyyy', { locale: ptBR }) : ''}</p>
                        </div>
                        <div className="flex items-center gap-6 shrink-0">
                          <div className="text-center">
                            <p className="text-sm font-black text-cyan-400">{formatNum(post.reach || 0)}</p>
                            <p className="text-[8px] font-black uppercase opacity-30">Alcance</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-black text-violet-400">{formatNum(post.impressions || 0)}</p>
                            <p className="text-[8px] font-black uppercase opacity-30">Impressões</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Expanded post detail */}
                {selectedPost && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4 p-6 rounded-2xl bg-black/10 dark:bg-white/5 border border-white/10">
                    <div className="flex items-start gap-4">
                      {(() => {
                        let thumb = null;
                        try { const imgs = typeof selectedPost.feedImages === 'string' ? JSON.parse(selectedPost.feedImages) : selectedPost.feedImages; thumb = Array.isArray(imgs) && imgs[0] ? imgs[0] : null; } catch {}
                        return thumb ? <img src={thumb} className="w-20 h-20 rounded-xl object-cover" /> : null;
                      })()}
                      <div className="flex-1">
                        <h4 className="text-sm font-bold mb-1">{selectedPost.head}</h4>
                        {selectedPost.subhead && <p className="text-xs opacity-50 mb-3">{selectedPost.subhead}</p>}
                        <div className="grid grid-cols-4 gap-3">
                          {[
                            { label: 'Alcance', value: selectedPost.reach },
                            { label: 'Impressões', value: selectedPost.impressions },
                            { label: 'Curtidas', value: selectedPost.likes },
                            { label: 'Comentários', value: selectedPost.comments },
                          ].map(m => (
                            <div key={m.label} className="p-3 rounded-xl bg-white/5 text-center">
                              <p className="text-lg font-black">{formatNum(m.value || 0)}</p>
                              <p className="text-[8px] font-black uppercase opacity-30">{m.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
