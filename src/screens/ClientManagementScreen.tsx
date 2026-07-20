import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  LayoutGrid, 
  List, 
  Trash2, 
  ChevronRight, 
  Settings, 
  LayoutTemplate, 
  TrendingUp, 
  PenTool, 
  X,
  Globe,
  Instagram,
  Youtube,
  Users,
  Grid,
  Zap,
  Clock,
  Sparkles,
  Link as LinkIcon
} from 'lucide-react';
import { MainLayout } from '../components/MainLayout';
import { api } from '../lib/api';
import { auth } from '../lib/auth';
import { ClientData, UserRole } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { ClientSetupModal } from '../modals/ClientSetupModal';

interface ClientManagementScreenProps {
  onSelectClient: (client: ClientData, role: string, destination: string) => void;
  currentClient: ClientData | null;
  onNavigate: (screen: string) => void;
}

export function ClientManagementScreen({ onSelectClient, currentClient, onNavigate }: ClientManagementScreenProps) {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedClientForActions, setSelectedClientForActions] = useState<ClientData | null>(null);
  
  // New Client creation states
  const [setupClient, setSetupClient] = useState<ClientData | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const userRole = auth.currentUser?.role || 'designer';
  const isAdmin = ['admin', 'gerente', 'atendimento'].includes(userRole);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const loaded = await api.getClients();
        setClients(loaded);
      } catch (e) {
        console.error("Error fetching clients", e);
      } finally {
        setLoading(false);
      }
    };
    fetchClients();
  }, [refreshTrigger]);

  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
      const isOwner = c.owners?.includes(auth.currentUser?.uid || '');
      return matchesSearch && (isAdmin || isOwner);
    });
  }, [clients, searchTerm, isAdmin]);

  const handleDeleteClient = async (clientId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Tem certeza que deseja excluir permanentemente este cliente e todos os seus posts/métricas?")) {
      return;
    }
    try {
      await api.deleteClient(clientId);
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.error("Erro ao deletar cliente:", err);
    }
  };

  const handleSaveClientSetup = async (e: React.FormEvent): Promise<string | null> => {
    e.preventDefault();
    if (!setupClient) return null;
    try {
      const savedId = await api.saveClient(setupClient);
      setSetupClient(null);
      setRefreshTrigger(prev => prev + 1);
      return savedId;
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  // Portfolio metrics calculations
  const totalClients = clients.length;
  const integratedCount = useMemo(() => {
    return clients.filter(c => c.meta_account_id || c.youtube_channel_id || c.tiktok_username || c.linkedin_org_id || c.x_username).length;
  }, [clients]);

  return (
    <MainLayout activeScreen="client_management" onNavigate={onNavigate} currentClient={currentClient}>
      <div className="flex-1 flex flex-col p-8 pt-12 max-w-[1400px] mx-auto w-full">
        {/* Header section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div className="flex flex-col">
            <h1 className="text-3xl font-display font-black tracking-tight uppercase italic">Gestão da Carteira</h1>
            <span className="text-xs font-bold uppercase opacity-40 tracking-widest mt-1">Visualize, configure e organize todos os clientes ativos da agência</span>
          </div>

          <div className="flex items-center gap-3">
             <div className="flex bg-black/5 dark:bg-white/5 p-1 rounded-xl border border-white/5">
                <button onClick={() => setViewMode('grid')} className={cn("p-2 rounded-lg transition-all", viewMode === 'grid' ? "bg-white dark:bg-zinc-800 text-primary shadow-sm" : "opacity-40 hover:opacity-100")}>
                   <LayoutGrid className="w-4 h-4" />
                </button>
                <button onClick={() => setViewMode('list')} className={cn("p-2 rounded-lg transition-all", viewMode === 'list' ? "bg-white dark:bg-zinc-800 text-primary shadow-sm" : "opacity-40 hover:opacity-100")}>
                   <List className="w-4 h-4" />
                </button>
             </div>
             
             {isAdmin && (
               <button 
                 onClick={() => setSetupClient({ 
                   id: Math.random().toString(16).slice(2, 8), 
                   name: '', 
                   socialLinks: {}, 
                   owners: [auth.currentUser?.uid || ''] 
                 } as ClientData)}
                 className="flex items-center gap-2 px-5 py-3 bg-primary text-white rounded-2xl text-xs font-black uppercase tracking-wider hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20"
               >
                  <Plus className="w-4 h-4" /> Novo Cliente
               </button>
             )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          {[
            { label: 'Total de Marcas', val: totalClients, desc: 'Clientes ativos na carteira', color: 'bg-primary/10 text-primary', icon: Users },
            { label: 'Contas Integradas', val: `${integratedCount} / ${totalClients}`, desc: 'Com conexões de API ativas', color: 'bg-emerald-500/10 text-emerald-500', icon: Zap },
            { label: 'Ciclo Vigente', val: auth.currentUser?.planning_month ? `${auth.currentUser.planning_month.split('-')[1]}/${auth.currentUser.planning_month.split('-')[0]}` : 'N/D', desc: 'Mês de Planejamento Ativo', color: 'bg-indigo-500/10 text-indigo-500', icon: Clock },
            { label: 'Status da Agência', val: 'Estável', desc: 'Sistemas e APIs Meta operantes', color: 'bg-amber-500/10 text-amber-500', icon: Sparkles }
          ].map((card, i) => (
            <div key={i} className="glass rounded-[2rem] p-6 border border-white/10 flex items-center gap-4">
              <div className={cn("p-4 rounded-2xl", card.color)}>
                <card.icon className="w-6 h-6" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[10px] font-black uppercase opacity-30 tracking-widest">{card.label}</span>
                <span className="text-2xl font-display font-black tracking-tight mt-1">{card.val}</span>
                <span className="text-[9px] opacity-40 mt-0.5">{card.desc}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Search filter */}
        <div className="mb-8 relative flex max-w-md w-full">
           <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-20" />
           <input 
             type="text" 
             placeholder="Filtrar por nome do cliente ou palavra-chave..."
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
             className="w-full bg-black/5 dark:bg-white/5 border border-white/5 rounded-2xl pl-12 pr-4 py-3.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-semibold"
           />
        </div>

        {/* Client Cards Container */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-20 opacity-30 animate-pulse">
            <Clock className="w-10 h-10 animate-spin mb-4" />
            <p className="text-xs font-bold uppercase tracking-wider">Carregando carteira de clientes...</p>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-20 border-2 border-dashed border-white/10 rounded-[3rem] opacity-30">
            <Users className="w-12 h-12 mb-4" />
            <p className="text-xs font-bold uppercase tracking-wider">Nenhum cliente encontrado</p>
          </div>
        ) : (
          <div className={cn(
            "flex-1",
            viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" : "flex flex-col gap-4"
          )}>
            {filteredClients.map((client, idx) => {
              const hasMeta = !!client.meta_account_id;
              const hasYT = !!client.youtube_channel_id;
              const hasTiktok = !!client.tiktok_username;
              const hasLinkedin = !!client.linkedin_org_id;

              return (
                <motion.div
                  key={client.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  onClick={() => setSelectedClientForActions(client)}
                  className={cn(
                    "glass rounded-[2.5rem] border border-white/10 hover:border-primary/50 transition-all group cursor-pointer relative overflow-hidden flex flex-col justify-between",
                    viewMode === 'grid' ? "p-8 min-h-[220px]" : "p-5 flex-row items-center"
                  )}
                >
                  <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-[50px] group-hover:scale-150 transition-transform pointer-events-none" />
                  
                  <div className={cn("flex gap-4 relative z-10", viewMode === 'grid' ? "items-start" : "items-center")}>
                     <div className="w-16 h-16 rounded-3xl bg-black/10 dark:from-white/5 dark:to-white/10 flex items-center justify-center overflow-hidden shrink-0 border border-white/5 shadow-md">
                        {client.logoUrl ? (
                          <img src={client.logoUrl} alt={client.name} className="w-full h-full object-contain p-2" />
                        ) : (
                          <span className="text-2xl font-display font-black opacity-40 text-primary">{client.name.substring(0, 2).toUpperCase()}</span>
                        )}
                     </div>
                     <div className="flex flex-col text-left">
                        <h4 className="font-display font-black text-lg group-hover:text-primary transition-colors leading-tight">{client.name}</h4>
                        <div className="flex gap-1.5 mt-2">
                          {hasMeta && <span className="p-1.5 rounded-lg bg-pink-500/10 text-pink-400 border border-pink-500/10" title="Instagram Integrado"><Instagram className="w-3.5 h-3.5" /></span>}
                          {hasYT && <span className="p-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/10" title="YouTube Integrado"><Youtube className="w-3.5 h-3.5" /></span>}
                          {(!hasMeta && !hasYT) && <span className="text-[8px] font-black uppercase px-2 py-1 rounded bg-white/5 border border-white/5 text-zinc-500 tracking-wider">Sem API</span>}
                        </div>
                     </div>
                  </div>

                  {viewMode === 'grid' ? (
                    <div className="mt-8 flex items-center justify-between pt-5 border-t border-white/5 relative z-10">
                       <div className="flex items-center gap-1.5 text-[9px] font-black uppercase opacity-40 group-hover:opacity-100 transition-opacity">
                         Gerenciar Marca <ChevronRight className="w-3.5 h-3.5" />
                       </div>
                       
                       {isAdmin && (
                         <button 
                           onClick={(e) => handleDeleteClient(client.id, e)}
                           className="p-2 bg-white/5 rounded-xl hover:bg-rose-500/20 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100 z-20"
                           title="Excluir Cliente"
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
                       )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 relative z-10">
                       {isAdmin && (
                         <button 
                           onClick={(e) => handleDeleteClient(client.id, e)}
                           className="p-2.5 bg-white/5 rounded-xl hover:bg-rose-500/20 hover:text-rose-500 transition-all opacity-40 hover:opacity-100"
                           title="Excluir Cliente"
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
                       )}
                       <ChevronRight className="w-5 h-5 opacity-30 group-hover:opacity-100 group-hover:text-primary transition-all" />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Client details modal */}
        <AnimatePresence>
          {selectedClientForActions && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedClientForActions(null)}
                className="absolute inset-0 bg-black/60 backdrop-blur-md"
              />
              
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-md bg-white/95 dark:bg-zinc-900/95 backdrop-blur-3xl rounded-[3rem] p-8 border border-black/5 dark:border-white/10 shadow-3xl z-10 flex flex-col gap-6"
              >
                 <div className="flex items-center justify-between pb-4 border-b border-black/5 dark:border-white/5">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black uppercase text-sm">
                          {selectedClientForActions.name.substring(0, 2)}
                       </div>
                       <div className="flex flex-col text-left">
                          <h4 className="font-display font-black text-lg">{selectedClientForActions.name}</h4>
                          <span className="text-[9px] font-black uppercase opacity-40 tracking-widest mt-0.5">Selecione a Área de Trabalho</span>
                       </div>
                    </div>
                    <button 
                       onClick={() => setSelectedClientForActions(null)}
                       className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                    >
                       <X className="w-4 h-4" />
                    </button>
                 </div>

                 <div className="grid grid-cols-1 gap-3">
                    {[
                      { id: 'planner', label: 'Editor de Posts', desc: 'Calendário e pautas de posts do mês', icon: PenTool, color: 'bg-primary/10 text-primary' },
                      { id: 'viewer', label: 'Apresentação de Feed', desc: 'Pitch visual para aprovação do cliente', icon: LayoutTemplate, color: 'bg-emerald-500/10 text-emerald-500' },
                      { id: 'data_analysis', label: 'Métricas & Analytics BI', desc: 'Painel com gráficos e performance de contas', icon: TrendingUp, color: 'bg-indigo-500/10 text-indigo-500' },
                      { id: 'client_setup', label: 'Configurações de Acesso', desc: 'Tokens, logins e dados cadastrais', icon: Settings, color: 'bg-zinc-500/10 text-zinc-500' }
                    ].map(action => (
                       <button
                         key={action.id}
                         onClick={() => {
                           onSelectClient(selectedClientForActions, userRole, action.id);
                           setSelectedClientForActions(null);
                         }}
                         className="flex items-center gap-4 p-4 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-all text-left group border border-transparent hover:border-black/5 dark:hover:border-white/5 w-full cursor-pointer"
                       >
                         <div className={cn("p-3 rounded-xl transition-all group-hover:scale-110", action.color)}>
                           <action.icon className="w-5 h-5" />
                         </div>
                         <div className="flex flex-col leading-none">
                           <span className="font-bold text-sm">{action.label}</span>
                           <span className="text-[10px] opacity-40 mt-1">{action.desc}</span>
                         </div>
                       </button>
                    ))}
                 </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>

      <ClientSetupModal 
        setupClient={setupClient}
        setSetupClient={setSetupClient}
        handleSaveClientSetup={handleSaveClientSetup}
        onOpenAdvanced={(id) => onSelectClient({ id } as ClientData, userRole, 'client_setup')}
      />
    </MainLayout>
  );
}
