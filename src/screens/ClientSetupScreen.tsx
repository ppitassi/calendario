import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Settings, 
  Users, 
  Globe, 
  Trash2, 
  Save, 
  Image as ImageIcon,
  CheckCircle,
  AlertTriangle,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../lib/api';
import { ClientData, UserProfile } from '../types';
import { cn } from '../lib/utils';
import { compressImage } from '../components/SmartMediaUploader';
import { MainLayout } from '../components/MainLayout';
import { useNotifications } from '../contexts/NotificationContext';

interface ClientSetupScreenProps {
  clientId: string;
  onExit: () => void;
  currentClient: ClientData | null;
  onNavigate: (screen: string) => void;
}

export function ClientSetupScreen({ clientId, onExit, currentClient, onNavigate }: ClientSetupScreenProps) {
  const [client, setClient] = useState<ClientData | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'basics' | 'team' | 'api' | 'branding' | 'danger'>('basics');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { toast, confirm } = useNotifications();
  const [accountSelector, setAccountSelector] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!clientId) {
        setLoading(false);
        return;
      }
      try {
        setErrorMsg(null);
        const [clientData, usersData] = await Promise.all([
          api.getClient(clientId),
          api.getUsers()
        ]);
        setClient(clientData);
        setUsers(usersData);
      } catch (e: any) {
        console.error(e);
        setErrorMsg(e.message || "Erro de conexão com o servidor.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [clientId]);

  const handleSave = async () => {
    if (!client || saving) return;
    setSaving(true);
    try {
      await api.saveClient(client);
      toast("Configurações salvas com sucesso!", "success");
    } catch (e) {
      toast("Erro ao salvar configurações.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.deleteClient(clientId);
      onExit();
      toast("Cliente excluído com sucesso!", "success");
    } catch (e) {
      toast("Erro ao excluir cliente.", "error");
    }
  };

  if (errorMsg) return (
    <div className="min-h-screen w-full bg-background flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center mb-6">
        <AlertTriangle className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold mb-2">Erro ao carregar dados</h2>
      <p className="text-white/60 mb-6 max-w-md">{errorMsg}</p>
      <button onClick={() => window.location.reload()} className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold transition-colors">
        Tentar Novamente
      </button>
      <button onClick={onExit} className="mt-4 text-sm opacity-50 hover:opacity-100 transition-opacity">
        Voltar para o Início
      </button>
    </div>
  );

  if (loading) return <div className="min-h-screen w-full bg-background flex items-center justify-center font-bold">Carregando painel de controle...</div>;
  if (!client) return (
    <div className="min-h-screen w-full bg-background flex flex-col items-center justify-center gap-6">
      <div className="font-bold text-red-500">Erro crítico: Cliente não encontrado.</div>
      <button onClick={onExit} className="px-6 py-3 bg-black/10 dark:bg-white/10 rounded-xl hover:bg-black/20 font-bold flex items-center gap-2">
        <ArrowLeft className="w-4 h-4" /> Voltar para o Início
      </button>
    </div>
  );

  const selectedClient: ClientData = client;

  const tabs = [
    { id: 'basics', label: 'Básico', icon: Settings },
    { id: 'team', label: 'Equipe', icon: Users },
    { id: 'api', label: 'Integrações', icon: Globe },
    { id: 'branding', label: 'Branding', icon: ImageIcon },
    { id: 'danger', label: 'Avançado', icon: AlertTriangle, color: 'text-rose-500' },
  ];

  return (
    <MainLayout activeScreen="client_setup" onNavigate={onNavigate} currentClient={currentClient}>
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
              <h1 className="text-3xl font-display font-black tracking-tight">{selectedClient.name}</h1>
              <span className="text-xs font-bold uppercase opacity-40 tracking-widest mt-1">Configuração Profunda de Cliente</span>
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
                 <tab.icon className={cn("w-5 h-5", tab.color)} />
                 {tab.label}
               </button>
             ))}
          </nav>

          {/* Content Area */}
          <div className="flex-1 glass rounded-[3rem] p-12 border border-white/10 overflow-auto no-scrollbar shadow-2xl relative">
            <AnimatePresence mode="wait">
              {activeTab === 'basics' && (
                <motion.div 
                  key="basics"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                   <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase opacity-40 tracking-widest ml-1">Nome da Marca</label>
                         <input 
                           type="text" 
                           value={selectedClient.name}
                           onChange={e => setClient({...selectedClient, name: e.target.value})}
                           className="w-full bg-black/5 dark:bg-white/5 border border-white/5 rounded-2xl px-6 py-4 font-bold text-lg focus:ring-2 focus:ring-primary/40 outline-none transition-all"
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase opacity-40 tracking-widest ml-1">WhatsApp Group ID</label>
                         <input 
                           type="text" 
                           value={selectedClient.whatsappGroupId || ''}
                           onChange={e => setClient({...selectedClient, whatsappGroupId: e.target.value})}
                           className="w-full bg-black/5 dark:bg-white/5 border border-white/5 rounded-2xl px-6 py-4 font-bold text-lg focus:ring-2 focus:ring-primary/40 outline-none transition-all"
                         />
                      </div>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-white/5">
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase opacity-40 tracking-widest ml-1">Segmento</label>
                         <input 
                           type="text" 
                           value={selectedClient.segment || ''}
                           onChange={e => setClient({...selectedClient, segment: e.target.value})}
                           placeholder="ex: Tecnologia, Saúde, Educação"
                           className="w-full bg-black/5 dark:bg-white/5 border border-white/5 rounded-2xl px-6 py-4 font-bold text-sm focus:ring-2 focus:ring-primary/40 outline-none transition-all"
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase opacity-40 tracking-widest ml-1">Frequência de Postagem</label>
                         <input 
                           type="text" 
                           value={selectedClient.postFrequency || ''}
                           onChange={e => setClient({...selectedClient, postFrequency: e.target.value})}
                           placeholder="ex: 3x por semana, Diário"
                           className="w-full bg-black/5 dark:bg-white/5 border border-white/5 rounded-2xl px-6 py-4 font-bold text-sm focus:ring-2 focus:ring-primary/40 outline-none transition-all"
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase opacity-40 tracking-widest ml-1">Tom de Voz</label>
                         <textarea 
                           value={selectedClient.voiceTone || ''}
                           onChange={e => setClient({...selectedClient, voiceTone: e.target.value})}
                           placeholder="ex: Amigável, institucional, técnico, divertido..."
                           rows={3}
                           className="w-full bg-black/5 dark:bg-white/5 border border-white/5 rounded-2xl px-6 py-4 font-bold text-sm focus:ring-2 focus:ring-primary/40 outline-none transition-all resize-none"
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase opacity-40 tracking-widest ml-1">Público-Alvo</label>
                         <textarea 
                           value={selectedClient.targetAudience || ''}
                           onChange={e => setClient({...selectedClient, targetAudience: e.target.value})}
                           placeholder="ex: Jovens de 18-25 interessados em finanças..."
                           rows={3}
                           className="w-full bg-black/5 dark:bg-white/5 border border-white/5 rounded-2xl px-6 py-4 font-bold text-sm focus:ring-2 focus:ring-primary/40 outline-none transition-all resize-none"
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase opacity-40 tracking-widest ml-1">Pilares de Conteúdo</label>
                         <textarea 
                           value={selectedClient.contentColumns || ''}
                           onChange={e => setClient({...selectedClient, contentColumns: e.target.value})}
                           placeholder="ex: Educacional (40%), Promocional (30%), Bastidores (30%)"
                           rows={3}
                           className="w-full bg-black/5 dark:bg-white/5 border border-white/5 rounded-2xl px-6 py-4 font-bold text-sm focus:ring-2 focus:ring-primary/40 outline-none transition-all resize-none"
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase opacity-40 tracking-widest ml-1">Redes e Canais</label>
                         <textarea 
                           value={selectedClient.networks || ''}
                           onChange={e => setClient({...selectedClient, networks: e.target.value})}
                           placeholder="ex: Instagram, LinkedIn, TikTok"
                           rows={3}
                           className="w-full bg-black/5 dark:bg-white/5 border border-white/5 rounded-2xl px-6 py-4 font-bold text-sm focus:ring-2 focus:ring-primary/40 outline-none transition-all resize-none"
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase opacity-40 tracking-widest ml-1">Observações da Marca</label>
                         <textarea 
                           value={selectedClient.brandNotes || ''}
                           onChange={e => setClient({...selectedClient, brandNotes: e.target.value})}
                           placeholder="Diretrizes gerais, cores proibidas, termos a evitar..."
                           rows={3}
                           className="w-full bg-black/5 dark:bg-white/5 border border-white/5 rounded-2xl px-6 py-4 font-bold text-sm focus:ring-2 focus:ring-primary/40 outline-none transition-all resize-none"
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase opacity-40 tracking-widest ml-1">Informações Visuais Básicas</label>
                         <textarea 
                           value={selectedClient.visualInfo || ''}
                           onChange={e => setClient({...selectedClient, visualInfo: e.target.value})}
                           placeholder="Paleta de cores (hex), fontes tipográficas preferidas..."
                           rows={3}
                           className="w-full bg-black/5 dark:bg-white/5 border border-white/5 rounded-2xl px-6 py-4 font-bold text-sm focus:ring-2 focus:ring-primary/40 outline-none transition-all resize-none"
                         />
                      </div>
                   </div>

                   <div className="p-6 bg-primary/5 rounded-3xl border border-primary/10 flex items-center gap-6">
                      <div className="p-4 bg-primary text-white rounded-2xl">
                         <Info className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                         <h4 className="font-bold text-sm">Política de Aprovação</h4>
                         <p className="text-xs opacity-60 mt-1">Defina se o cliente precisa ver as imagens prontas para aprovar o planejamento ou se apenas os textos são suficientes.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={selectedClient.hasPreCalendar} 
                          onChange={e => setClient({...selectedClient, hasPreCalendar: e.target.checked})}
                          className="sr-only peer" 
                        />
                        <div className="w-14 h-8 bg-black/10 dark:bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                   </div>
                </motion.div>
              )}

              {activeTab === 'team' && (
                <motion.div 
                  key="team"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                   <h3 className="text-xl font-bold">Equipe Responsável</h3>
                   <div className="grid grid-cols-1 gap-4">
                      {users.filter(u => u.role === 'designer' || u.role === 'estagiario' || u.role === 'gerente').map(u => {
                        const isAssigned = selectedClient.owners?.includes(u.uid);
                        return (
                          <div 
                            key={u.uid} 
                            onClick={() => {
                              const owners = selectedClient.owners || [];
                              const next = isAssigned ? owners.filter(id => id !== u.uid) : [...owners, u.uid];
                              setClient({...selectedClient, owners: next});
                            }}
                            className={cn(
                              "flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer",
                              isAssigned ? "bg-primary/10 border-primary/20" : "bg-white/5 border-transparent opacity-60 hover:opacity-100"
                            )}
                          >
                            <div className="flex items-center gap-4">
                               <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white text-xs font-black">
                                  {u.displayName?.substring(0, 2).toUpperCase()}
                               </div>
                               <div className="flex flex-col">
                                  <span className="font-bold text-sm">{u.displayName}</span>
                                  <span className="text-[10px] font-black uppercase opacity-40">{u.role}</span>
                               </div>
                            </div>
                            {isAssigned ? <CheckCircle className="w-5 h-5 text-primary" /> : <div className="w-5 h-5 rounded-full border-2 border-white/10" />}
                          </div>
                        );
                      })}
                   </div>
                </motion.div>
              )}

              {activeTab === 'api' && (
                <motion.div 
                  key="api"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-10"
                >
                  <div>
                    <h3 className="text-xl font-bold mb-1">Integrações de Redes Sociais</h3>
                    <p className="text-xs opacity-40">Conecte as contas do cliente para sincronizar métricas no painel de BI automaticamente.</p>
                  </div>

                  {[
                    {
                      platform: 'facebook',
                      label: 'Facebook Page',
                      color: 'from-blue-600 to-blue-800',
                      tokenKey: 'meta_access_token',
                      idKey: 'facebook_page_id',
                      idLabel: 'Facebook Page ID (auto-detectado)',
                    },
                    {
                      platform: 'instagram',
                      label: 'Instagram / Meta',
                      color: 'from-pink-500 to-purple-600',
                      tokenKey: 'meta_access_token',
                      idKey: 'meta_account_id',
                      idLabel: 'Business Account ID (auto-detectado)',
                    },
                    {
                      platform: 'youtube',
                      label: 'YouTube',
                      color: 'from-red-500 to-red-700',
                      tokenKey: 'youtube_token',
                      idKey: 'youtube_channel_id',
                      idLabel: 'Channel ID (auto-detectado)',
                    },
                    {
                      platform: 'tiktok',
                      label: 'TikTok',
                      color: 'from-black to-gray-800',
                      tokenKey: 'tiktok_token',
                      idKey: 'tiktok_username',
                      idLabel: 'Username do TikTok',
                    },
                    {
                      platform: 'linkedin',
                      label: 'LinkedIn',
                      color: 'from-blue-600 to-blue-800',
                      tokenKey: 'linkedin_token',
                      idKey: 'linkedin_org_id',
                      idLabel: 'Organization ID',
                    },
                    {
                      platform: 'x',
                      label: 'X (Twitter)',
                      color: 'from-gray-800 to-black',
                      tokenKey: 'x_token',
                      idKey: 'x_username',
                      idLabel: 'Username do X',
                    },
                  ].map(({ platform, label, color, tokenKey, idKey, idLabel }) => {
                    const isConnected = !!(client as any)[tokenKey];
                    const supportsOAuth = ['facebook', 'instagram', 'youtube'].includes(platform);

                    return (
                      <div key={platform} className="p-6 rounded-3xl border border-white/10 bg-white/5 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center`}>
                              <Globe className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <h4 className="font-bold text-sm">{label}</h4>
                              <span className={`text-[10px] font-black uppercase tracking-widest ${isConnected ? 'text-emerald-400' : 'opacity-40'}`}>
                                {isConnected ? '● Conectado' : '○ Não conectado'}
                              </span>
                            </div>
                          </div>

                          {supportsOAuth ? (
                            <div className="flex flex-col sm:flex-row gap-2">
                              <button
                                onClick={() => {
                                  const popup = window.open(
                                    `/api/auth/social/login/${platform}?clientId=${selectedClient.id}`,
                                    'oauth',
                                    'width=640,height=720,top=100,left=200'
                                  );
                                  const handler = (event: MessageEvent) => {
                                    if (typeof event.data === 'string' && event.data.startsWith('oauth-payload:')) {
                                      try {
                                        const payload = JSON.parse(event.data.replace('oauth-payload:', ''));
                                        window.removeEventListener('message', handler);
                                        
                                        if (payload.platform === 'instagram' || payload.platform === 'facebook') {
                                           setAccountSelector({
                                             platform: payload.platform,
                                             token: payload.token,
                                             accounts: payload.accounts
                                           });
                                        }
                                      } catch (e) {
                                        console.error('Failed to parse oauth payload');
                                      }
                                    }
                                  };
                                  window.addEventListener('message', handler);
                                }}
                                className={`flex-1 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest text-white bg-gradient-to-r ${color} hover:scale-105 active:scale-95 transition-all shadow-lg`}
                              >
                                {isConnected ? 'Reconectar' : 'Conectar'}
                              </button>
                              
                              {isConnected && (
                                <button
                                  onClick={async () => {
                                    const isConfirmed = await confirm(
                                      'Desconectar Integração',
                                      `Tem certeza que deseja desconectar o ${label}?`,
                                      { confirmText: 'Desconectar', type: 'danger' }
                                    );
                                    if (isConfirmed) {
                                      const updatedClient = { ...selectedClient, [tokenKey]: null, [idKey]: null } as any;
                                      setClient(updatedClient);
                                      import('../lib/api').then(({ api }) => {
                                        api.saveClient(updatedClient).then(() => {
                                          toast(`${label} desconectado.`, 'info');
                                        });
                                      });
                                    }
                                  }}
                                  className="px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest text-white bg-red-500/20 text-red-500 border border-red-500/50 hover:bg-red-500 hover:text-white active:scale-95 transition-all shadow-lg"
                                >
                                  Desconectar
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] opacity-40 italic">Preencha o campo abaixo manualmente</span>
                          )}
                        </div>

                        {/* Manual ID / Username field */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase opacity-40 tracking-widest">{idLabel}</label>
                          <input
                            type="text"
                            value={(client as any)[idKey] || ''}
                            onChange={e => setClient({ ...selectedClient, [idKey]: e.target.value } as any)}
                            placeholder={supportsOAuth ? 'Preenchido automaticamente após o login' : `ex: @username`}
                            className="w-full bg-black/5 dark:bg-white/5 border border-white/5 rounded-2xl px-5 py-3 text-sm font-mono focus:ring-2 focus:ring-primary/40 outline-none transition-all"
                          />
                        </div>
                      </div>
                    );
                  })}
                </motion.div>
              )}


              {activeTab === 'branding' && (
                <motion.div 
                   key="branding"
                   initial={{ opacity: 0, x: 20 }}
                   animate={{ opacity: 1, x: 0 }}
                   exit={{ opacity: 0, x: -20 }}
                   className="space-y-8"
                >
                   <div className="flex flex-col items-center gap-8 py-12">
                      <div className="relative group">
                         <div className="w-48 h-48 rounded-[3rem] bg-black/5 dark:bg-white/5 border-4 border-dashed border-white/10 flex items-center justify-center overflow-hidden">
                            {selectedClient.logoUrl ? (
                              <img src={selectedClient.logoUrl} alt={`Logo de ${selectedClient.name}`} className="w-full h-full object-contain p-4" />
                            ) : (
                              <ImageIcon className="w-12 h-12 opacity-10" />
                            )}
                         </div>
                         <label className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-[3rem]">
                            <span className="text-white text-xs font-black uppercase tracking-widest">Alterar Logo</span>
                            <input 
                              type="file" 
                              className="hidden" 
                              onChange={async e => {
                                const file = e.target.files?.[0];
                                if(file) {
                                  const compressed = await compressImage(file);
                                  const url = await api.uploadImage(compressed, `logo_${selectedClient.id}`, 'logos', selectedClient.name);
                                  setClient({...selectedClient, logoUrl: url});
                                }
                              }}
                            />
                         </label>
                      </div>
                      <div className="text-center">
                         <h4 className="font-bold">Identidade Visual da Marca</h4>
                         <p className="text-xs opacity-40 mt-2">Esta logo será exibida nos relatórios de BI e no Modo Apresentação.</p>
                      </div>
                   </div>
                </motion.div>
              )}

              {activeTab === 'danger' && (
                <motion.div 
                  key="danger"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                   <div className="p-8 rounded-[2.5rem] bg-rose-500/5 border border-rose-500/20">
                      <div className="flex items-center gap-4 mb-4">
                         <div className="p-3 bg-rose-500 text-white rounded-2xl shadow-lg shadow-rose-500/20">
                            <Trash2 className="w-6 h-6" />
                         </div>
                         <h4 className="text-xl font-bold text-rose-500">Excluir Cliente</h4>
                      </div>
                      <p className="text-sm opacity-60 mb-8">Esta ação é irreversível. Todos os posts, planejamentos, BI e tokens de aprovação vinculados a este cliente serão permanentemente removidos.</p>
                      
                      {!showDeleteConfirm ? (
                        <button 
                          onClick={() => setShowDeleteConfirm(true)}
                          className="px-8 py-4 bg-rose-500 text-white rounded-2xl font-black uppercase text-xs hover:scale-105 active:scale-95 transition-all shadow-lg shadow-rose-500/20"
                        >
                          Excluir {selectedClient.name} permanentemente
                        </button>
                      ) : (
                        <div className="flex items-center gap-4">
                           <button 
                             onClick={handleDelete}
                             className="px-8 py-4 bg-rose-600 text-white rounded-2xl font-black uppercase text-xs hover:bg-rose-700 transition-all"
                           >
                             Sim, tenho certeza absoluta
                           </button>
                           <button 
                             onClick={() => setShowDeleteConfirm(false)}
                             className="px-8 py-4 bg-white/10 rounded-2xl font-black uppercase text-xs hover:bg-white/20 transition-all"
                           >
                             Cancelar
                           </button>
                        </div>
                      )}
                   </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Account Selector Modal */}
      <AnimatePresence>
        {accountSelector && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-black/60"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-xl glass rounded-[2.5rem] p-8 border border-white/10 shadow-2xl relative overflow-hidden text-white"
              style={{ background: 'rgba(24, 24, 27, 0.95)' }}
            >
              {/* Decorative gradient lights */}
              <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-xl font-display font-black tracking-tight">Vincular Conta Meta</h3>
                    <p className="text-xs opacity-60">Escolha o perfil do Instagram e Página do Facebook correspondentes.</p>
                  </div>
                  <button
                    onClick={() => setAccountSelector(null)}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5 text-sm"
                  >
                    Fechar
                  </button>
                </div>

                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 no-scrollbar">
                  {accountSelector.accounts && accountSelector.accounts.length > 0 ? (
                    accountSelector.accounts.map((acc: any) => (
                      <div
                        key={acc.pageId}
                        onClick={async () => {
                          try {
                            if (!client) return;
                            await api.saveMetaAccount(selectedClient.id, accountSelector.token, acc.pageId, acc.igAccountId);
                            setClient({
                              ...selectedClient,
                              meta_access_token: accountSelector.token,
                              meta_account_id: acc.igAccountId,
                              facebook_page_id: acc.pageId
                            });
                            toast('Conta vinculada com sucesso!', 'success');
                            setAccountSelector(null);
                          } catch (e) {
                            console.error(e);
                            toast('Erro ao vincular conta do Meta.', 'error');
                          }
                        }}
                        className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-primary/30 transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/10 flex items-center justify-center bg-gradient-to-tr from-pink-500 via-red-500 to-yellow-500 p-[2px]">
                            {acc.igProfilePic ? (
                              <img src={acc.igProfilePic} alt={acc.igUsername || 'Instagram'} className="w-full h-full object-cover rounded-full bg-zinc-900" />
                            ) : (
                              <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center text-xs font-black">
                                {acc.pageName.substring(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-sm text-white group-hover:text-primary transition-colors">{acc.pageName}</span>
                            <span className="text-xs opacity-50 flex items-center gap-1.5 mt-0.5">
                              {acc.igUsername ? (
                                <>
                                  <span className="w-1.5 h-1.5 rounded-full bg-pink-500" />
                                  Instagram: @{acc.igUsername}
                                </>
                              ) : (
                                <>
                                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                                  Nenhum Instagram vinculado
                                </>
                              )}
                            </span>
                          </div>
                        </div>
                        <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 group-hover:bg-primary group-hover:border-primary text-xs font-black uppercase tracking-widest transition-all">
                          Vincular
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-white/40 text-sm">
                      Nenhuma conta ou página encontrada para este login.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MainLayout>
  );
}

