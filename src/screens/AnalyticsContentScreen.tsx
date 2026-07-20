import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PlayCircle, Film, Eye, Heart, MessageCircle, Share2, Bookmark,
  Facebook, Instagram, Twitter, Video, Youtube, Linkedin,
  RefreshCw, Loader2, WifiOff, Image as ImageIcon, X, ChevronRight, Trophy
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

interface AnalyticsContentScreenProps {
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

const formatNum = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
};

export function AnalyticsContentScreen({ client, onNavigate }: AnalyticsContentScreenProps) {
  const [posts, setPosts] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [sortBy, setSortBy] = useState<'engagement' | 'reach' | 'views' | 'likes'>('engagement');
  const [filterPlatform, setFilterPlatform] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const endDate = format(new Date(), 'yyyy-MM-dd');
    const startDate = format(subDays(new Date(), 90), 'yyyy-MM-dd');
    try {
      const [ts, postsData] = await Promise.all([
        api.getAnalytics(client.id, { startDate, endDate, granularity: 'daily', platforms: PLATFORMS.map(p => p.id) }),
        api.getAnalyticsPosts(client.id),
      ]);
      setRecords(ts.records || []);
      setPosts(postsData || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [client.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Sort and filter posts
  const sortedPosts = useMemo(() => {
    let filtered = filterPlatform ? posts.filter(p => p.platform === filterPlatform) : posts;
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'engagement': return ((b.likes || 0) + (b.comments || 0) + (b.shares || 0)) - ((a.likes || 0) + (a.comments || 0) + (a.shares || 0));
        case 'reach': return (b.reach || 0) - (a.reach || 0);
        case 'views': return (b.views || 0) - (a.views || 0);
        case 'likes': return (b.likes || 0) - (a.likes || 0);
        default: return 0;
      }
    });
  }, [posts, sortBy, filterPlatform]);

  // Content type distribution 
  const typeDistribution = useMemo(() => {
    const types: Record<string, number> = {};
    posts.forEach(p => {
      const type = p.type || 'post';
      types[type] = (types[type] || 0) + 1;
    });
    const colors = ['#E4405F', '#1877F2', '#FE2C55', '#0A66C2', '#FF0000', '#1DA1F2'];
    return Object.entries(types).map(([name, value], i) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: colors[i % colors.length],
    }));
  }, [posts]);

  // Performance by content type
  const perfByType = useMemo(() => {
    const types: Record<string, { count: number; likes: number; comments: number; reach: number; views: number }> = {};
    posts.forEach(p => {
      const type = p.type || 'post';
      if (!types[type]) types[type] = { count: 0, likes: 0, comments: 0, reach: 0, views: 0 };
      types[type].count++;
      types[type].likes += p.likes || 0;
      types[type].comments += p.comments || 0;
      types[type].reach += p.reach || 0;
      types[type].views += p.views || 0;
    });
    return Object.entries(types).map(([type, data]) => ({
      name: type.charAt(0).toUpperCase() + type.slice(1),
      'Curtidas Médias': Math.round(data.likes / data.count),
      'Comentários Médios': Math.round(data.comments / data.count),
      'Alcance Médio': Math.round(data.reach / data.count),
      'Views Médias': Math.round(data.views / data.count),
    }));
  }, [posts]);

  // Engagement rate timeline from posts
  const engagementTimeline = useMemo(() => {
    const sorted = [...posts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return sorted.map(p => {
      const engagement = (p.likes || 0) + (p.comments || 0) + (p.shares || 0);
      const er = p.reach > 0 ? ((engagement / p.reach) * 100) : 0;
      return {
        date: p.date ? format(new Date(p.date), 'dd/MM', { locale: ptBR }) : '',
        'Taxa de Engajamento': parseFloat(er.toFixed(2)),
        'Engajamento': engagement,
        postId: p.id,
        title: p.head || `Post ${p.id}`,
      };
    });
  }, [posts]);

  // KPIs
  const kpis = useMemo(() => {
    let totalLikes = 0, totalComments = 0, totalShares = 0, totalViews = 0, totalReach = 0;
    posts.forEach(p => {
      totalLikes += p.likes || 0;
      totalComments += p.comments || 0;
      totalShares += p.shares || 0;
      totalViews += p.views || 0;
      totalReach += p.reach || 0;
    });
    const totalEng = totalLikes + totalComments + totalShares;
    const avgER = totalReach > 0 ? ((totalEng / totalReach) * 100).toFixed(2) : '0';
    return { totalLikes, totalComments, totalShares, totalViews, totalReach, totalEng, avgER, postCount: posts.length };
  }, [posts]);

  const hasData = posts.length > 0;

  return (
    <MainLayout activeScreen="analytics_content" onNavigate={onNavigate} currentClient={client}>
      <div className="flex-1 flex flex-col p-8 pt-10 overflow-y-auto scrollbar-thin">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-5">
            <div className="p-4 rounded-3xl bg-gradient-to-br from-violet-500/20 to-violet-600/5 border border-violet-500/20">
              <PlayCircle className="w-7 h-7 text-violet-400" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-black tracking-tight">Desempenho de Conteúdo</h1>
              <p className="text-xs font-bold uppercase opacity-40 tracking-widest mt-1">
                Posts • Vídeos • Engajamento • {client.name}
              </p>
            </div>
          </div>

          <button onClick={fetchData} disabled={loading} className="p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-white/5 hover:border-primary/30 transition-all">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </button>
        </div>

        {!hasData && !loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center p-12 rounded-[3rem] glass border border-white/10">
              <div className="p-6 rounded-full bg-white/5 border border-white/10 mb-6 inline-flex"><WifiOff className="w-12 h-12 opacity-30" /></div>
              <h3 className="text-xl font-bold mb-2">Nenhum post com analytics</h3>
              <p className="text-sm opacity-40 max-w-sm">Sincronize métricas de posts para visualizar o desempenho do conteúdo.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              {[
                { label: 'Posts', value: kpis.postCount, icon: Film, color: 'text-violet-400', bg: 'bg-violet-500/10' },
                { label: 'Curtidas', value: kpis.totalLikes, icon: Heart, color: 'text-rose-400', bg: 'bg-rose-500/10' },
                { label: 'Comentários', value: kpis.totalComments, icon: MessageCircle, color: 'text-sky-400', bg: 'bg-sky-500/10' },
                { label: 'Shares', value: kpis.totalShares, icon: Share2, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                { label: 'Views', value: kpis.totalViews, icon: Eye, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
                { label: 'Alcance', value: kpis.totalReach, icon: Eye, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                { label: 'ER Médio', value: `${kpis.avgER}%`, icon: Trophy, color: 'text-primary', bg: 'bg-primary/10', isString: true },
              ].map((kpi: any, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  className="p-5 rounded-3xl glass border border-white/5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={cn("p-2 rounded-xl", kpi.bg)}>
                      <kpi.icon className={cn("w-4 h-4", kpi.color)} />
                    </div>
                  </div>
                  <p className="text-xl font-black tracking-tight mb-0.5">{kpi.isString ? kpi.value : formatNum(kpi.value)}</p>
                  <p className="text-[8px] font-black uppercase opacity-30 tracking-widest">{kpi.label}</p>
                </motion.div>
              ))}
            </div>

            {/* Engagement Rate Timeline */}
            <div className="glass rounded-[2.5rem] p-8 border border-white/10 shadow-2xl">
              <h3 className="text-sm font-black uppercase tracking-widest mb-1">Taxa de Engajamento por Post</h3>
              <p className="text-[10px] font-bold uppercase opacity-30 mb-6 tracking-wider">ER% e engajamento absoluto ao longo do tempo</p>
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={engagementTimeline} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="erGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', paddingTop: 16 }} />
                  <Area yAxisId="left" type="monotone" dataKey="Engajamento" fill="url(#erGrad)" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="Taxa de Engajamento" stroke="#fbbf24" strokeWidth={2.5} dot={{ r: 3, fill: '#fbbf24' }} />
                  <Brush dataKey="date" height={30} stroke="rgba(255,255,255,0.1)" fill="rgba(0,0,0,0.3)" travellerWidth={8} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              {/* Content Type Distribution */}
              <div className="lg:col-span-2 glass rounded-[2.5rem] p-8 border border-white/10 shadow-2xl">
                <h3 className="text-sm font-black uppercase tracking-widest mb-6">Tipos de Conteúdo</h3>
                {typeDistribution.length > 0 ? (
                  <div className="flex flex-col items-center">
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={typeDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                          paddingAngle={4} dataKey="value" stroke="none">
                          {typeDistribution.map((entry, idx) => (
                            <Cell key={idx} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-3 mt-4 justify-center">
                      {typeDistribution.map(d => (
                        <div key={d.name} className="flex items-center gap-2 text-[10px] font-bold">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                          <span className="opacity-60">{d.name}</span>
                          <span className="font-black">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : <div className="h-48 flex items-center justify-center opacity-20 text-xs font-bold uppercase">Sem dados</div>}
              </div>

              {/* Performance by Type */}
              <div className="lg:col-span-3 glass rounded-[2.5rem] p-8 border border-white/10 shadow-2xl">
                <h3 className="text-sm font-black uppercase tracking-widest mb-1">Performance por Tipo</h3>
                <p className="text-[10px] font-bold uppercase opacity-30 mb-6 tracking-wider">Média de métricas por formato de conteúdo</p>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={perfByType} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', paddingTop: 12 }} />
                    <Bar dataKey="Curtidas Médias" fill="#E4405F" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Comentários Médios" fill="#1877F2" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Alcance Médio" fill="#0A66C2" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Post Gallery / Ranking */}
            <div className="glass rounded-[2.5rem] p-8 border border-white/10 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest">Ranking de Posts</h3>
                  <p className="text-[10px] font-bold uppercase opacity-30 mt-1 tracking-wider">Clique para expandir detalhes</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black uppercase opacity-30 mr-2">Ordenar:</span>
                  {[
                    { id: 'engagement', label: 'Engajamento' },
                    { id: 'reach', label: 'Alcance' },
                    { id: 'views', label: 'Views' },
                    { id: 'likes', label: 'Curtidas' },
                  ].map(opt => (
                    <button key={opt.id} onClick={() => setSortBy(opt.id as any)}
                      className={cn("px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all",
                        sortBy === opt.id ? "bg-primary/20 text-primary border border-primary/30" : "bg-white/5 opacity-40 hover:opacity-100 border border-white/5"
                      )}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[700px] overflow-y-auto scrollbar-thin pr-2">
                {sortedPosts.slice(0, 20).map((post, i) => {
                  let thumbnail = null;
                  try {
                    const imgs = typeof post.feedImages === 'string' ? JSON.parse(post.feedImages) : post.feedImages;
                    thumbnail = Array.isArray(imgs) && imgs.length > 0 ? imgs[0] : null;
                  } catch { /* ignore */ }

                  const engagement = (post.likes || 0) + (post.comments || 0) + (post.shares || 0);
                  const er = post.reach > 0 ? ((engagement / post.reach) * 100).toFixed(1) : '0';
                  const isSelected = selectedPost?.id === post.id;

                  return (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      onClick={() => setSelectedPost(isSelected ? null : post)}
                      className={cn(
                        "rounded-3xl border overflow-hidden cursor-pointer transition-all group",
                        isSelected ? "border-primary/40 ring-2 ring-primary/20" : "border-white/5 hover:border-white/15"
                      )}
                    >
                      {/* Thumbnail */}
                      <div className="aspect-video bg-black/30 relative overflow-hidden">
                        {thumbnail ? (
                          <img src={thumbnail} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt="" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center opacity-10">
                            <ImageIcon className="w-10 h-10" />
                          </div>
                        )}
                        {i < 3 && (
                          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-amber-500/90 text-[8px] font-black uppercase text-black">
                            🏆 #{i + 1}
                          </div>
                        )}
                        <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-[9px] font-black text-primary">
                          ER {er}%
                        </div>
                      </div>

                      {/* Info */}
                      <div className="p-4 bg-black/5 dark:bg-white/3">
                        <p className="text-xs font-bold truncate mb-1">{post.head || `Post ${post.id}`}</p>
                        <p className="text-[9px] font-bold uppercase opacity-30 mb-3">
                          {post.date ? format(new Date(post.date), 'dd MMM yyyy', { locale: ptBR }) : ''}
                          {post.type && ` • ${post.type}`}
                        </p>
                        <div className="grid grid-cols-4 gap-2">
                          <div className="text-center">
                            <Heart className="w-3 h-3 mx-auto mb-1 opacity-40" />
                            <p className="text-[10px] font-black">{formatNum(post.likes || 0)}</p>
                          </div>
                          <div className="text-center">
                            <MessageCircle className="w-3 h-3 mx-auto mb-1 opacity-40" />
                            <p className="text-[10px] font-black">{formatNum(post.comments || 0)}</p>
                          </div>
                          <div className="text-center">
                            <Eye className="w-3 h-3 mx-auto mb-1 opacity-40" />
                            <p className="text-[10px] font-black">{formatNum(post.views || 0)}</p>
                          </div>
                          <div className="text-center">
                            <Share2 className="w-3 h-3 mx-auto mb-1 opacity-40" />
                            <p className="text-[10px] font-black">{formatNum(post.shares || 0)}</p>
                          </div>
                        </div>
                      </div>

                      {/* Expanded detail */}
                      <AnimatePresence>
                        {isSelected && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="p-4 border-t border-white/5 bg-primary/5 space-y-3">
                              {post.subhead && <p className="text-xs opacity-60">{post.subhead}</p>}
                              <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 rounded-xl bg-white/5 text-center">
                                  <p className="text-lg font-black text-cyan-400">{formatNum(post.reach || 0)}</p>
                                  <p className="text-[8px] font-black uppercase opacity-30">Alcance</p>
                                </div>
                                <div className="p-3 rounded-xl bg-white/5 text-center">
                                  <p className="text-lg font-black text-violet-400">{formatNum(post.impressions || 0)}</p>
                                  <p className="text-[8px] font-black uppercase opacity-30">Impressões</p>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
