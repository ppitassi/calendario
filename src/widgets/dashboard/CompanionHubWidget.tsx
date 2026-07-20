import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Cloud, Sun, CloudRain, Wind, AlertTriangle, 
  ThermometerSun, Settings, Calendar, TrendingUp, 
  Sparkles, X, Check, ExternalLink, MapPin, 
  RefreshCw, Clock, Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { auth } from '../../lib/auth';
import { api } from '../../lib/api';
import { CompanionSettings, ClientData } from '../../types';
import { CompanionSetupModal } from '../../modals/CompanionSetupModal';
import { cn } from '../../lib/utils';

interface WeatherData {
  temp: number;
  city: string;
  condition: string;
  uv: number;
  humidity: number;
  isStorm: boolean;
  windSpeed: number;
}

interface Trend {
  term: string;
  url: string;
}

interface StrategicDate {
  date: string;
  name: string;
  type: 'holiday' | 'strategic';
}

const DEFAULT_SETTINGS: CompanionSettings = {
  locationName: '',
  showWeather: true,
  showTrends: true,
  showCalendar: true,
  showHolidays: true,
  hasConfigured: false
};

interface CompanionHubWidgetProps {
  currentClient?: ClientData | null;
}

interface Message {
  id: string;
  sender: 'user' | 'leia';
  text: string;
  timestamp: number;
}

export function CompanionHubWidget({ currentClient }: CompanionHubWidgetProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [strategicDates, setStrategicDates] = useState<StrategicDate[]>([]);
  const [settings, setSettings] = useState<CompanionSettings>(DEFAULT_SETTINGS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeWidget, setActiveWidget] = useState<'leia' | 'weather' | 'trends' | 'calendar'>('leia');
  const [locationStatus, setLocationStatus] = useState<'detecting' | 'ip' | 'gps' | 'error'>('detecting');

  // LeIA assistant states
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const welcomeText = currentClient
      ? `Olá! Sou a LeIA, sua assistente criativa. Como posso ajudar com as redes de **${currentClient.name}** hoje?`
      : "Olá! Sou a LeIA, sua assistente criativa. Selecione um cliente na barra lateral para começarmos a planejar conteúdo.";
    setMessages([
      {
        id: 'welcome',
        sender: 'leia',
        text: welcomeText,
        timestamp: Date.now()
      }
    ]);
  }, [currentClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;

    const userMsg: Message = {
      id: Math.random().toString(36).substring(2, 9),
      sender: 'user',
      text,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    try {
      const history = messages.filter(message => message.id !== 'welcome').slice(-12).map(message => ({
        sender: message.sender,
        text: message.text
      }));
      const replyText = await api.chatWithLeia(currentClient?.id || null, text, history);
      const leiaMsg: Message = {
        id: Math.random().toString(36).substring(2, 9),
        sender: 'leia',
        text: replyText,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, leiaMsg]);
    } catch {
      setMessages(prev => [...prev, {
        id: Math.random().toString(36).substring(2, 9),
        sender: 'leia',
        text: 'Não consegui responder agora. Tente novamente em alguns segundos.',
        timestamp: Date.now()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const renderFormattedText = (txt: string) => {
    const parts = txt.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx} className="font-black text-primary">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  useEffect(() => {
    const saved = auth.currentUser?.ui_preferences?.companion;
    if (saved) setSettings(saved);
  }, []);

  const saveSettings = (newSettings: CompanionSettings) => {
    setSettings(newSettings);
    void api.updateUiPreferences({ companion: newSettings }).catch(() => {});
    setIsModalOpen(false);
  };

  const fetchTrends = async () => {
    try {
      const [googleRes, githubRes] = await Promise.all([
        fetch('https://google-trends-api-theta.vercel.app/data?cc=BR&t=24&p=true'),
        fetch('https://api.github.com/search/repositories?q=created:>2024-01-01&sort=stars&order=desc&per_page=2')
      ]);
      const gData = await googleRes.json();
      const ghData = await githubRes.json();
      setTrends([
        ...gData.slice(0, 2).map((t: any) => ({ term: `🔥 ${t.term}`, url: `https://www.google.com/search?q=${encodeURIComponent(t.term)}` })),
        ...ghData.items.map((repo: any) => ({ term: `🛠️ ${repo.name}`, url: repo.html_url }))
      ]);
    } catch (e) { console.error("Trends error", e); }
  };

  const fetchStrategicDates = async () => {
    try {
      const holidays = await api.getHolidays(new Date().getFullYear());
      const today = new Date();
      const upcoming = holidays
        .filter((h: any) => new Date(h.date) >= today)
        .slice(0, 2)
        .map((h: any) => ({ date: h.date, name: h.name, type: 'holiday' }));
      if (upcoming.length < 2) upcoming.push({ date: '2026-05-20', name: 'Dia do Designer', type: 'strategic' });
      setStrategicDates(upcoming as StrategicDate[]);
    } catch (e) {
      setStrategicDates([{ date: '2026-05-20', name: 'Dia do Designer', type: 'strategic' }, { date: '2026-05-25', name: 'Dia do Café', type: 'strategic' }]);
    }
  };

  const detectLocation = async () => {
    setLocationStatus('detecting');
    let ipLat = -23.5505, ipLon = -46.6333, ipCity = "São Paulo";
    try {
      const ipData = await api.geolocate();
      if (ipData.latitude) { 
        ipLat = ipData.latitude; 
        ipLon = ipData.longitude; 
        ipCity = ipData.cityName || "São Paulo"; 
        setLocationStatus('ip'); 
        updateWeather(ipLat, ipLon, ipCity); 
      }
    } catch (e) { }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        setLocationStatus('gps');
        const { latitude, longitude } = pos.coords;
        try {
          const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`);
          const geoData = await geoRes.json();
          const locationName = geoData.address.suburb || geoData.address.city || ipCity;
          updateWeather(latitude, longitude, locationName);
        } catch (e) { updateWeather(latitude, longitude, ipCity); }
      }, () => { if (locationStatus === 'detecting') setLocationStatus('error'); }, { enableHighAccuracy: true, timeout: 10000 });
    }
  };

  const updateWeather = async (lat: number, lon: number, cityName: string) => {
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=relative_humidity_2m,uv_index&daily=weathercode&timezone=auto`);
      const data = await res.json();
      const weatherCode = data.current_weather.weathercode;
      let condition = "Céu Limpo";
      if (weatherCode >= 95) condition = "Tempestade";
      else if (weatherCode >= 61) condition = "Chuvoso";
      else if (weatherCode >= 1) condition = "Parcialmente Nublado";

      setWeather({
        temp: Math.round(data.current_weather.temperature),
        city: cityName,
        condition,
        uv: data.hourly.uv_index[0] || 0,
        humidity: data.hourly.relative_humidity_2m[0] || 0,
        isStorm: weatherCode >= 95,
        windSpeed: data.current_weather.windspeed
      });
    } catch (e) { }
  };

  useEffect(() => {
    detectLocation();
    fetchTrends();
    fetchStrategicDates();
  }, []);

  const personalizedGreeting = useMemo(() => {
    const hour = new Date().getHours();
    let timeGreeting = "Bom dia";
    if (hour >= 12 && hour < 18) timeGreeting = "Boa tarde";
    else if (hour >= 18 || hour < 5) timeGreeting = "Boa noite";
    const userName = auth.currentUser?.displayName?.split(' ')[0] || 'Criativo';
    return `${timeGreeting}, ${userName}!`;
  }, [auth.currentUser?.displayName]);

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Personalized Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="text-xl font-display font-black tracking-tight leading-none text-foreground">
            {personalizedGreeting}
          </h2>
          <div className="flex items-center gap-2 text-[10px] font-bold opacity-40 uppercase tracking-widest mt-2">
            <Sparkles className="w-3 h-3 text-primary" />
            LeIA Companion • {weather?.city || "Detectando..."}
          </div>
        </div>
        
        <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-xl border border-white/5">
           {[
             { id: 'leia', icon: Sparkles },
             { id: 'weather', icon: Sun },
             { id: 'trends', icon: TrendingUp },
             { id: 'calendar', icon: Calendar }
           ].map(tab => (
             <button
               key={tab.id}
               onClick={() => setActiveWidget(tab.id as any)}
               className={cn(
                 "p-2 rounded-lg transition-all",
                 activeWidget === tab.id ? "bg-white dark:bg-zinc-800 text-primary shadow-sm" : "opacity-40 hover:opacity-100"
               )}
             >
               <tab.icon className="w-4 h-4" />
             </button>
           ))}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <AnimatePresence mode="wait">
          {activeWidget === 'leia' && (
            <motion.div
              key="leia"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex flex-col h-full gap-3"
            >
              {/* Message List */}
              <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 min-h-[140px] max-h-[180px] scrollbar-thin">
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex flex-col max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed",
                      msg.sender === 'leia'
                        ? "bg-black/5 dark:bg-white/5 border border-white/5 text-foreground self-start"
                        : "bg-primary text-white self-end text-right"
                    )}
                  >
                    <span className="whitespace-pre-wrap">{renderFormattedText(msg.text)}</span>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex items-center gap-1.5 opacity-40 text-[10px] font-bold uppercase tracking-wider px-2 self-start mt-1">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" />
                    <span>LeIA está pensando...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Suggestions Chips Row */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none select-none">
                {[
                  { label: "💡 Ideias", text: "Gerar ideias de posts criativos" },
                  { label: "✍️ Legenda", text: "Melhorar a legenda de um post" },
                  { label: "📅 Estratégia", text: "Quais as dicas de estratégia para o ciclo?" }
                ].map(chip => (
                  <button
                    type="button"
                    key={chip.label}
                    onClick={() => handleSendMessage(chip.text)}
                    className="px-3 py-1 rounded-full bg-black/5 dark:bg-white/5 border border-white/5 hover:bg-primary/10 hover:border-primary/20 transition-all text-[9px] font-bold whitespace-nowrap"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {/* Input Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage(inputValue);
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Pergunte à LeIA..."
                  className="flex-1 px-4 py-2 text-xs rounded-xl bg-black/5 dark:bg-white/5 border border-white/5 focus:outline-none focus:border-primary/30 text-foreground"
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim()}
                  className="p-2 rounded-xl bg-primary text-white hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </motion.div>
          )}

          {activeWidget === 'weather' && weather && (
            <motion.div
              key="weather"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex flex-col gap-6"
            >
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                  <ThermometerSun className="w-8 h-8 text-white" />
                </div>
                <div>
                   <div className="flex items-baseline gap-2">
                     <span className="text-4xl font-display font-black leading-none">{weather.temp}°</span>
                     <span className="text-sm font-bold opacity-40 uppercase">{weather.condition}</span>
                   </div>
                   <div className="flex items-center gap-2 text-[10px] font-bold uppercase opacity-60 mt-1">
                      <Wind className="w-3 h-3" /> {weather.windSpeed} km/h • <MapPin className="w-3 h-3" /> {weather.city}
                   </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                 <div className="p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center">
                    <span className="text-[8px] font-bold uppercase opacity-30 mb-1">UV Index</span>
                    <span className="text-sm font-black">{weather.uv}</span>
                 </div>
                 <div className="p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center">
                    <span className="text-[8px] font-bold uppercase opacity-30 mb-1">Umidade</span>
                    <span className="text-sm font-black">{weather.humidity}%</span>
                 </div>
              </div>
            </motion.div>
          )}

          {activeWidget === 'trends' && (
            <motion.div
              key="trends"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex flex-col gap-3"
            >
              {trends.map((trend, i) => (
                <a
                  key={i}
                  href={trend.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-white/5 hover:border-primary/30 transition-all flex items-center justify-between group"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[8px] font-black uppercase opacity-20 tracking-tighter">#{i + 1} Trending</span>
                    <span className="text-sm font-bold truncate max-w-[180px] group-hover:text-primary transition-colors">{trend.term}</span>
                  </div>
                  <ExternalLink className="w-3 h-3 opacity-20 group-hover:opacity-100 transition-opacity" />
                </a>
              ))}
            </motion.div>
          )}

          {activeWidget === 'calendar' && (
            <motion.div
              key="calendar"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex flex-col gap-3"
            >
              {strategicDates.map((date, i) => (
                <div key={i} className="p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-white/5 flex items-center gap-4">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", date.type === 'holiday' ? 'bg-orange-500/20 text-orange-500' : 'bg-purple-500/20 text-purple-500')}>
                    {date.type === 'holiday' ? <Calendar className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black uppercase opacity-20 tracking-tighter">{date.type === 'holiday' ? 'Feriado' : 'Estratégico'}</span>
                    <span className="text-xs font-bold">{format(new Date(date.date + 'T00:00:00'), 'dd MMM')} : {date.name}</span>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
         <div className="flex items-center gap-2 opacity-20 text-[9px] font-bold uppercase tracking-widest">
            <Clock className="w-3 h-3" /> Atualizado agora
         </div>
         <button 
           onClick={() => setIsModalOpen(true)}
           className="p-2 opacity-20 hover:opacity-100 transition-opacity"
         >
           <Settings className="w-3.5 h-3.5" />
         </button>
      </div>

      <CompanionSetupModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        settings={settings}
        setSettings={setSettings}
        onSave={saveSettings}
        onRefreshLocation={detectLocation}
      />
    </div>
  );
}
