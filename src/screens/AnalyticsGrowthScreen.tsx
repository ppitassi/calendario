import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  TrendingUp, TrendingDown, UserPlus, Users, ArrowUpRight, ArrowDownRight,
  Facebook, Instagram, Twitter, Video, Youtube, Linkedin,
  Calendar, ChevronDown, RefreshCw, Loader2, WifiOff, Minus
} from 'lucide-react';
import { 
  AreaChart, Area, LineChart, Line, BarChart, Bar, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, Legend, Brush
} from 'recharts';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { api } from '../lib/api';
import { ClientData } from '../types';
import { MainLayout } from '../components/MainLayout';

interface AnalyticsGrowthScreenProps {
  client: ClientData;
  onNavigate: (screen: string) => void;
}

const PLATFORMS = [
  { id: 'facebook', label: 'Facebook', icon: Facebook, color: '#1877F2', gradient: 'from-[#1877F2]/20 to-[#1877F2]/5' },
  { id: 'instagram', label: 'Instagram', icon: Instagram, color: '#E4405F', gradient: 'from-[#E4405F]/20 to-[#E4405F]/5' },
  { id: 'x', label: 'X', icon: Twitter, color: '#1DA1F2', gradient: 'from-[#1DA1F2]/20 to-[#1DA1F2]/5' },
  { id: 'tiktok', label: 'TikTok', icon: Video, color: '#FE2C55', gradient: 'from-[#FE2C55]/20 to-[#FE2C55]/5' },
  { id: 'youtube', label: 'YouTube', icon: Youtube, color: '#FF0000', gradient: 'from-[#FF0000]/20 to-[#FF0000]/5' },
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: '#0A66C2', gradient: 'from-[#0A66C2]/20 to-[#0A66C2]/5' },
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

export function AnalyticsGrowthScreen({ client, onNavigate }: AnalyticsGrowthScreenProps) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30d');
  const [activePlatforms, setActivePlatforms] = useState<string[]>(['facebook', 'instagram', 'tiktok']);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const days = DATE_RANGES.find(d => d.value === dateRange)?.days || 30;
    const endDate = format(new Date(), 'yyyy-MM-dd');
    const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd');
    try {
      const result = await api.getAnalytics(client.id, { 
        startDate, endDate, granularity: 'daily', 
        platforms: PLATFORMS.map(p => p.id) 
      });
      setRecords(result.records || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [client.id, dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const togglePlatform = (id: string) => {
    setActivePlatforms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  // Derived metrics
  const growthSummary = useMemo(() => {
    if (!records.length) return {};
    const summary: Record<string, { total: number; change: number; changePercent: number }> = {};
    
    for (const platform of PLATFORMS) {
      const key = `${platform.id}_growth`;
      const followers_key = `${platform.id}_followers`;
      const values = records.map(r => r[key] || r[followers_key] || 0).filter(v => v);
      if (values.length < 2) {
        summary[platform.id] = { total: values[values.length - 1] || 0, change: 0, changePercent: 0 };
        continue;
      }
      const first = values[0];
      const last = values[values.length - 1];
      const change = last - first;
      const changePercent = first > 0 ? ((change / first) * 100) : 0;
      summary[platform.id] = { total: last, change, changePercent };
    }
    return summary;
  }, [records]);

  const chartData = useMemo(() => {
    return records.map(r => ({
      date: r.date ? format(new Date(r.date), 'dd/MM', { locale: ptBR }) : '',
      ...PLATFORMS.reduce((acc, p) => {
        acc[p.label] = r[`${p.id}_growth`] || r[`${p.id}_followers`] || 0;
        return acc;
      }, {} as any)
    }));
  }, [records]);

  // Compute net gains per period for the bar chart
  const netGainData = useMemo(() => {
    if (records.length < 2) return [];
    const chunkSize = Math.max(1, Math.floor(records.length / 8));
    const chunks: any[] = [];
    for (let i = 0; i < records.length; i += chunkSize) {
      const slice = records.slice(i, i + chunkSize);
      const label = slice[0]?.date ? format(new Date(slice[0].date), 'dd/MM') : '';
      const entry: any = { period: label };
      PLATFORMS.forEach(p => {
        const key = `${p.id}_growth`;
        const fKey = `${p.id}_followers`;
        const vals = slice.map(r => r[key] || r[fKey] || 0);
        entry[p.label] = (vals[vals.length - 1] || 0) - (vals[0] || 0);
      });
      chunks.push(entry);
    }
    return chunks;
  }, [records]);

  const hasData = records.length > 0;

  return (
    <MainLayout activeScreen="analytics_growth" onNavigate={onNavigate} currentClient={client}>
      <div className="flex-1 flex flex-col p-8 pt-10 overflow-y-auto scrollbar-thin">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-5">
            <div className="p-4 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/5 border border-emerald-500/20">
              <TrendingUp className="w-7 h-7 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-black tracking-tight">Crescimento de Audiência</h1>
              <p className="text-xs font-bold uppercase opacity-40 tracking-widest mt-1">
                Net Growth • Seguidores • {client.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Date Range Selector */}
            <div className="flex items-center gap-1 p-1 rounded-2xl bg-black/5 dark:bg-white/5 border border-white/5">
              {DATE_RANGES.map(dr => (
                <button
                  key={dr.value}
                  onClick={() => setDateRange(dr.value)}
                  className={cn(
                    "px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
                    dateRange === dr.value
                      ? "bg-primary text-white shadow-lg shadow-primary/20"
                      : "opacity-40 hover:opacity-100"
                  )}
                >
                  {dr.label}
                </button>
              ))}
            </div>

            <button
              onClick={fetchData}
              disabled={loading}
              className="p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-white/5 hover:border-primary/30 transition-all"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Platform Filter Pills */}
        <div className="flex items-center gap-3 mb-8">
          <span className="text-[10px] font-black uppercase tracking-widest opacity-30 mr-2">Plataformas:</span>
          {PLATFORMS.map(p => {
            const active = activePlatforms.includes(p.id);
            const Icon = p.icon;
            return (
              <button
                key={p.id}
                onClick={() => togglePlatform(p.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wider border transition-all",
                  active
                    ? "border-white/20 text-white shadow-lg"
                    : "border-white/5 opacity-30 hover:opacity-60"
                )}
                style={active ? { backgroundColor: `${p.color}20`, borderColor: `${p.color}40` } : {}}
              >
                <Icon className="w-3.5 h-3.5" style={active ? { color: p.color } : {}} />
                {p.label}
              </button>
            );
          })}
        </div>

        {!hasData && !loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center p-12 rounded-[3rem] glass border border-white/10">
              <div className="p-6 rounded-full bg-white/5 border border-white/10 mb-6 inline-flex">
                <WifiOff className="w-12 h-12 opacity-30" />
              </div>
              <h3 className="text-xl font-bold mb-2">Nenhum dado de crescimento</h3>
              <p className="text-sm opacity-40 max-w-sm">Sincronize métricas no painel Analytics BI para visualizar dados de crescimento.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {PLATFORMS.filter(p => activePlatforms.includes(p.id)).map(p => {
                const data = growthSummary[p.id];
                const Icon = p.icon;
                if (!data) return null;
                const isPositive = data.change >= 0;
                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn("p-5 rounded-3xl border border-white/5 bg-gradient-to-br", p.gradient)}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <Icon className="w-5 h-5" style={{ color: p.color }} />
                      <div className={cn(
                        "flex items-center gap-1 text-[10px] font-black",
                        isPositive ? "text-emerald-400" : "text-rose-400"
                      )}>
                        {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {Math.abs(data.changePercent).toFixed(1)}%
                      </div>
                    </div>
                    <p className="text-2xl font-black tracking-tight mb-1">{data.total.toLocaleString()}</p>
                    <p className="text-[9px] font-bold uppercase opacity-40 tracking-widest">Seguidores</p>
                    <div className={cn(
                      "mt-2 text-[10px] font-bold px-2 py-1 rounded-lg inline-flex items-center gap-1",
                      isPositive ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                    )}>
                      {isPositive ? '+' : ''}{data.change.toLocaleString()} no período
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Main Growth Chart */}
            <div className="glass rounded-[2.5rem] p-8 border border-white/10 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest">Evolução de Seguidores</h3>
                  <p className="text-[10px] font-bold uppercase opacity-30 mt-1 tracking-wider">Timeline comparativa por plataforma</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={380}>
                <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    {PLATFORMS.filter(p => activePlatforms.includes(p.id)).map(p => (
                      <linearGradient key={p.id} id={`grad-${p.id}`} x1="0" y1="0" x2="0" y2="1">
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
                    <Area key={p.id} type="monotone" dataKey={p.label} stroke={p.color} strokeWidth={2.5} 
                      fill={`url(#grad-${p.id})`} dot={false} activeDot={{ r: 5, stroke: p.color, strokeWidth: 2, fill: '#0a0a0a' }} />
                  ))}
                  <Brush dataKey="date" height={30} stroke="rgba(255,255,255,0.1)" fill="rgba(0,0,0,0.3)" 
                    travellerWidth={8} startIndex={Math.max(0, chartData.length - 15)} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Net Gains Bar Chart */}
            <div className="glass rounded-[2.5rem] p-8 border border-white/10 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest">Saldo Líquido por Período</h3>
                  <p className="text-[10px] font-bold uppercase opacity-30 mt-1 tracking-wider">Net Gain / Loss de seguidores</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={netGainData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="period" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', paddingTop: 16 }} />
                  {PLATFORMS.filter(p => activePlatforms.includes(p.id)).map(p => (
                    <Bar key={p.id} dataKey={p.label} fill={p.color} radius={[8, 8, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
