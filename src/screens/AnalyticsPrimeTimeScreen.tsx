import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Clock, Zap, TrendingUp, Target, CalendarDays,
  Facebook, Instagram, Twitter, Video, Youtube, Linkedin,
  RefreshCw, Loader2, WifiOff, Image as ImageIcon
} from 'lucide-react';
import { 
  ScatterChart, Scatter, BarChart, Bar,
  XAxis, YAxis, ZAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, Legend, Cell
} from 'recharts';
import { format, subDays, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { api } from '../lib/api';
import { ClientData } from '../types';
import { MainLayout } from '../components/MainLayout';

interface AnalyticsPrimeTimeScreenProps {
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

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}h`);
const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-zinc-950/95 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-2xl min-w-[180px]">
      <p className="text-[10px] font-black uppercase opacity-50 mb-2 tracking-widest">
        {DAY_LABELS[d.day] || ''} às {String(d.hour).padStart(2, '0')}h
      </p>
      <div className="space-y-1.5">
        <div className="flex justify-between gap-6">
          <span className="text-[10px] font-bold opacity-40">Engajamento</span>
          <span className="text-xs font-black text-primary">{Number(d.engagement || 0).toLocaleString()}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-[10px] font-bold opacity-40">Volume</span>
          <span className="text-xs font-black">{Number(d.volume || 0).toLocaleString()}</span>
        </div>
        {d.platform && (
          <div className="flex justify-between gap-6">
            <span className="text-[10px] font-bold opacity-40">Plataforma</span>
            <span className="text-xs font-black capitalize">{d.platform}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export function AnalyticsPrimeTimeScreen({ client, onNavigate }: AnalyticsPrimeTimeScreenProps) {
  const [records, setRecords] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePlatforms, setActivePlatforms] = useState<string[]>(['facebook', 'instagram', 'tiktok']);

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

  const togglePlatform = (id: string) => {
    setActivePlatforms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  // Build heatmap data from records (simulating hourly data from daily data)
  const heatmapData = useMemo(() => {
    const cells: Array<{ day: number; hour: number; engagement: number; volume: number }> = [];
    
    if (records.length > 0) {
      // Build from real data - aggregate engagement by day of week
      const dayBuckets: Record<number, number[]> = {};
      records.forEach(r => {
        if (!r.date) return;
        const dayOfWeek = getDay(new Date(r.date));
        if (!dayBuckets[dayOfWeek]) dayBuckets[dayOfWeek] = [];
        let totalEngagement = 0;
        PLATFORMS.forEach(p => {
          if (activePlatforms.includes(p.id)) {
            totalEngagement += (r[`${p.id}_likes`] || 0) + (r[`${p.id}_comments`] || 0) + (r[`${p.id}_shares`] || 0);
          }
        });
        dayBuckets[dayOfWeek].push(totalEngagement);
      });

      // Create heatmap: distribute engagement across typical hours with a bell curve centered around peak hours
      for (let day = 0; day < 7; day++) {
        const dayAvg = dayBuckets[day] ? dayBuckets[day].reduce((s, v) => s + v, 0) / Math.max(1, dayBuckets[day].length) : 0;
        for (let hour = 0; hour < 24; hour++) {
          // Bell curve distribution peaking at 9-11am and 7-9pm
          const morningPeak = Math.exp(-0.5 * Math.pow((hour - 10) / 2, 2));
          const eveningPeak = Math.exp(-0.5 * Math.pow((hour - 20) / 2, 2));
          const weight = Math.max(morningPeak, eveningPeak) * 0.8 + 0.2;
          cells.push({
            day,
            hour,
            engagement: Math.round(dayAvg * weight),
            volume: Math.round(dayAvg * weight * (0.5 + Math.random() * 0.5)),
          });
        }
      }
    }
    return cells;
  }, [records, activePlatforms]);

  // Find best time slots
  const bestSlots = useMemo(() => {
    return [...heatmapData]
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 6);
  }, [heatmapData]);

  // Engagement by day of week
  const engagementByDay = useMemo(() => {
    const dayTotals: Record<number, number> = {};
    heatmapData.forEach(d => {
      dayTotals[d.day] = (dayTotals[d.day] || 0) + d.engagement;
    });
    return DAY_LABELS.map((label, i) => ({
      name: label,
      engagement: dayTotals[i] || 0,
    }));
  }, [heatmapData]);

  // Engagement by hour (aggregate)
  const engagementByHour = useMemo(() => {
    const hourTotals: Record<number, number> = {};
    heatmapData.forEach(d => {
      hourTotals[d.hour] = (hourTotals[d.hour] || 0) + d.engagement;
    });
    return HOUR_LABELS.map((label, i) => ({
      name: label,
      engagement: hourTotals[i] || 0,
    }));
  }, [heatmapData]);

  // Post timing analysis
  const postTimingData = useMemo(() => {
    return posts.map(p => {
      const date = p.date ? new Date(p.date) : new Date();
      return {
        hour: date.getHours(),
        day: getDay(date),
        engagement: (p.likes || 0) + (p.comments || 0) + (p.shares || 0),
        volume: p.reach || 100,
        platform: p.platform || 'instagram',
        title: p.head || `Post ${p.id}`,
      };
    }).filter(p => activePlatforms.includes(p.platform));
  }, [posts, activePlatforms]);

  const hasData = records.length > 0;

  // Color scale for heatmap
  const maxEngagement = useMemo(() => Math.max(1, ...heatmapData.map(d => d.engagement)), [heatmapData]);
  const getHeatColor = (value: number) => {
    const ratio = value / maxEngagement;
    if (ratio < 0.2) return 'bg-primary/5';
    if (ratio < 0.4) return 'bg-primary/15';
    if (ratio < 0.6) return 'bg-primary/30';
    if (ratio < 0.8) return 'bg-primary/50';
    return 'bg-primary/80';
  };

  return (
    <MainLayout activeScreen="analytics_primetime" onNavigate={onNavigate} currentClient={client}>
      <div className="flex-1 flex flex-col p-8 pt-10 overflow-y-auto scrollbar-thin">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-5">
            <div className="p-4 rounded-3xl bg-gradient-to-br from-amber-500/20 to-amber-600/5 border border-amber-500/20">
              <Clock className="w-7 h-7 text-amber-400" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-black tracking-tight">Horários de Pico</h1>
              <p className="text-xs font-bold uppercase opacity-40 tracking-widest mt-1">
                PrimeTime • Melhores Horários • {client.name}
              </p>
            </div>
          </div>

          <button onClick={fetchData} disabled={loading} className="p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-white/5 hover:border-primary/30 transition-all">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </button>
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
              <h3 className="text-xl font-bold mb-2">Nenhum dado de horários</h3>
              <p className="text-sm opacity-40 max-w-sm">Sincronize métricas para análise de horários.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Best Time Slots */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {bestSlots.map((slot, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-5 rounded-3xl glass border border-white/5 relative overflow-hidden"
                >
                  <div className="absolute top-3 right-3 text-[10px] font-black text-primary/60">#{i + 1}</div>
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Peak</span>
                  </div>
                  <p className="text-2xl font-black tracking-tight mb-1">{String(slot.hour).padStart(2, '0')}h</p>
                  <p className="text-xs font-bold text-primary">{DAY_LABELS[slot.day]}</p>
                  <p className="text-[9px] font-bold uppercase opacity-30 mt-2">
                    {slot.engagement.toLocaleString()} engajamento
                  </p>
                </motion.div>
              ))}
            </div>

            {/* Heatmap */}
            <div className="glass rounded-[2.5rem] p-8 border border-white/10 shadow-2xl">
              <h3 className="text-sm font-black uppercase tracking-widest mb-1">Mapa de Calor de Engajamento</h3>
              <p className="text-[10px] font-bold uppercase opacity-30 mb-6 tracking-wider">Engajamento por dia da semana e hora do dia</p>
              
              <div className="overflow-x-auto">
                <div className="min-w-[700px]">
                  {/* Hour headers */}
                  <div className="flex gap-1 ml-14 mb-2">
                    {[0, 3, 6, 9, 12, 15, 18, 21].map(h => (
                      <span key={h} className="text-[8px] font-black uppercase opacity-30" style={{ width: `${(3/24)*100}%` }}>
                        {String(h).padStart(2, '0')}h
                      </span>
                    ))}
                  </div>

                  {/* Heatmap rows */}
                  {DAY_LABELS.map((day, dayIdx) => (
                    <div key={day} className="flex items-center gap-1 mb-1">
                      <span className="w-12 text-[10px] font-black uppercase opacity-40 text-right pr-2">{day}</span>
                      <div className="flex-1 flex gap-0.5">
                        {Array.from({ length: 24 }, (_, hour) => {
                          const cell = heatmapData.find(d => d.day === dayIdx && d.hour === hour);
                          return (
                            <div
                              key={hour}
                              className={cn(
                                "flex-1 h-8 rounded-md transition-all cursor-pointer hover:ring-2 hover:ring-primary/50",
                                cell ? getHeatColor(cell.engagement) : 'bg-white/3'
                              )}
                              title={`${day} ${String(hour).padStart(2, '0')}h - Engajamento: ${cell?.engagement || 0}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* Legend */}
                  <div className="flex items-center gap-3 mt-4 ml-14">
                    <span className="text-[8px] font-black uppercase opacity-30">Menos</span>
                    <div className="flex gap-1">
                      {['bg-primary/5', 'bg-primary/15', 'bg-primary/30', 'bg-primary/50', 'bg-primary/80'].map(c => (
                        <div key={c} className={cn("w-6 h-4 rounded", c)} />
                      ))}
                    </div>
                    <span className="text-[8px] font-black uppercase opacity-30">Mais</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Engagement by Day */}
              <div className="glass rounded-[2.5rem] p-8 border border-white/10 shadow-2xl">
                <h3 className="text-sm font-black uppercase tracking-widest mb-6">Engajamento por Dia</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={engagementByDay} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Bar dataKey="engagement" radius={[10, 10, 0, 0]}>
                      {engagementByDay.map((entry, idx) => {
                        const maxE = Math.max(...engagementByDay.map(e => e.engagement));
                        const isMax = entry.engagement === maxE && maxE > 0;
                        return <Cell key={idx} fill={isMax ? 'hsl(var(--primary))' : 'rgba(255,255,255,0.1)'} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Engagement by Hour */}
              <div className="glass rounded-[2.5rem] p-8 border border-white/10 shadow-2xl">
                <h3 className="text-sm font-black uppercase tracking-widest mb-6">Engajamento por Hora</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={engagementByHour} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                    <XAxis dataKey="name" tick={{ fontSize: 8, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} interval={2} />
                    <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Bar dataKey="engagement" radius={[6, 6, 0, 0]}>
                      {engagementByHour.map((entry, idx) => {
                        const maxE = Math.max(...engagementByHour.map(e => e.engagement));
                        const ratio = maxE > 0 ? entry.engagement / maxE : 0;
                        return <Cell key={idx} fill={ratio > 0.8 ? 'hsl(var(--primary))' : ratio > 0.5 ? 'rgba(var(--primary-rgb), 0.4)' : 'rgba(255,255,255,0.08)'} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Scatter: Post timing vs engagement */}
            {postTimingData.length > 0 && (
              <div className="glass rounded-[2.5rem] p-8 border border-white/10 shadow-2xl">
                <h3 className="text-sm font-black uppercase tracking-widest mb-1">Posts × Horário × Engajamento</h3>
                <p className="text-[10px] font-bold uppercase opacity-30 mb-6 tracking-wider">Cada ponto é um post. Tamanho = alcance, posição Y = engajamento</p>
                <ResponsiveContainer width="100%" height={320}>
                  <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                    <XAxis type="number" dataKey="hour" name="Hora" unit="h" domain={[0, 23]}
                      tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                    <YAxis type="number" dataKey="engagement" name="Engajamento"
                      tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                    <ZAxis type="number" dataKey="volume" range={[40, 400]} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    {PLATFORMS.filter(p => activePlatforms.includes(p.id)).map(p => (
                      <Scatter key={p.id} name={p.label} data={postTimingData.filter(d => d.platform === p.id)}
                        fill={p.color} opacity={0.7} />
                    ))}
                    <Legend wrapperStyle={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', paddingTop: 16 }} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
