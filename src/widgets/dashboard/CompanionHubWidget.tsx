import { useState, useEffect, useMemo } from "react";
import {
  Sun,
  Settings,
  Calendar,
  TrendingUp,
  Sparkles,
  Clock,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { auth } from "../../lib/auth";
import { api } from "../../lib/api";
import { CompanionSettings, ClientData } from "../../types";
import { CompanionSetupModal } from "../../modals/CompanionSetupModal";
import { IconButton } from "../../components/ui/IconButton/IconButton";
import { CompanionLeiaChat } from "./companion/CompanionLeiaChat";
import { CompanionWeatherCard } from "./companion/CompanionWeatherCard";
import { CompanionTrendsCard } from "./companion/CompanionTrendsCard";
import { CompanionCalendarCard } from "./companion/CompanionCalendarCard";
import styles from "./CompanionHubWidget.module.css";

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
  type: "holiday" | "strategic";
}

const DEFAULT_SETTINGS: CompanionSettings = {
  locationName: "",
  showWeather: true,
  showTrends: true,
  showCalendar: true,
  showHolidays: true,
  hasConfigured: false,
};

interface CompanionHubWidgetProps {
  currentClient?: ClientData | null;
}

interface Message {
  id: string;
  sender: "user" | "leia";
  text: string;
  timestamp: number;
}

export function CompanionHubWidget({ currentClient }: CompanionHubWidgetProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [strategicDates, setStrategicDates] = useState<StrategicDate[]>([]);
  const [settings, setSettings] = useState<CompanionSettings>(DEFAULT_SETTINGS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeWidget, setActiveWidget] = useState<"leia" | "weather" | "trends" | "calendar">("leia");

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    const welcomeText = currentClient
      ? `Olá! Sou a LeIA, sua assistente criativa. Como posso ajudar com as redes de **${currentClient.name}** hoje?`
      : "Olá! Sou a LeIA, sua assistente criativa. Selecione um cliente na barra lateral para começarmos a planejar conteúdo.";
    setMessages([
      {
        id: "welcome",
        sender: "leia",
        text: welcomeText,
        timestamp: Date.now(),
      },
    ]);
  }, [currentClient]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;

    const userMsg: Message = {
      id: Math.random().toString(36).substring(2, 9),
      sender: "user",
      text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsTyping(true);

    try {
      const history = messages
        .filter((message) => message.id !== "welcome")
        .slice(-12)
        .map((message) => ({
          sender: message.sender,
          text: message.text,
        }));
      const replyText = await api.chatWithLeia(currentClient?.id || null, text, history);
      const leiaMsg: Message = {
        id: Math.random().toString(36).substring(2, 9),
        sender: "leia",
        text: replyText,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, leiaMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          sender: "leia",
          text: "Não consegui responder agora. Tente novamente em alguns segundos.",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const renderFormattedText = (txt: string) => {
    const parts = txt.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={idx} className={styles.emphasis}>
            {part.slice(2, -2)}
          </strong>
        );
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
        fetch("https://google-trends-api-theta.vercel.app/data?cc=BR&t=24&p=true"),
        fetch("https://api.github.com/search/repositories?q=created:>2024-01-01&sort=stars&order=desc&per_page=2"),
      ]);
      const gData = await googleRes.json();
      const ghData = await githubRes.json();
      setTrends([
        ...gData.slice(0, 2).map((t: any) => ({ term: `🔥 ${t.term}`, url: `https://www.google.com/search?q=${encodeURIComponent(t.term)}` })),
        ...ghData.items.map((repo: any) => ({ term: `🛠️ ${repo.name}`, url: repo.html_url })),
      ]);
    } catch (e) {
      console.error("Trends error", e);
    }
  };

  const fetchStrategicDates = async () => {
    try {
      const holidays = await api.getHolidays(new Date().getFullYear());
      const today = new Date();
      const upcoming = holidays
        .filter((h: any) => new Date(h.date) >= today)
        .slice(0, 2)
        .map((h: any) => ({ date: h.date, name: h.name, type: "holiday" }));
      if (upcoming.length < 2) upcoming.push({ date: "2026-05-20", name: "Dia do Designer", type: "strategic" });
      setStrategicDates(upcoming as StrategicDate[]);
    } catch (e) {
      setStrategicDates([
        { date: "2026-05-20", name: "Dia do Designer", type: "strategic" },
        { date: "2026-05-25", name: "Dia do Café", type: "strategic" },
      ]);
    }
  };

  const detectLocation = async () => {
    let ipLat = -23.5505;
    let ipLon = -46.6333;
    let ipCity = "São Paulo";
    try {
      const ipData = await api.geolocate();
      if (ipData.latitude) {
        ipLat = ipData.latitude;
        ipLon = ipData.longitude;
        ipCity = ipData.cityName || "São Paulo";
        updateWeather(ipLat, ipLon, ipCity);
      }
    } catch (e) {}

  };

  const updateWeather = async (lat: number, lon: number, cityName: string) => {
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=relative_humidity_2m,uv_index&daily=weathercode&timezone=auto`,
      );
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
        windSpeed: data.current_weather.windspeed,
      });
    } catch (e) {}
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
    const userName = auth.currentUser?.displayName?.split(" ")[0] || "Criativo";
    return `${timeGreeting}, ${userName}!`;
  }, [auth.currentUser?.displayName]);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.heading}>
          <h2>
            {personalizedGreeting}
          </h2>
          <div className={styles.subtitle}>
            <Sparkles />
            LeIA Companion • {weather?.city || "Detectando..."}
          </div>
        </div>

        <div className={styles.tabs}>
          {[
            { id: "leia", icon: Sparkles, label: "LeIA" },
            { id: "weather", icon: Sun, label: "Clima" },
            { id: "trends", icon: TrendingUp, label: "Tendências" },
            { id: "calendar", icon: Calendar, label: "Calendário" },
          ].map((tab) => (
            <IconButton
              key={tab.id}
              label={tab.label}
              aria-pressed={activeWidget === tab.id}
              onClick={() => setActiveWidget(tab.id as any)}
              variant={activeWidget === tab.id ? "primary" : "ghost"}
              size="small"
            >
              <tab.icon />
            </IconButton>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <AnimatePresence mode="wait">
          {activeWidget === "leia" && (
            <motion.div key="leia" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="h-full">
              <CompanionLeiaChat
                messages={messages}
                inputValue={inputValue}
                setInputValue={setInputValue}
                isTyping={isTyping}
                handleSendMessage={handleSendMessage}
                renderFormattedText={renderFormattedText}
              />
            </motion.div>
          )}

          {activeWidget === "weather" && weather && (
            <motion.div key="weather" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              <CompanionWeatherCard weather={weather} />
            </motion.div>
          )}

          {activeWidget === "trends" && (
            <motion.div key="trends" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              <CompanionTrendsCard trends={trends} />
            </motion.div>
          )}

          {activeWidget === "calendar" && (
            <motion.div key="calendar" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              <CompanionCalendarCard strategicDates={strategicDates} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className={styles.footer}>
        <div className={styles.updated}>
          <Clock /> Atualizado agora
        </div>
        <IconButton
          label="Configurar LeIA Companion"
          onClick={() => setIsModalOpen(true)}
          size="small"
        >
          <Settings />
        </IconButton>
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
