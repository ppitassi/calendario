import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  ArrowLeft,
  LayoutTemplate,
  Settings2, Settings,
  CalendarDays,
  Target,
  Compass,
  PenTool,
  Hash,
  MessageSquare,
  X,
  Grid,
  List,
  LogOut,
  Eye,
  Lock,
  Sun,
  Moon,
  Users,
  Plus,
  Trash2,
  Shield,
  Clock,
  CheckCheck,
  Send,
  Sparkles
} from 'lucide-react';
import { cn } from '../lib/utils';
import { format, getDaysInMonth, startOfMonth, getDay, addMonths, subMonths, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { auth, signOut, useAuthState } from '../lib/auth';
import { api } from '../lib/api';
import { ROLE_PERMISSIONS, ROLE_LABELS, AppViewState, ClientData, AppConfig, PostData, PostType, UserRole } from '../types';
import { Lightbox } from '../components/Lightbox';
import { BackgroundEffects } from "../components/BackgroundEffects";
import { ConfirmModal } from "../modals/ConfirmModal";
import { EditableText } from "../components/EditableText";
import { LayoutEditToggle } from "../components/LayoutEditToggle";
import { ThemeToggle } from "../components/ThemeToggle";
import { DEFAULT_POST, DAYS_OF_WEEK, DAY_NAMES, POST_TYPES } from "../lib/constants";
import { HomeScreen } from "../screens/HomeScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { ViewerScreen } from "../screens/ViewerScreen";
import { UserManagementScreen } from "../screens/UserManagementScreen";
import { SmartMediaUploader } from "../components/SmartMediaUploader";
import { AgencySetupScreen } from "../screens/AgencySetupScreen";
import { DataAnalysisScreen } from "../screens/DataAnalysisScreen";
import { ClientSetupScreen } from "../screens/ClientSetupScreen";
import { UserSetupScreen } from "../screens/UserSetupScreen";
import { ClientStrategyScreen } from "./ClientStrategyScreen";
import { MainLayout } from "../components/MainLayout";
import { ClientManagementScreen } from "./ClientManagementScreen";
import { LeiaChatScreen } from "./LeiaChatScreen";
import { AnalyticsGrowthScreen } from "./AnalyticsGrowthScreen";
import { AnalyticsVisibilityScreen } from "./AnalyticsVisibilityScreen";
import { AnalyticsPrimeTimeScreen } from "./AnalyticsPrimeTimeScreen";
import { AnalyticsContentScreen } from "./AnalyticsContentScreen";




const VIEW_STATE_KEY = 'content_planner_view_state';

function loadPersistedViewState(): any {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem(VIEW_STATE_KEY) || 'null');
  } catch {
    return null;
  }
}

function monthToDate(month?: string) {
  return /^\d{4}-\d{2}$/.test(month || '') ? new Date(`${month}-01T12:00:00`) : new Date();
}

const DEFAULT_PLANNER_CONFIG: AppConfig = {
  activeDays: [1, 3, 5],
  defaultTypes: { 1: 'post', 3: 'carousel', 5: 'reel' }
};

const PLANNER_DAY_LABELS = ['Domingos', 'Segundas', 'Ter\u00e7as', 'Quartas', 'Quintas', 'Sextas', 'S\u00e1bados'];

function parsePostingFrequency(frequency?: string): number[] {
  const normalized = (frequency || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const matches: Array<[number, RegExp]> = [
    [0, /\b(dom|domingo|domingos)\b/],
    [1, /\b(seg|segunda|segundas)\b/],
    [2, /\b(ter|terca|tercas)\b/],
    [3, /\b(qua|quarta|quartas)\b/],
    [4, /\b(qui|quinta|quintas)\b/],
    [5, /\b(sex|sexta|sextas)\b/],
    [6, /\b(sab|sabado|sabados)\b/]
  ];
  return matches.filter(([, re]) => re.test(normalized)).map(([day]) => day);
}

function daysToFrequencyText(days: number[]): string {
  const labels = days.slice().sort((a, b) => a - b).map(day => PLANNER_DAY_LABELS[day]).filter(Boolean);
  if (labels.length <= 1) return labels[0] || '';
  return `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1]}`;
}
export function PlannerScreen() {
  const initialViewState = useMemo(() => loadPersistedViewState(), []);
  const persistedClientId = initialViewState?.currentClientId || initialViewState?.currentClient?.id || null;
  const [user, userLoading] = useAuthState(auth);
  const [appState, setAppState] = useState<AppViewState>(() => initialViewState?.appState || (auth.currentUser ? 'home' : 'login'));
  const [currentClient, setCurrentClient] = useState<ClientData | null>(null);
  const [isRestoringClient, setIsRestoringClient] = useState(Boolean(persistedClientId));
  const [userRole, setUserRole] = useState<UserRole>('designer');

  const [currentDate, setCurrentDate] = useState(() => monthToDate(initialViewState?.currentMonth));
  const [config, setConfig] = useState<AppConfig>(() => initialViewState?.plannerConfig || DEFAULT_PLANNER_CONFIG);
  const [plannerFrequency, setPlannerFrequency] = useState<string>(() => initialViewState?.plannerFrequency || '');
  const initializedPlannerClientId = React.useRef<string | null>(null);

  const [posts, setPosts] = useState<Record<string, PostData>>({});
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(() => initialViewState?.selectedDateStr || null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [customRoles, setCustomRoles] = useState<any[]>([]);

  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isGeneratingPost, setIsGeneratingPost] = useState(false);
  const [isGeneratingMonth, setIsGeneratingMonth] = useState(false);

  useEffect(() => {
    if (!initialViewState?.currentClient) return;
    const { currentClient: _legacyClient, userRole: _legacyRole, ...safeState } = initialViewState;
    localStorage.setItem(VIEW_STATE_KEY, JSON.stringify({ ...safeState, currentClientId: persistedClientId }));
  }, [initialViewState, persistedClientId]);

  useEffect(() => {
    if (!user || !persistedClientId || currentClient) {
      if (user) setIsRestoringClient(false);
      return;
    }

    let cancelled = false;
    api.getClient(persistedClientId)
      .then(client => {
        if (!cancelled && client) setCurrentClient(client);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setIsRestoringClient(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, persistedClientId, currentClient]);

  useEffect(() => {
    if (!currentClient?.id || initializedPlannerClientId.current === currentClient.id) return;
    initializedPlannerClientId.current = currentClient.id;

    if (persistedClientId === currentClient.id && initialViewState?.plannerConfig) {
      setConfig(initialViewState.plannerConfig);
      setPlannerFrequency(initialViewState?.plannerFrequency || currentClient.postFrequency || '');
      return;
    }

    const frequency = currentClient.postFrequency || '';
    const parsedDays = parsePostingFrequency(frequency);
    setPlannerFrequency(frequency);
    setConfig(prev => ({
      ...prev,
      activeDays: parsedDays.length ? parsedDays : DEFAULT_PLANNER_CONFIG.activeDays,
      defaultTypes: { ...DEFAULT_PLANNER_CONFIG.defaultTypes, ...prev.defaultTypes }
    }));
  }, [currentClient?.id, initialViewState, persistedClientId]);

  useEffect(() => {
    if (!currentClient?.id || appState !== 'editor') return;
    api.getClient(currentClient.id)
      .then(freshClient => {
        if (!freshClient) return;
        const shouldApplyClientDefault = !plannerFrequency || plannerFrequency === (currentClient.postFrequency || '');
        setCurrentClient(freshClient);
        if (shouldApplyClientDefault) {
          const frequency = freshClient.postFrequency || '';
          const parsedDays = parsePostingFrequency(frequency);
          setPlannerFrequency(frequency);
          setConfig(prev => ({
            ...prev,
            activeDays: parsedDays.length ? parsedDays : prev.activeDays
          }));
        }
      })
      .catch(console.error);
  }, [appState, currentClient?.id]);

  useEffect(() => {
    if (selectedDateStr && posts[selectedDateStr]?.id) {
      api.getPostComments(Number(posts[selectedDateStr].id))
        .then(setComments)
        .catch(console.error);
    } else {
      setComments([]);
    }
  }, [selectedDateStr, posts, selectedDateStr && posts[selectedDateStr] ? posts[selectedDateStr].id : null]);

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedDateStr) return;
    const post = posts[selectedDateStr];
    if (!post?.id) return;
    try {
      await api.addPostComment(Number(post.id), newComment);
      const updated = await api.getPostComments(Number(post.id));
      setComments(updated);
      setNewComment('');
    } catch (err) {
      console.error('Error adding comment:', err);
    }
  };

  useEffect(() => {
    if (user) {
      api.getCustomRoles().then(setCustomRoles).catch(console.error);
    }
  }, [user, appState]);

  // Helper de permissões dinâmicas
  const permissions = useMemo(() => {
    const defaultPerms = ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS['designer'];
    const dbRole = customRoles.find((r: any) => r.id === userRole);
    if (dbRole && dbRole.permissions) {
      try {
        const rolePermissions = typeof dbRole.permissions === 'string' ? JSON.parse(dbRole.permissions) : dbRole.permissions;
        return { ...defaultPerms, ...rolePermissions };
      } catch {
        return defaultPerms;
      }
    }
    return defaultPerms;
  }, [userRole, customRoles]);

  // Load posts for selected client
  useEffect(() => {
    if (!currentClient) return;
    api.getPosts(currentClient.id).then(setPosts).catch(console.error);
  }, [currentClient, currentDate]);

  const updateCurrentPost = async (updates: Partial<PostData>) => {
    if (selectedDateStr && currentClient) {
      const basePost = posts[selectedDateStr] || { ...DEFAULT_POST, date: selectedDateStr };
      const updatedPost = { ...basePost, ...updates, date: selectedDateStr, updatedAt: Date.now() };
      setPosts(p => ({ ...p, [selectedDateStr]: updatedPost }));
      try {
        await api.savePost(currentClient.id, selectedDateStr, updatedPost);
      } catch (e) { console.error('Error updating post:', e); }
    }
  };

  const mergeGeneratedFields = (post: PostData, generated: any): PostData => {
    const hasMissingGeneratedField = !(post.head || post.artHeadline) || !post.objective;
    return {
      ...post,
      head: post.head || post.artHeadline || generated?.head || '',
      artHeadline: post.artHeadline || post.head || generated?.head || '',
      objective: post.objective || generated?.objective || '',
      funnelStage: hasMissingGeneratedField ? (generated?.funnelStage || post.funnelStage || 'topo') : (post.funnelStage || 'topo')
    };
  };

  const generateCurrentPostFields = async () => {
    if (!currentClient || !selectedDateStr) return;
    setIsGeneratingPost(true);
    try {
      const base = posts[selectedDateStr] || { ...DEFAULT_POST, date: selectedDateStr };
      const generated = await api.generatePostFields(currentClient.id, base);
      const updated = {
        ...base,
        head: generated?.head || base.head || base.artHeadline || '',
        artHeadline: generated?.head || base.artHeadline || base.head || '',
        objective: generated?.objective || base.objective || '',
        funnelStage: generated?.funnelStage || base.funnelStage || 'topo'
      };
      setPosts(previous => ({ ...previous, [selectedDateStr]: updated }));
      await api.savePost(currentClient.id, selectedDateStr, updated);
    } catch (error) { console.error('Error generating post fields:', error); }
    finally { setIsGeneratingPost(false); }
  };

  const generateMonthFields = async () => {
    if (!currentClient) return;
    const month = format(currentDate, 'yyyy-MM');
    const entries = Object.entries(posts).filter(([date]) => date.startsWith(month));
    if (!entries.length) return;
    setIsGeneratingMonth(true);
    try {
      const generated = await api.generateMonthFields(currentClient.id, entries.map(([date, post]) => ({ ...post, date })));
      const updatedEntries = entries.map(([date, post], index) => [date, mergeGeneratedFields(post, generated[index])] as const);
      setPosts(previous => ({ ...previous, ...Object.fromEntries(updatedEntries) }));
      await Promise.all(updatedEntries.map(([date, post]) => api.savePost(currentClient.id, date, post)));
    } catch (error) { console.error('Error generating month fields:', error); }
    finally { setIsGeneratingMonth(false); }
  };

  useEffect(() => {
    if (!user) return;
    if (user.role) setUserRole(user.role);
    if (appState === 'login') setAppState(initialViewState?.appState || 'home');
  }, [user, appState, initialViewState]);

  useEffect(() => {
    if (!user || appState === 'login') return;
    localStorage.setItem(VIEW_STATE_KEY, JSON.stringify({
      appState,
      currentClientId: currentClient?.id || null,
      currentMonth: format(currentDate, 'yyyy-MM'),
      selectedDateStr,
      plannerFrequency,
      plannerConfig: config
    }));
  }, [user, appState, currentClient?.id, currentDate, selectedDateStr, plannerFrequency, config]);

  useEffect(() => {
    if (!user || appState !== 'admin_roles') return;
    const sessionPermissions = ROLE_PERMISSIONS[user.role as UserRole] || ROLE_PERMISSIONS.designer;
    if (!sessionPermissions.canManageRoles) setAppState('home');
  }, [user, appState]);

  useEffect(() => {
    const needsClient = ['editor', 'viewer', 'data_analysis', 'client_setup', 'analytics_growth', 'analytics_visibility', 'analytics_primetime', 'analytics_content'].includes(appState);
    if (user && !isRestoringClient && needsClient && !currentClient) setAppState('home');
  }, [user, appState, currentClient, isRestoringClient]);

  const currentPost = selectedDateStr ? posts[selectedDateStr] || { ...DEFAULT_POST, date: selectedDateStr } : null;
  const plannerFrequencyDays = useMemo(() => parsePostingFrequency(plannerFrequency), [plannerFrequency]);
  const hasUnrecognizedFrequency = plannerFrequency.trim().length > 0 && plannerFrequencyDays.length === 0;

  const handleNavigate = (screen: string) => {
    if (screen === 'home') {
      setCurrentClient(null);
      setAppState('home');
    } else if (screen === 'planner') {
      setAppState('editor');
    } else {
      setAppState(screen as AppViewState);
    }
  };

  if (userLoading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  if (!user) return <LoginScreen onLogin={() => setAppState(loadPersistedViewState()?.appState || 'home')} />;
  if (isRestoringClient) return <div className="min-h-screen flex items-center justify-center">Restaurando cliente...</div>;
  if (appState === 'login') return <LoginScreen onLogin={() => setAppState(loadPersistedViewState()?.appState || 'home')} />;
  
  if (appState === 'home') return <HomeScreen
    onOpenAdmin={() => setAppState('admin_roles')}
    onSelectClient={(client, role, destination) => {
      setCurrentClient(client);
      setUserRole(role as UserRole);
      setAppState(destination as AppViewState);
    }}
    onNavigate={handleNavigate}
    currentClient={currentClient}
  />;

  if (appState === 'admin_roles') return <UserManagementScreen
    onExit={() => setAppState('home')}
    currentClient={currentClient}
    onNavigate={handleNavigate}
  />;

  if (appState === 'viewer' && currentClient) {
    return <ViewerScreen
      posts={posts}
      client={currentClient}
      userRole={user?.role || 'designer'}
      username={user?.displayName || 'Leonardo'}
      user={user}
      currentDate={currentDate}
      onExit={() => setAppState('editor')}
      onPrevMonth={() => setCurrentDate(addMonths(currentDate, -1))}
      onNextMonth={() => setCurrentDate(addMonths(currentDate, 1))}
      currentClient={currentClient}
      onNavigate={handleNavigate}
    />;
  }

  if (appState === 'data_analysis' && currentClient) {
    return <DataAnalysisScreen
      client={currentClient}
      userRole={userRole}
      onExit={() => setAppState('home')}
      currentClient={currentClient}
      onNavigate={handleNavigate}
    />;
  }

  if (appState === 'client_setup' && currentClient) {
    return <ClientSetupScreen
      clientId={currentClient.id}
      onExit={() => setAppState('home')}
      currentClient={currentClient}
      onNavigate={handleNavigate}
    />;
  }

  if (appState === 'user_setup') {
    return <UserSetupScreen
      onExit={() => setAppState('home')}
      currentClient={currentClient}
      onNavigate={handleNavigate}
    />;
  }

  if (appState === 'client_strategy') {
    return <ClientStrategyScreen
      currentClient={currentClient}
      onSelectClient={(client, role, destination) => {
        setCurrentClient(client);
        if (role) setUserRole(role as UserRole);
        if (destination) setAppState(destination as AppViewState);
      }}
      onNavigate={handleNavigate}
    />;
  }

  if (appState === 'client_management') {
    return <ClientManagementScreen
      onSelectClient={(client, role, destination) => {
        setCurrentClient(client);
        setUserRole(role as UserRole);
        setAppState(destination as AppViewState);
      }}
      currentClient={currentClient}
      onNavigate={handleNavigate}
    />;
  }

  if (appState === 'leia_chat') {
    return <LeiaChatScreen
      currentClient={currentClient}
      onNavigate={handleNavigate}
    />;
  }

  if (appState === 'analytics_growth' && currentClient) {
    return <AnalyticsGrowthScreen
      client={currentClient}
      onNavigate={handleNavigate}
    />;
  }

  if (appState === 'analytics_visibility' && currentClient) {
    return <AnalyticsVisibilityScreen
      client={currentClient}
      onNavigate={handleNavigate}
    />;
  }

  if (appState === 'analytics_primetime' && currentClient) {
    return <AnalyticsPrimeTimeScreen
      client={currentClient}
      onNavigate={handleNavigate}
    />;
  }

  if (appState === 'analytics_content' && currentClient) {
    return <AnalyticsContentScreen
      client={currentClient}
      onNavigate={handleNavigate}
    />;
  }

  const renderClientStrategyHome = () => {
    return (
      <div className="space-y-8 max-w-3xl text-left">
        <div className="flex items-center gap-6 mb-6">
          <div className="w-16 h-16 rounded-3xl bg-primary/10 text-primary flex items-center justify-center font-bold text-2xl border border-primary/20">
            {currentClient?.name?.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-4xl font-display font-black leading-none">{currentClient?.name}</h1>
            <p className="text-sm opacity-40 mt-1 uppercase font-bold tracking-widest">Painel Editorial & Estratégico</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="p-6 rounded-3xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-2">
              <span className="text-[10px] font-black uppercase opacity-40 tracking-wider">Segmento</span>
              <p className="text-sm font-semibold">{currentClient?.segment || <span className="opacity-30 italic">Não informado</span>}</p>
           </div>
           <div className="p-6 rounded-3xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-2">
              <span className="text-[10px] font-black uppercase opacity-40 tracking-wider">Frequência de Postagem</span>
              <p className="text-sm font-semibold">{currentClient?.postFrequency || <span className="opacity-30 italic">Não informado</span>}</p>
           </div>
           <div className="p-6 rounded-3xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-2 md:col-span-2">
              <span className="text-[10px] font-black uppercase opacity-40 tracking-wider">Tom de Voz</span>
              <p className="text-sm font-semibold whitespace-pre-wrap">{currentClient?.voiceTone || <span className="opacity-30 italic">Não informado</span>}</p>
           </div>
           <div className="p-6 rounded-3xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-2 md:col-span-2">
              <span className="text-[10px] font-black uppercase opacity-40 tracking-wider">Público-Alvo</span>
              <p className="text-sm font-semibold whitespace-pre-wrap">{currentClient?.targetAudience || <span className="opacity-30 italic">Não informado</span>}</p>
           </div>
           <div className="p-6 rounded-3xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-2">
              <span className="text-[10px] font-black uppercase opacity-40 tracking-wider">Pilares de Conteúdo</span>
              <p className="text-sm font-semibold whitespace-pre-wrap">{currentClient?.contentColumns || <span className="opacity-30 italic">Não informado</span>}</p>
           </div>
           <div className="p-6 rounded-3xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-2">
              <span className="text-[10px] font-black uppercase opacity-40 tracking-wider">Redes e Canais</span>
              <p className="text-sm font-semibold whitespace-pre-wrap">{currentClient?.networks || <span className="opacity-30 italic">Não informado</span>}</p>
           </div>
           <div className="p-6 rounded-3xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-2 md:col-span-2">
              <span className="text-[10px] font-black uppercase opacity-40 tracking-wider">Diretrizes da Marca</span>
              <p className="text-sm font-semibold whitespace-pre-wrap">{currentClient?.brandNotes || <span className="opacity-30 italic">Não informado</span>}</p>
           </div>
           <div className="p-6 rounded-3xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-2 md:col-span-2">
              <span className="text-[10px] font-black uppercase opacity-40 tracking-wider">Diretrizes Visuais</span>
              <p className="text-sm font-semibold whitespace-pre-wrap">{currentClient?.visualInfo || <span className="opacity-30 italic">Não informado</span>}</p>
           </div>
        </div>
      </div>
    );
  };

  const renderRightPanel = () => {
    if (!currentPost) return null;
    
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <span className="text-[10px] font-black uppercase opacity-40 tracking-wider">Status da Publicação</span>
          <select
            value={currentPost.status || 'planejado'}
            onChange={e => updateCurrentPost({ status: e.target.value as any })}
            className="w-full bg-black/5 dark:bg-white/5 border border-white/5 rounded-2xl px-4 py-3 font-semibold text-sm focus:ring-2 focus:ring-primary/40 outline-none transition-all cursor-pointer text-black dark:text-white bg-white dark:bg-zinc-950"
          >
            <option value="planejado">Planejado</option>
            <option value="em produção">Em Produção</option>
            <option value="aguardando aprovação">Aguardando Aprovação</option>
            <option value="aprovado">Aprovado</option>
            <option value="ajuste solicitado">Ajuste Solicitado</option>
          </select>
        </div>

        {currentPost.funnelStage && (
          <div className="px-4 py-3 rounded-2xl bg-primary/10 text-primary border border-primary/20 text-xs font-black uppercase flex justify-between items-center">
            <span>Etapa do Funil</span>
            <span className="opacity-95">{currentPost.funnelStage === 'topo' ? 'Topo' : currentPost.funnelStage === 'meio' ? 'Meio' : 'Fundo'}</span>
          </div>
        )}

        <div className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-white/5">
          <span className="text-[10px] font-black uppercase opacity-40 tracking-wider block mb-3">Prévia do Card (Feed)</span>
          <div className="rounded-xl overflow-hidden bg-white dark:bg-zinc-900 border border-black/5 shadow-md flex flex-col text-left">
            <div className="p-3 flex items-center gap-2 border-b border-black/5 bg-white dark:bg-zinc-900">
              <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                {currentClient?.name?.substring(0, 2).toUpperCase()}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-black dark:text-white">{currentClient?.name}</span>
                <span className="text-[9px] opacity-40 text-black dark:text-white">Patrocinado • Instagram</span>
              </div>
            </div>
            <div className="aspect-square bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden relative">
              {(() => {
                const imgs = typeof currentPost.feedImages === 'string' 
                  ? JSON.parse(currentPost.feedImages || '[]') 
                  : (currentPost.feedImages || []);
                if (imgs.length > 0) {
                  return <img src={imgs[0]} className="w-full h-full object-cover" />;
                }
                return <span className="text-xs opacity-35 font-medium">Nenhuma mídia enviada</span>;
              })()}
            </div>
            <div className="p-3 space-y-1.5 text-black dark:text-white bg-white dark:bg-zinc-900">
              <p className="text-xs font-bold line-clamp-1">{currentPost.head || currentPost.title}</p>
              <p className="text-[11px] opacity-75 line-clamp-3 leading-relaxed whitespace-pre-wrap">{currentPost.subtitle || currentPost.caption}</p>
              {currentPost.cta && <p className="text-[10px] text-primary font-black uppercase tracking-wider">{currentPost.cta}</p>}
              {currentPost.hashtags && <p className="text-[10px] text-blue-500 font-mono">{currentPost.hashtags}</p>}
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-black/5 dark:border-white/5">
          <span className="text-[10px] font-black uppercase opacity-40 tracking-wider flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> Comentários ({comments.length})</span>
          <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1 scrollbar-thin">
            {comments.length === 0 ? (
              <p className="text-xs italic opacity-35">Nenhum comentário.</p>
            ) : (
              comments.map((c, i) => (
                <div key={i} className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 text-xs text-left">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-[10px] text-primary">{c.authorName} ({c.authorRole})</span>
                    <span className="text-[8px] opacity-40 font-mono">{format(new Date(c.createdAt), 'dd/MM HH:mm')}</span>
                  </div>
                  <p className="opacity-80 leading-relaxed">{c.content}</p>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Adicionar nota..."
              className="flex-1 bg-black/5 dark:bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-primary outline-none"
              onKeyDown={e => { if (e.key === 'Enter') handleAddComment(); }}
            />
            <button onClick={handleAddComment} className="p-2 bg-primary text-white rounded-xl hover:scale-105 active:scale-95 transition-all"><Send className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <MainLayout
      activeScreen="planner"
      onNavigate={handleNavigate}
      currentClient={currentClient}
    >
      <div className="flex-1 flex overflow-hidden h-[calc(100vh-80px)] w-full">
        {/* COLUNA ESQUERDA: NAVEGAÇÃO E CALENDÁRIO COMPACTO */}
        {!isFocusMode && !isLeftCollapsed && (
          <aside className="w-[300px] shrink-0 border-r border-black/5 dark:border-white/5 p-6 flex flex-col gap-6 overflow-y-auto no-scrollbar bg-slate-50/50 dark:bg-zinc-900/50">
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-4">Navegação Temporal</h3>
              
              {/* Mini Calendário Mensal */}
              <div className="space-y-4 bg-white dark:bg-zinc-950 p-4 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm">
                <div className="flex justify-between items-center">
                  <button 
                    onClick={() => setCurrentDate(subMonths(currentDate, 1))} 
                    className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-[10px] font-black uppercase tracking-wider text-center flex-1">
                    {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
                  </span>
                  <button 
                    onClick={() => setCurrentDate(addMonths(currentDate, 1))} 
                    className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="grid grid-cols-7 gap-1 text-center">
                  {DAY_NAMES.map(name => (
                    <div key={name} className="text-[8px] font-black uppercase opacity-35 py-1">
                      {name[0]}
                    </div>
                  ))}
                  {Array.from({ length: getDay(startOfMonth(currentDate)) }).fill(null).map((_, i) => (
                    <div key={`empty-${i}`} className="w-7 h-7" />
                  ))}
                  {Array.from({ length: getDaysInMonth(currentDate) }).map((_, i) => {
                    const day = i + 1;
                    const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                    const dateStr = format(d, 'yyyy-MM-dd');
                    const post = posts[dateStr];
                    const isSelected = selectedDateStr === dateStr;
                    
                    return (
                      <button
                        key={day}
                        onClick={() => setSelectedDateStr(dateStr)}
                        className={cn(
                          "w-7 h-7 rounded-lg text-[10px] font-bold flex items-center justify-center transition-all relative",
                          isSelected 
                            ? "bg-primary text-white shadow-md shadow-primary/20 scale-105" 
                            : post 
                              ? "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 font-black" 
                              : "hover:bg-black/5 dark:hover:bg-white/5 opacity-70 hover:opacity-100"
                        )}
                      >
                        {day}
                        {post && !isSelected && (
                          <span className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Lista Compacta de Posts */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[9px] font-black uppercase opacity-45 tracking-widest">Postagens Agendadas</span>
                <span className="text-[9px] font-bold px-2 py-0.5 bg-black/5 dark:bg-white/5 rounded-full opacity-60">
                  {Object.keys(posts).filter(k => k.startsWith(format(currentDate, 'yyyy-MM'))).length} posts
                </span>
              </div>
              <div className="space-y-1.5 overflow-y-auto no-scrollbar flex-1 pr-1">
                {Object.keys(posts)
                  .filter(dateStr => {
                    const d = new Date(dateStr + 'T00:00:00');
                    return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();
                  })
                  .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
                  .map(dateStr => {
                    const post = posts[dateStr];
                    const isSelected = selectedDateStr === dateStr;
                    const d = new Date(dateStr + 'T12:00:00');
                    return (
                      <button
                        key={dateStr}
                        onClick={() => setSelectedDateStr(dateStr)}
                        className={cn(
                          "w-full text-left px-3.5 py-3 rounded-2xl text-xs font-semibold flex items-center justify-between transition-all border",
                          isSelected 
                            ? "bg-primary/5 border-primary/20 text-primary shadow-sm" 
                            : "bg-white/40 dark:bg-zinc-950/20 border-transparent hover:bg-white dark:hover:bg-zinc-950 hover:border-black/5 dark:hover:border-white/5"
                        )}
                      >
                        <div className="flex flex-col truncate pr-2 gap-0.5">
                          <span className="font-bold truncate text-foreground/90">
                            {post.title || `Publicação de ${format(d, 'dd/MM')}`}
                          </span>
                          <span className="text-[9px] opacity-40 uppercase tracking-widest font-bold">
                            {post.type}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold opacity-50 shrink-0 font-mono">
                          {format(d, 'dd/MM')}
                        </span>
                      </button>
                    );
                  })}
                {Object.keys(posts).filter(k => k.startsWith(format(currentDate, 'yyyy-MM'))).length === 0 && (
                  <p className="text-xs italic opacity-35 text-center py-6">Nenhuma publicação agendada neste mês.</p>
                )}
              </div>
            </div>

            {/* Gerador Automático de Posts (CanConfig) */}
            {permissions.canConfigClients && (
              <div className="border-t border-black/5 dark:border-white/5 pt-4 space-y-4">
                <span className="text-[9px] font-black uppercase opacity-45 tracking-widest block">Configurar Grade Semanal</span>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase opacity-35 tracking-widest block">Frequ&ecirc;ncia da grade</label>
                  <input
                    type="text"
                    value={plannerFrequency}
                    onChange={e => {
                      const value = e.target.value;
                      setPlannerFrequency(value);
                      const parsedDays = parsePostingFrequency(value);
                      if (parsedDays.length) setConfig(prev => ({ ...prev, activeDays: parsedDays }));
                    }}
                    placeholder={`Ex: Ter\u00e7as e Quintas`}
                    className="w-full bg-black/5 dark:bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-1 focus:ring-primary outline-none"
                  />
                  {hasUnrecognizedFrequency && (
                    <p className="text-[10px] text-amber-500 leading-snug">Texto livre n&atilde;o identificado. Ajuste os dias abaixo antes de gerar.</p>
                  )}
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {DAY_NAMES.map((name, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        const newDays = config.activeDays.includes(idx)
                          ? config.activeDays.filter(d => d !== idx)
                          : [...config.activeDays, idx].sort();
                        setConfig({ ...config, activeDays: newDays });
                        setPlannerFrequency(daysToFrequencyText(newDays));
                      }}
                      className={cn(
                        "w-8 h-8 rounded-xl text-[9px] font-bold uppercase transition-all",
                        config.activeDays.includes(idx)
                          ? "bg-primary text-white shadow-sm"
                          : "bg-black/5 dark:bg-white/5 opacity-40 hover:opacity-75"
                      )}
                    >
                      {name[0]}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      if (!currentClient) return;
                      const daysInMonth = getDaysInMonth(currentDate);
                      let created = 0;
                      for (let day = 1; day <= daysInMonth; day++) {
                        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                        const dayOfWeek = getDay(date);
                        if (config.activeDays.includes(dayOfWeek)) {
                          const dateStr = format(date, 'yyyy-MM-dd');
                          if (!posts[dateStr]) {
                            const newPost: PostData = { ...DEFAULT_POST, type: config.defaultTypes[dayOfWeek] || 'post', date: dateStr };
                            await api.savePost(currentClient.id, dateStr, newPost);
                            setPosts(p => ({ ...p, [dateStr]: newPost }));
                            created++;
                          }
                        }
                      }
                      if (created > 0) {
                        const refreshed = await api.getPosts(currentClient.id);
                        setPosts(refreshed);
                      }
                    }}
                    className="flex-1 py-2.5 bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                  >
                    Gerar Grade
                  </button>
                  <button
                    onClick={() => setIsConfirmDeleteOpen(true)}
                    className="px-3 py-2.5 bg-rose-500/10 text-rose-500 border border-rose-500/25 hover:bg-rose-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                  >
                    Limpar
                  </button>
                </div>
              </div>
            )}
          </aside>
        )}

        {/* COLUNA CENTRAL: EDITOR EM BLOCO ESTILO NOTION */}
        <section className="flex-1 flex flex-col bg-white dark:bg-zinc-950 overflow-y-auto no-scrollbar relative">
          
          {/* Barra de Ações do Documento */}
          <header className="sticky top-0 z-30 w-full bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md px-8 py-4 flex items-center justify-between border-b border-black/5 dark:border-white/5">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsLeftCollapsed(!isLeftCollapsed)} 
                className={cn(
                  "p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors",
                  isFocusMode && "opacity-0 pointer-events-none"
                )}
                title="Alternar Sidebar Esquerda"
              >
                <LayoutTemplate className="w-4 h-4 opacity-50 hover:opacity-100" />
              </button>
              {selectedDateStr && (
                <button 
                  onClick={() => setSelectedDateStr(null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-xs font-semibold opacity-70"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Voltar
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const focus = !isFocusMode;
                  setIsFocusMode(focus);
                  if (focus) {
                    setIsLeftCollapsed(true);
                    setIsRightCollapsed(true);
                  } else {
                    setIsLeftCollapsed(false);
                    setIsRightCollapsed(false);
                  }
                }}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border flex items-center gap-1.5",
                  isFocusMode 
                    ? "bg-primary text-white border-primary shadow-sm" 
                    : "bg-black/5 dark:bg-white/5 border-transparent text-foreground/60 hover:text-foreground hover:bg-black/10 dark:hover:bg-white/10"
                )}
              >
                <Eye className="w-3.5 h-3.5" /> {isFocusMode ? "Sair do Foco" : "Modo Foco"}
              </button>

              <button 
                onClick={() => setIsRightCollapsed(!isRightCollapsed)}
                className={cn(
                  "p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors",
                  isFocusMode && "opacity-0 pointer-events-none"
                )}
                title="Alternar Painel de Visualização"
              >
                <Settings className="w-4 h-4 opacity-50 hover:opacity-100" />
              </button>
            </div>
          </header>

          <div className="flex-1 w-full max-w-3xl mx-auto px-8 py-10 flex flex-col justify-start">
            <AnimatePresence mode="wait">
              {currentPost ? (
                <motion.div
                  key={selectedDateStr}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="w-full flex-1"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-6">
                    <button
                      type="button"
                      onClick={generateCurrentPostFields}
                      disabled={isGeneratingPost || isGeneratingMonth}
                      className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-[10px] font-black uppercase tracking-wider text-white disabled:opacity-50"
                    >
                      <Sparkles className="h-3.5 w-3.5" /> {isGeneratingPost ? 'LeIA está gerando...' : 'Gerar com LeIA'}
                    </button>
                    <button
                      type="button"
                      onClick={generateMonthFields}
                      disabled={isGeneratingPost || isGeneratingMonth}
                      className="inline-flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-primary disabled:opacity-50"
                    >
                      <Sparkles className="h-3.5 w-3.5" /> {isGeneratingMonth ? 'LeIA está gerando o mês...' : 'Gerar mês com LeIA'}
                    </button>
                  </div>
                  {/* Título Interno Document-Style */}
                  <input
                    type="text"
                    value={currentPost.title || ''}
                    onChange={e => updateCurrentPost({ title: e.target.value })}
                    placeholder="Título interno da publicação..."
                    className="text-4xl font-display font-black bg-transparent border-none outline-none placeholder:opacity-20 w-full mb-8 focus:ring-0 p-0 text-foreground/90"
                  />

                  {/* Properties Grid */}
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4 max-w-xl mb-10 pb-8 border-b border-black/5 dark:border-white/10 text-xs font-medium text-foreground/70">
                    <div className="flex items-center gap-3">
                      <span className="w-20 opacity-40 uppercase text-[9px] font-black tracking-widest">Data</span>
                      <span className="font-semibold text-foreground/90">
                        {format(new Date(selectedDateStr + 'T12:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="w-20 opacity-40 uppercase text-[9px] font-black tracking-widest">Formato</span>
                      <select
                        value={currentPost.type}
                        onChange={e => updateCurrentPost({ type: e.target.value as any })}
                        className="bg-transparent border-none outline-none font-semibold cursor-pointer focus:ring-0 p-0 text-primary w-fit"
                      >
                        {POST_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="w-20 opacity-40 uppercase text-[9px] font-black tracking-widest">Canal</span>
                      <input
                        type="text"
                        value={currentPost.channel || ''}
                        onChange={e => updateCurrentPost({ channel: e.target.value })}
                        placeholder="Instagram, LinkedIn..."
                        className="bg-transparent border-none outline-none font-semibold placeholder:opacity-30 focus:ring-0 p-0 w-full"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="w-20 opacity-40 uppercase text-[9px] font-black tracking-widest">Prazo</span>
                      <input
                        type="date"
                        value={currentPost.deadline ? (
                          typeof currentPost.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(currentPost.deadline)
                            ? currentPost.deadline
                            : format(new Date(currentPost.deadline), 'yyyy-MM-dd')
                        ) : ''}
                        onChange={e => updateCurrentPost({ deadline: e.target.value })}
                        className="bg-transparent border-none outline-none font-semibold focus:ring-0 p-0 text-foreground/90"
                      />
                    </div>
                  </div>

                  {/* Document Content Blocks */}
                  <div className="space-y-12">
                    
                    {/* 1. Head */}
                    <div className="border-l-2 border-primary/30 pl-4 py-1">
                      <span className="text-[10px] font-black uppercase opacity-45 tracking-wider">Head (Título da Arte)</span>
                      <input
                        type="text"
                        value={currentPost.head || currentPost.artHeadline || ''}
                        onChange={e => {
                          const val = e.target.value;
                          updateCurrentPost({ head: val, artHeadline: val });
                        }}
                        placeholder="Texto de destaque na arte visual..."
                        className="w-full bg-transparent border-none outline-none font-bold placeholder:opacity-30 text-2xl mt-1.5 focus:ring-0 p-0"
                      />
                    </div>

                    {/* 2. Subhead */}
                    <div className="border-l-2 border-primary/30 pl-4 py-1">
                      <span className="text-[10px] font-black uppercase opacity-45 tracking-wider">Subhead</span>
                      <input
                        type="text"
                        value={currentPost.subhead || ''}
                        onChange={e => updateCurrentPost({ subhead: e.target.value })}
                        placeholder="Subtítulo ou texto secundário da arte..."
                        className="w-full bg-transparent border-none outline-none font-medium placeholder:opacity-30 text-lg mt-1.5 focus:ring-0 p-0"
                      />
                    </div>

                    {/* 3. Legenda */}
                    <div className="border-l-2 border-primary/30 pl-4 py-1">
                      <span className="text-[10px] font-black uppercase opacity-45 tracking-wider block mb-2">Legenda</span>
                      <textarea
                        value={currentPost.subtitle || currentPost.caption || ''}
                        onChange={e => {
                          const val = e.target.value;
                          updateCurrentPost({ subtitle: val, caption: val });
                        }}
                        placeholder="Texto completo da legenda da publicação..."
                        rows={6}
                        className="w-full bg-slate-50/50 dark:bg-zinc-900/20 border border-black/5 dark:border-white/5 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono text-sm leading-relaxed text-foreground/90"
                      />
                    </div>

                    {/* 4. Objetivo */}
                    <div className="border-l-2 border-primary/30 pl-4 py-1">
                      <span className="text-[10px] font-black uppercase opacity-45 tracking-wider">Objetivo</span>
                      <input
                        type="text"
                        value={currentPost.objective || ''}
                        onChange={e => updateCurrentPost({ objective: e.target.value })}
                        placeholder="Ex: Gerar engajamento, captar leads, branding..."
                        className="w-full bg-transparent border-none outline-none font-medium placeholder:opacity-30 text-base mt-1.5 focus:ring-0 p-0"
                      />
                    </div>

                    {/* 5. Restante do briefing para a arte */}
                    <div className="border-l-2 border-primary/30 pl-4 py-1">
                      <span className="text-[10px] font-black uppercase opacity-45 tracking-wider block mb-2">Restante do briefing para a arte</span>
                      <textarea
                        value={currentPost.visualBriefing || currentPost.artText || ''}
                        onChange={e => {
                          const val = e.target.value;
                          updateCurrentPost({ visualBriefing: val, artText: val });
                        }}
                        placeholder="Orientação detalhada de design, referências ou texto interno..."
                        rows={4}
                        className="w-full bg-slate-50/50 dark:bg-zinc-900/20 border border-black/5 dark:border-white/5 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm leading-relaxed"
                      />
                    </div>

                    {/* 6. Etapa de funil */}
                    <div className="border-l-2 border-primary/30 pl-4 py-1">
                      <span className="text-[10px] font-black uppercase opacity-45 tracking-wider block mb-2">Etapa do Funil</span>
                      <select
                        value={currentPost.funnelStage || 'topo'}
                        onChange={e => updateCurrentPost({ funnelStage: e.target.value as any })}
                        className="bg-slate-50 dark:bg-zinc-900 border border-black/5 dark:border-white/5 rounded-2xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer text-foreground/90"
                      >
                        <option value="topo">Topo (Atração)</option>
                        <option value="meio">Meio (Nutrição/Autoridade)</option>
                        <option value="fundo">Fundo (Conversão)</option>
                      </select>
                    </div>

                    {/* Bloco Mídia */}
                    <div className="pt-6 border-t border-black/5 dark:border-white/5">
                      <span className="text-[10px] font-black uppercase opacity-45 tracking-wider block mb-4">Galeria de Mídia do Post</span>
                      <SmartMediaUploader
                        currentPost={currentPost}
                        onUpdate={updateCurrentPost}
                        clientName={currentClient?.name}
                        clientId={currentClient?.id}
                      />
                    </div>

                    {/* Bloco Observações Internas */}
                    <div className="space-y-2 pt-6 border-t border-black/5 dark:border-white/5 pb-16">
                      <span className="text-[10px] font-black uppercase opacity-45 tracking-wider block">Observações Internas (Equipe)</span>
                      <textarea
                        value={currentPost.internalNotes || ''}
                        onChange={e => updateCurrentPost({ internalNotes: e.target.value })}
                        placeholder="Nota ou alinhamento privado para a equipe de design/atendimento..."
                        rows={3}
                        className="w-full bg-slate-50/50 dark:bg-zinc-900/20 border border-black/5 dark:border-white/5 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                      />
                    </div>
                  </div>
                </motion.div>
              ) : (
                // Se nenhum post estiver selecionado, exibe o Guia de Branding do Cliente
                <motion.div
                  key="strategy-home"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="w-full flex-1"
                >
                  {renderClientStrategyHome()}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* COLUNA DIREITA: PREVIEW E COMENTÁRIOS */}
        {!isFocusMode && !isRightCollapsed && (
          <aside className="w-[360px] shrink-0 border-l border-black/5 dark:border-white/5 p-6 flex flex-col gap-6 overflow-y-auto no-scrollbar bg-slate-50/50 dark:bg-zinc-900/50">
            {currentPost ? (
              renderRightPanel()
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 opacity-35">
                <CalendarIcon className="w-12 h-12 mb-4" />
                <p className="text-xs font-bold uppercase tracking-wider">Aguardando Seleção</p>
                <p className="text-[11px] mt-2">Escolha uma data ou publicação para ver a prévia e interações.</p>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* MODAL DE CONFIRMAÇÃO DE MÊS LIMPO */}
      <ConfirmModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={async () => {
          if (!currentClient) return;
          const monthDates = Object.keys(posts).filter(dateStr => {
            const d = new Date(dateStr + 'T00:00:00');
            return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();
          });
          if (monthDates.length > 0) {
            await api.deletePostsBulk(currentClient.id, monthDates);
            const refreshed = await api.getPosts(currentClient.id);
            setPosts(refreshed);
          }
          setIsConfirmDeleteOpen(false);
        }}
        title="Limpar Calendário"
        message={`Isso irá excluir todos os posts do mês de ${format(currentDate, 'MMMM yyyy', { locale: ptBR })}. Essa ação é irreversível.`}
      />
    </MainLayout>
  );
}
