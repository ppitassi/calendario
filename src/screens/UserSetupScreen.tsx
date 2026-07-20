import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  User, 
  Settings, 
  Award, 
  Shield, 
  Save, 
  Camera,
  Briefcase,
  Github,
  Globe,
  Mail,
  Sun,
  Moon,
  Monitor,
  Layout,
  Languages,
  Bell,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../lib/api';
import { auth } from '../lib/auth';
import { UserProfile, ClientData } from '../types';
import { cn } from '../lib/utils';
import { MainLayout } from '../components/MainLayout';
import { compressImage } from '../components/SmartMediaUploader';
import { useTheme } from '../components/ThemeProvider';
import { useNotifications } from '../contexts/NotificationContext';

interface UserSetupScreenProps {
  onExit: () => void;
  currentClient: ClientData | null;
  onNavigate: (screen: string) => void;
}

export function UserSetupScreen({ onExit, currentClient, onNavigate }: UserSetupScreenProps) {
  const [user, setUser] = useState<UserProfile | null>(auth.currentUser);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'portfolio' | 'security'>('profile');
  const { toast } = useNotifications();

  // Preferências
  const { theme, setTheme } = useTheme();
  const [density, setDensityState] = useState<'default' | 'compact'>('default');
  const [language, setLanguageState] = useState<string>('pt-BR');
  const [notifications, setNotifications] = useState<{ email: boolean; whatsapp: boolean; browser: boolean }>({
    email: true,
    whatsapp: true,
    browser: false,
  });

  useEffect(() => {
    const preferences = auth.currentUser?.ui_preferences || {};
    setDensityState(preferences.density || 'default');
    setLanguageState(preferences.language || 'pt-BR');
    if (preferences.notifications) setNotifications(preferences.notifications);
  }, []);

  // Security
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  const handleDensityChange = (val: 'default' | 'compact') => {
    setDensityState(val);
    void api.updateUiPreferences({ density: val }).catch(() => {});
    if (val === 'compact') {
      document.documentElement.classList.add('density-compact');
    } else {
      document.documentElement.classList.remove('density-compact');
    }
  };

  const handleLanguageChange = (val: string) => {
    setLanguageState(val);
    void api.updateUiPreferences({ language: val }).catch(() => {});
  };

  const handleNotificationToggle = (key: 'email' | 'whatsapp' | 'browser') => {
    const updated = { ...notifications, [key]: !notifications[key] };
    setNotifications(updated);
    void api.updateUiPreferences({ notifications: updated }).catch(() => {});
  };

  const handleSave = async () => {
    if (!user || saving) return;
    setSaving(true);
    try {
      await api.saveUser(user);
      auth.currentUser = user;
      toast("Perfil atualizado com sucesso!", 'success');
    } catch (e) {
      toast("Erro ao salvar perfil.", 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  const tabs = [
    { id: 'profile', label: 'Meu Perfil', icon: User },
    { id: 'preferences', label: 'Preferências', icon: Settings },
    { id: 'portfolio', label: 'Portfólio', icon: Briefcase },
    { id: 'security', label: 'Segurança', icon: Shield },
  ];

  return (
    <MainLayout activeScreen="user_setup" onNavigate={onNavigate} currentClient={currentClient}>
      <div className="flex-1 flex flex-col max-w-6xl mx-auto w-full p-8 pt-12">
        {/* Header Area */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-6">
            <button 
              onClick={onExit}
              className="p-3 rounded-2xl bg-black/5 dark:bg-white/5 hover:bg-black/10 transition-all border border-white/5"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex flex-col">
              <h1 className="text-3xl font-display font-black tracking-tight">Seu Perfil</h1>
              <span className="text-xs font-bold uppercase opacity-40 tracking-widest mt-1">Configurações de Identidade & OS</span>
            </div>
          </div>

          <button 
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-8 py-4 bg-primary text-white rounded-2xl font-bold uppercase text-sm shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>

        <div className="flex gap-12 flex-1 min-h-0">
          {/* Navigation Sidebar */}
          <nav className="w-64 flex flex-col gap-2">
             {tabs.map(tab => (
               <button
                 key={tab.id}
                 onClick={() => setActiveTab(tab.id as any)}
                 className={cn(
                   "flex items-center gap-4 px-6 py-4 rounded-2xl text-sm font-bold transition-all border",
                   activeTab === tab.id 
                     ? "bg-primary/10 border-primary/20 text-primary" 
                     : "bg-white/5 border-transparent opacity-40 hover:opacity-100 hover:bg-white/10"
                 )}
               >
                 <tab.icon className="w-5 h-5" />
                 {tab.label}
               </button>
             ))}
          </nav>

          {/* Content Area */}
          <div className="flex-1 glass rounded-[3rem] p-12 border border-white/10 overflow-auto no-scrollbar shadow-2xl relative">
            <AnimatePresence mode="wait">
              {activeTab === 'profile' && (
                <motion.div 
                  key="profile"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-12"
                >
                   {/* Avatar Upload */}
                   <div className="flex items-center gap-8">
                      <div className="relative group">
                         <div className="w-32 h-32 rounded-full bg-primary flex items-center justify-center text-white text-3xl font-black overflow-hidden border-4 border-white/10 shadow-2xl">
                            {user.photoURL ? (
                              <img src={user.photoURL} className="w-full h-full object-cover" />
                            ) : (
                              user.displayName?.substring(0, 2).toUpperCase()
                            )}
                         </div>
                         <label className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                            <Camera className="w-6 h-6 text-white" />
                            <input 
                              type="file" 
                              className="hidden" 
                              onChange={async e => {
                                const file = e.target.files?.[0];
                                if(file) {
                                  const compressed = await compressImage(file);
                                  const url = await api.uploadImage(compressed, `avatar_${user.uid}`, 'avatars');
                                  setUser({...user, photoURL: url});
                                }
                              }}
                            />
                         </label>
                      </div>
                      <div className="flex flex-col">
                         <h4 className="text-xl font-bold">{user.displayName}</h4>
                         <p className="text-sm opacity-40">{user.email}</p>
                         <div className="mt-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest w-fit">
                            {user.role}
                         </div>
                      </div>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase opacity-40 tracking-widest ml-1">Nome de Exibição</label>
                         <input 
                           type="text" 
                           value={user.displayName || ''}
                           onChange={e => setUser({...user, displayName: e.target.value})}
                           className="w-full bg-black/5 dark:bg-white/5 border border-white/5 rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase opacity-40 tracking-widest ml-1">Data de Nascimento</label>
                         <input 
                           type="date" 
                           value={user.birthday || ''}
                           onChange={e => setUser({...user, birthday: e.target.value})}
                           className="w-full bg-black/5 dark:bg-white/5 border border-white/5 rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                         />
                      </div>
                   </div>

                   <div className="space-y-4">
                      <h4 className="text-sm font-bold uppercase opacity-30 border-b border-white/5 pb-2">Links Profissionais</h4>
                      <div className="grid grid-cols-2 gap-4">
                         <div className="relative">
                            <Github className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-20" />
                            <input 
                              type="text" 
                              placeholder="GitHub Username" 
                              className="w-full bg-black/5 dark:bg-white/5 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-xs font-bold"
                            />
                         </div>
                         <div className="relative">
                            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-20" />
                            <input 
                              type="text" 
                              placeholder="Portfólio / Site" 
                              className="w-full bg-black/5 dark:bg-white/5 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-xs font-bold"
                            />
                         </div>
                      </div>
                   </div>
                </motion.div>
              )}

              {activeTab === 'portfolio' && (
                <motion.div 
                  key="portfolio"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                   <div className="p-12 text-center border-2 border-dashed border-white/10 rounded-[3rem]">
                      <Briefcase className="w-12 h-12 opacity-10 mx-auto mb-4" />
                      <h4 className="font-bold">Seu Portfólio de Criação</h4>
                      <p className="text-xs opacity-40 mt-2 max-w-sm mx-auto">Em breve: Gerencie seus melhores trabalhos realizados aqui no Content Planner e exiba-os para a agência.</p>
                      <button className="mt-8 px-6 py-3 bg-white/5 rounded-xl text-[10px] font-black uppercase opacity-40 hover:opacity-100 transition-all">Configurar Portfólio</button>
                   </div>
                </motion.div>
              )}

              {activeTab === 'preferences' && (
                <motion.div 
                  key="preferences"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-12"
                >
                   <div>
                      <h3 className="text-xl font-display font-black tracking-tight mb-2">Preferências do Sistema</h3>
                      <p className="text-xs opacity-40 uppercase tracking-widest font-bold">Personalize sua experiência visual e de uso</p>
                   </div>

                   {/* Theme Selector */}
                   <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase opacity-40 tracking-widest ml-1">Tema Visual</label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                         {(['light', 'dark', 'system'] as const).map((t) => {
                            const labels = { light: 'Claro', dark: 'Escuro', system: 'Sistema' };
                            const icons = { light: Sun, dark: Moon, system: Monitor };
                            const Icon = icons[t];
                            const active = theme === t;
                            return (
                               <button
                                 key={t}
                                 type="button"
                                 onClick={() => setTheme(t)}
                                 className={cn(
                                    "flex items-center gap-3 px-6 py-4 rounded-2xl text-sm font-bold border transition-all hover:bg-black/5 dark:hover:bg-white/5",
                                    active 
                                      ? "bg-primary/10 border-primary/20 text-primary" 
                                      : "bg-black/5 dark:bg-white/5 border-transparent opacity-60"
                                 )}
                               >
                                  <Icon className="w-5 h-5" />
                                  {labels[t]}
                               </button>
                            );
                         })}
                      </div>
                   </div>

                   {/* Layout Density */}
                   <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase opacity-40 tracking-widest ml-1">Densidade do Layout</label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         {(['default', 'compact'] as const).map((d) => {
                            const labels = { default: 'Padrão (Espaçoso)', compact: 'Compacto (Mais Informação)' };
                            const active = density === d;
                            return (
                               <button
                                 key={d}
                                 type="button"
                                 onClick={() => handleDensityChange(d)}
                                 className={cn(
                                    "flex items-center gap-3 px-6 py-4 rounded-2xl text-sm font-bold border transition-all hover:bg-black/5 dark:hover:bg-white/5",
                                    active 
                                      ? "bg-primary/10 border-primary/20 text-primary" 
                                      : "bg-black/5 dark:bg-white/5 border-transparent opacity-60"
                                 )}
                               >
                                  <Layout className="w-5 h-5" />
                                  {labels[d]}
                               </button>
                            );
                         })}
                      </div>
                   </div>

                   {/* Language */}
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase opacity-40 tracking-widest ml-1">Idioma do App</label>
                      <div className="relative">
                         <Languages className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 opacity-40" />
                         <select
                           value={language}
                           onChange={(e) => handleLanguageChange(e.target.value)}
                           className="w-full bg-black/5 dark:bg-white/5 border border-white/5 rounded-2xl pl-12 pr-6 py-4 font-bold outline-none focus:ring-2 focus:ring-primary/40 transition-all appearance-none cursor-pointer"
                         >
                            <option value="pt-BR" className="bg-card text-foreground">Português (PT-BR)</option>
                            <option value="en-US" className="bg-card text-foreground">English (EN-US)</option>
                            <option value="es" className="bg-card text-foreground">Español (ES)</option>
                         </select>
                      </div>
                   </div>

                   {/* Notifications */}
                   <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase opacity-40 tracking-widest ml-1">Canais de Notificação</label>
                      <div className="space-y-3">
                         {(['email', 'whatsapp', 'browser'] as const).map((key) => {
                            const labels = {
                               email: 'E-mail: Resumos de aprovação e relatórios de calendário',
                               whatsapp: 'WhatsApp: Alertas instantâneos de novos posts e prazos estourados',
                               browser: 'Navegador: Notificações push em tempo real na tela'
                            };
                            return (
                               <label 
                                 key={key}
                                 className="flex items-start gap-4 p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-white/5 cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition-all"
                               >
                                  <input 
                                    type="checkbox"
                                    checked={notifications[key]}
                                    onChange={() => handleNotificationToggle(key)}
                                    className="mt-1 w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                  />
                                  <div className="flex flex-col">
                                     <span className="text-sm font-bold capitalize">{key === 'email' ? 'E-mail' : key === 'whatsapp' ? 'WhatsApp' : 'Navegador'}</span>
                                     <span className="text-xs opacity-40 mt-0.5">{labels[key]}</span>
                                  </div>
                               </label>
                            );
                         })}
                      </div>
                   </div>
                </motion.div>
              )}

              {activeTab === 'security' && (
                <motion.div 
                  key="security"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-12"
                >
                   <div>
                      <h3 className="text-xl font-display font-black tracking-tight mb-2">Segurança da Conta</h3>
                      <p className="text-xs opacity-40 uppercase tracking-widest font-bold">Gerencie suas credenciais de acesso</p>
                   </div>

                   <form 
                     onSubmit={async (e) => {
                        e.preventDefault();
                        if (!currentPassword || !newPassword || !confirmPassword) {
                           setPasswordStatus({ type: 'error', message: 'Por favor, preencha todos os campos.' });
                           return;
                        }
                        if (newPassword !== confirmPassword) {
                           setPasswordStatus({ type: 'error', message: 'As novas senhas não coincidem.' });
                           return;
                        }
                        try {
                           setPasswordStatus({ type: null, message: '' });
                           await api.changePassword(currentPassword, newPassword);
                           setPasswordStatus({ type: 'success', message: 'Senha alterada com sucesso!' });
                           setCurrentPassword('');
                           setNewPassword('');
                           setConfirmPassword('');
                        } catch (err: any) {
                           const errMsg = err.response?.data?.error || 'Erro ao alterar a senha. Verifique se a senha atual está correta.';
                           setPasswordStatus({ type: 'error', message: errMsg });
                        }
                     }}
                     className="space-y-6 max-w-md"
                   >
                      {passwordStatus.message && (
                         <div className={cn(
                            "p-4 rounded-2xl text-xs font-bold border",
                            passwordStatus.type === 'success' 
                              ? "bg-green-500/10 border-green-500/20 text-green-500" 
                              : "bg-red-500/10 border-red-500/20 text-red-500"
                         )}>
                            {passwordStatus.message}
                         </div>
                      )}

                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase opacity-40 tracking-widest ml-1 font-bold">Senha Atual</label>
                         <input 
                           type="password" 
                           value={currentPassword}
                           onChange={e => setCurrentPassword(e.target.value)}
                           className="w-full bg-black/5 dark:bg-white/5 border border-white/5 rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                           placeholder="••••••••"
                         />
                      </div>

                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase opacity-40 tracking-widest ml-1 font-bold">Nova Senha</label>
                         <input 
                           type="password" 
                           value={newPassword}
                           onChange={e => setNewPassword(e.target.value)}
                           className="w-full bg-black/5 dark:bg-white/5 border border-white/5 rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                           placeholder="••••••••"
                         />
                      </div>

                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase opacity-40 tracking-widest ml-1 font-bold">Confirmar Nova Senha</label>
                         <input 
                           type="password" 
                           value={confirmPassword}
                           onChange={e => setConfirmPassword(e.target.value)}
                           className="w-full bg-black/5 dark:bg-white/5 border border-white/5 rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                           placeholder="••••••••"
                         />
                      </div>

                      <button
                        type="submit"
                        className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-primary text-white rounded-2xl font-bold uppercase text-xs shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                      >
                         <Lock className="w-4 h-4" /> Alterar Senha
                      </button>
                   </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
