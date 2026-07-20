import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LogOut, 
  Settings, 
  Shield, 
  User, 
  Menu, 
  X,
  Bell,
  Search,
  LayoutDashboard,
  Users,
  PieChart,
  RefreshCcw,
  Eye,
  Calendar,
  CalendarDays,
  BarChart3,
  Compass,
  MessageSquare,
  TrendingUp,
  Clock,
  PlayCircle
} from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { auth, signOut } from '../lib/auth';
import { cn } from '../lib/utils';
import { ThemeToggle } from './ThemeToggle';
import { ProfileModal } from '../modals/ProfileModal';
import { api } from '../lib/api';

interface MainLayoutProps {
  children: React.ReactNode;
  activeScreen: string;
  onNavigate: (screen: string) => void;
  currentClient?: any;
}

export function MainLayout({ 
  children, 
  activeScreen, 
  onNavigate,
  currentClient
}: MainLayoutProps) {
  const { isDark } = useTheme();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState(auth.currentUser?.displayName || '');
  const birthdayInput = auth.currentUser?.birthday || '';

  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(Boolean(auth.currentUser?.ui_preferences?.sidebarPinned));

  useEffect(() => {
    setIsPinned(Boolean(auth.currentUser?.ui_preferences?.sidebarPinned));
  }, []);

  const isOpen = isPinned || isHovered;

  const handleSidebarClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) {
      return;
    }
    const nextPinned = !isPinned;
    setIsPinned(nextPinned);
    void api.updateUiPreferences({ sidebarPinned: nextPinned }).catch(() => {});
  };

  const user = auth.currentUser;
  const userRole = user?.role || 'designer';

  const agencySettings = {
    name: user?.agencyName || 'Third Floor',
    logo: user?.agencyLogo || '',
    logoDark: user?.agencyLogoDark || '',
    slogan: user?.agencySlogan || 'Estratégia Digital'
  };

  const handleUpdateProfile = async () => {
    if (!user) return;
    try {
      const updatedUser = { 
        ...user, 
        displayName: displayNameInput,
        birthday: birthdayInput
      };
      await api.saveUser(updatedUser);
      auth.currentUser = updatedUser;
      setIsProfileOpen(false);
    } catch (err) {
      console.error("Erro ao atualizar perfil", err);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans transition-colors duration-500 w-full relative tracking-wide bg-background">
      {/* OS-STYLE TOP BAR */}
      <header className="sticky top-0 z-[100] w-full glass py-3 px-6 flex items-center justify-between border-b border-white/5 backdrop-blur-2xl">
        <div className="flex items-center gap-10">
          {/* Agency Branding */}
          <div className="flex items-center gap-4 cursor-pointer" onClick={() => onNavigate('home')}>
            <div className="h-10 flex items-center justify-center">
              <AnimatePresence mode="wait">
                {isDark ? (
                  (agencySettings.logoDark || agencySettings.logo) && (
                    <motion.img
                      key="logo-dark"
                      src={agencySettings.logoDark || agencySettings.logo}
                      className="h-full max-w-[140px] object-contain"
                      alt="Logo"
                    />
                  )
                ) : (
                  (agencySettings.logo || agencySettings.logoDark) && (
                    <motion.img
                      key="logo-light"
                      src={agencySettings.logo || agencySettings.logoDark}
                      className="h-full max-w-[140px] object-contain"
                      alt="Logo"
                    />
                  )
                )}
              </AnimatePresence>
              {!agencySettings.logo && !agencySettings.logoDark && (
                <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg">
                  <span className="font-bold text-xs">CP</span>
                </div>
              )}
            </div>
            <div className="hidden lg:flex flex-col justify-center text-left">
              <span className="font-display font-bold text-sm tracking-tighter leading-none">{agencySettings.name}</span>
              <span className="text-[9px] font-bold uppercase opacity-40 leading-none mt-1">{agencySettings.slogan}</span>
            </div>
          </div>

        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-4">
          {/* Layout control buttons have been removed for clean, always-on Wix/Squarespace editing experience */}

          <div className="hidden sm:flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl border border-white/5">
             <button className="p-2 opacity-40 hover:opacity-100 transition-opacity"><Bell className="w-4 h-4" /></button>
             <button className="p-2 opacity-40 hover:opacity-100 transition-opacity"><Search className="w-4 h-4" /></button>
          </div>
          
          <div className="h-8 w-px bg-white/10 mx-1 hidden sm:block"></div>

          <div className="flex items-center gap-4">
            <ThemeToggle />
            
            <button 
              onClick={() => setIsProfileOpen(true)} 
              className="flex items-center gap-3 group pl-2 pr-4 py-1.5 rounded-full hover:bg-white/5 transition-all border border-transparent hover:border-white/10"
            >
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white shrink-0 overflow-hidden text-sm uppercase font-bold shadow-md">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  displayNameInput ? displayNameInput.substring(0, 2) : user?.email?.substring(0, 2)
                )}
              </div>
              <div className="hidden md:flex flex-col items-start leading-none">
                <span className="text-xs font-bold truncate max-w-[100px]">
                  {displayNameInput || user?.email?.split('@')[0]}
                </span>
                <span className="text-[9px] font-black uppercase opacity-40 mt-0.5">{userRole}</span>
              </div>
            </button>

            <button 
              onClick={() => signOut(auth)}
              className="p-2.5 rounded-full bg-rose-500/10 text-rose-500 opacity-60 hover:opacity-100 hover:bg-rose-500/20 transition-all"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Workspace Area with Left Sidebar */}
      <div className="flex-1 flex overflow-hidden w-full relative z-10">
        {/* LEFT INTERACTIVE SIDEBAR */}
        <aside 
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={handleSidebarClick}
          className={cn(
            "border-r border-black/5 dark:border-white/5 p-6 flex flex-col justify-between shrink-0 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md transition-all duration-300 relative select-none cursor-pointer",
            isOpen ? "w-64" : "w-20 px-3"
          )}
        >
          <div className="space-y-6">
            {/* Global navigation */}
            <div className="space-y-2">
              {isOpen ? (
                <span className="px-4 text-[10px] font-black uppercase tracking-widest opacity-40 block">Navegação Geral</span>
              ) : (
                <div className="h-4 border-b border-black/5 dark:border-white/5 mx-2 mb-2" />
              )}
              
              <button
                onClick={() => onNavigate('home')}
                className={cn(
                  "w-full flex items-center transition-all",
                  isOpen ? "gap-3 px-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider" : "justify-center py-3 rounded-2xl",
                  activeScreen === 'home' 
                    ? "bg-primary text-white shadow-lg shadow-primary/20" 
                    : "hover:bg-black/5 dark:hover:bg-white/5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                )}
                title={!isOpen ? "Dashboard" : undefined}
              >
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                {isOpen && <span>Dashboard</span>}
              </button>

              <button
                onClick={() => onNavigate('client_management')}
                className={cn(
                  "w-full flex items-center transition-all",
                  isOpen ? "gap-3 px-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider" : "justify-center py-3 rounded-2xl",
                  activeScreen === 'client_management'
                    ? "bg-primary text-white shadow-lg shadow-primary/20"
                    : "hover:bg-black/5 dark:hover:bg-white/5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                )}
                title={!isOpen ? "Clientes" : undefined}
              >
                <Users className="w-4 h-4 shrink-0" />
                {isOpen && <span>Clientes</span>}
              </button>

              <button
                onClick={() => onNavigate('leia_chat')}
                className={cn(
                  "w-full flex items-center transition-all",
                  isOpen ? "gap-3 px-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider" : "justify-center py-3 rounded-2xl",
                  activeScreen === 'leia_chat'
                    ? "bg-primary text-white shadow-lg shadow-primary/20"
                    : "hover:bg-black/5 dark:hover:bg-white/5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                )}
                title={!isOpen ? "Chat LeIA" : undefined}
              >
                <MessageSquare className="w-4 h-4 shrink-0" />
                {isOpen && <span>Chat LeIA</span>}
              </button>

              {(userRole === 'admin' || userRole === 'gerente') && (
                <button
                  onClick={() => onNavigate('admin_roles')}
                  className={cn(
                    "w-full flex items-center transition-all",
                    isOpen ? "gap-3 px-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider" : "justify-center py-3 rounded-2xl",
                    activeScreen === 'admin_roles' || activeScreen === 'users'
                      ? "bg-primary text-white shadow-lg shadow-primary/20" 
                      : "hover:bg-black/5 dark:hover:bg-white/5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  )}
                  title={!isOpen ? "Equipe" : undefined}
                >
                  <Shield className="w-4 h-4 shrink-0" />
                  {isOpen && <span>Equipe</span>}
                </button>
              )}

              {(userRole === 'admin' || userRole === 'gerente' || userRole === 'designer' || userRole === 'analista') && (
                <button
                  onClick={() => onNavigate('client_strategy')}
                  className={cn(
                    "w-full flex items-center transition-all",
                    isOpen ? "gap-3 px-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider" : "justify-center py-3 rounded-2xl",
                    activeScreen === 'client_strategy'
                      ? "bg-primary text-white shadow-lg shadow-primary/20"
                      : "hover:bg-black/5 dark:hover:bg-white/5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  )}
                  title={!isOpen ? "Gestão Estratégica" : undefined}
                >
                  <Compass className="w-4 h-4 shrink-0" />
                  {isOpen && <span>Gestão Estratégica</span>}
                </button>
              )}

              <button
                onClick={() => onNavigate('user_setup')}
                className={cn(
                  "w-full flex items-center transition-all",
                  isOpen ? "gap-3 px-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider" : "justify-center py-3 rounded-2xl",
                  activeScreen === 'user_setup' 
                    ? "bg-primary text-white shadow-lg shadow-primary/20" 
                    : "hover:bg-black/5 dark:hover:bg-white/5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                )}
                title={!isOpen ? "Meu Perfil" : undefined}
              >
                <User className="w-4 h-4 shrink-0" />
                {isOpen && <span>Meu Perfil</span>}
              </button>
            </div>

            {/* Contextual Client Navigation */}
            {currentClient && (
              <div className="space-y-2 pt-4 border-t border-black/5 dark:border-white/5">
                {isOpen ? (
                  <span className="px-4 text-[10px] font-black uppercase tracking-widest opacity-40 block">Área do Cliente</span>
                ) : (
                  <div className="h-px bg-black/5 dark:bg-white/5 mx-2" />
                )}
                
                {/* Client Avatar Box */}
                <div className={cn(
                  "flex items-center bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/10 transition-all",
                  isOpen ? "px-4 py-2 gap-3" : "justify-center py-2"
                )}>
                  {currentClient.logoUrl ? (
                    <img src={currentClient.logoUrl} className="w-8 h-8 rounded-xl object-contain p-1 shrink-0 bg-white/80" alt={currentClient.name} />
                  ) : (
                    <div className="w-8 h-8 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-bold text-xs uppercase shrink-0">
                      {currentClient.name.substring(0, 2)}
                    </div>
                  )}
                  {isOpen && (
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold truncate">{currentClient.name}</span>
                      <span className="text-[9px] font-black uppercase opacity-40">Selecionado</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => onNavigate('planner')}
                  className={cn(
                    "w-full flex items-center transition-all",
                    isOpen ? "gap-3 px-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider" : "justify-center py-3 rounded-2xl",
                    activeScreen === 'planner' 
                      ? "bg-primary text-white shadow-lg shadow-primary/20" 
                      : "hover:bg-black/5 dark:hover:bg-white/5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  )}
                  title={!isOpen ? "Editor de Posts" : undefined}
                >
                  <CalendarDays className="w-4 h-4 shrink-0" />
                  {isOpen && <span>Editor de Posts</span>}
                </button>

                <button
                  onClick={() => onNavigate('viewer')}
                  className={cn(
                    "w-full flex items-center transition-all",
                    isOpen ? "gap-3 px-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider" : "justify-center py-3 rounded-2xl",
                    activeScreen === 'viewer' 
                      ? "bg-primary text-white shadow-lg shadow-primary/20" 
                      : "hover:bg-black/5 dark:hover:bg-white/5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  )}
                  title={!isOpen ? "Apresentação" : undefined}
                >
                  <Eye className="w-4 h-4 shrink-0" />
                  {isOpen && <span>Apresentação</span>}
                </button>

                <button
                  onClick={() => onNavigate('data_analysis')}
                  className={cn(
                    "w-full flex items-center transition-all",
                    isOpen ? "gap-3 px-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider" : "justify-center py-3 rounded-2xl",
                    activeScreen === 'data_analysis' || activeScreen.startsWith('analytics_')
                      ? "bg-primary text-white shadow-lg shadow-primary/20" 
                      : "hover:bg-black/5 dark:hover:bg-white/5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  )}
                  title={!isOpen ? "Analytics BI" : undefined}
                >
                  <BarChart3 className="w-4 h-4 shrink-0" />
                  {isOpen && <span>Analytics BI</span>}
                </button>

                {/* Sub-analytics items - indented when sidebar is open */}
                {isOpen && (activeScreen === 'data_analysis' || activeScreen.startsWith('analytics_')) && (
                  <div className="pl-4 space-y-1.5 border-l border-white/10 ml-6 mt-1 flex flex-col items-start w-[calc(100%-24px)] select-none">
                    <button
                      onClick={() => onNavigate('analytics_growth')}
                      className={cn(
                        "w-full flex items-center gap-2 py-2 px-3 rounded-xl text-[10px] font-bold uppercase tracking-wider text-left transition-all",
                        activeScreen === 'analytics_growth' ? "text-primary bg-primary/10" : "text-zinc-500 hover:text-white"
                      )}
                    >
                      <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                      Crescimento
                    </button>
                    <button
                      onClick={() => onNavigate('analytics_visibility')}
                      className={cn(
                        "w-full flex items-center gap-2 py-2 px-3 rounded-xl text-[10px] font-bold uppercase tracking-wider text-left transition-all",
                        activeScreen === 'analytics_visibility' ? "text-primary bg-primary/10" : "text-zinc-500 hover:text-white"
                      )}
                    >
                      <Eye className="w-3.5 h-3.5 shrink-0" />
                      Alcance
                    </button>
                    <button
                      onClick={() => onNavigate('analytics_primetime')}
                      className={cn(
                        "w-full flex items-center gap-2 py-2 px-3 rounded-xl text-[10px] font-bold uppercase tracking-wider text-left transition-all",
                        activeScreen === 'analytics_primetime' ? "text-primary bg-primary/10" : "text-zinc-500 hover:text-white"
                      )}
                    >
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      Horários
                    </button>
                    <button
                      onClick={() => onNavigate('analytics_content')}
                      className={cn(
                        "w-full flex items-center gap-2 py-2 px-3 rounded-xl text-[10px] font-bold uppercase tracking-wider text-left transition-all",
                        activeScreen === 'analytics_content' ? "text-primary bg-primary/10" : "text-zinc-500 hover:text-white"
                      )}
                    >
                      <PlayCircle className="w-3.5 h-3.5 shrink-0" />
                      Vídeos
                    </button>
                  </div>
                )}

                {(userRole === 'admin' || userRole === 'gerente') && (
                  <button
                    onClick={() => onNavigate('client_setup')}
                    className={cn(
                      "w-full flex items-center transition-all",
                      isOpen ? "gap-3 px-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider" : "justify-center py-3 rounded-2xl",
                      activeScreen === 'client_setup' 
                        ? "bg-primary text-white shadow-lg shadow-primary/20" 
                        : "hover:bg-black/5 dark:hover:bg-white/5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                    )}
                    title={!isOpen ? "Ajustes Cliente" : undefined}
                  >
                    <Settings className="w-4 h-4 shrink-0" />
                    {isOpen && <span>Ajustes Cliente</span>}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-black/5 dark:border-white/5">
             <div className={cn(
               "flex items-center text-[10px] font-black uppercase tracking-widest opacity-40 transition-all",
               isOpen ? "gap-2 px-4" : "justify-center"
             )}>
                <Shield className="w-3.5 h-3.5 text-primary shrink-0" /> 
                {isOpen && <span>{userRole}</span>}
             </div>
          </div>
        </aside>

        {/* MAIN WORKSPACE CONTENT */}
        <main className="flex-1 overflow-y-auto relative flex flex-col bg-slate-50/30 dark:bg-zinc-950/30 scrollbar-thin">
          {children}
        </main>
      </div>

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        displayNameInput={displayNameInput}
        setDisplayNameInput={setDisplayNameInput}
        handleUpdateProfile={handleUpdateProfile}
        onOpenAdvanced={() => onNavigate('user_setup')}
      />
    </div>
  );
}
