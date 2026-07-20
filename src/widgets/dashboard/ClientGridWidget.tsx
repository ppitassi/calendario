import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  LayoutGrid, 
  List,
  MoreVertical,
  ChevronRight,
  Settings,
  LayoutTemplate,
  TrendingUp,
  PenTool,
  X
} from 'lucide-react';
import { api } from '../../lib/api';
import { auth } from '../../lib/auth';
import { ClientData, UserRole } from '../../types';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface ClientGridWidgetProps {
  onSelectClient: (client: ClientData, role: string, destination: string) => void;
  onNewClient?: () => void;
  refreshTrigger?: number;
}

export function ClientGridWidget({ onSelectClient, onNewClient, refreshTrigger }: ClientGridWidgetProps) {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedClientForActions, setSelectedClientForActions] = useState<ClientData | null>(null);

  const userRole = auth.currentUser?.role || 'designer';

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
      const isAdmin = ['admin', 'gerente', 'atendimento'].includes(userRole);
      return matchesSearch && (isAdmin || isOwner);
    });
  }, [clients, searchTerm, userRole]);

  if (loading) return <div className="h-full flex items-center justify-center opacity-20 animate-pulse">Carregando carteira de clientes...</div>;

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
           <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-20" />
              <input 
                type="text" 
                placeholder="Buscar cliente ou marca..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-black/5 dark:bg-white/5 border border-white/5 rounded-2xl pl-12 pr-4 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
              />
           </div>
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
           <button 
             onClick={onNewClient}
             className="flex items-center gap-2 px-4 py-3 bg-primary text-white rounded-2xl text-[10px] font-black uppercase transition-all shadow-lg shadow-primary/20 hover:scale-105 active:scale-95"
           >
              <Plus className="w-4 h-4" /> Novo
           </button>
        </div>
      </div>

      <div className={cn(
        "flex-1 overflow-auto no-scrollbar",
        viewMode === 'grid' ? "grid grid-cols-1 2xl:grid-cols-2 gap-4 p-1" : "flex flex-col gap-3"
      )}>
        {filteredClients.map((client, idx) => (
          <motion.div
            key={client.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => setSelectedClientForActions(client)}
            className={cn(
              "rounded-[22px] border border-black/[0.06] bg-zinc-50 dark:border-white/[0.07] dark:bg-white/[0.04] hover:border-primary/40 hover:-translate-y-0.5 transition-all group cursor-pointer relative overflow-hidden",
              viewMode === 'grid' ? "p-5 flex flex-col" : "p-4 flex items-center justify-between"
            )}
          >
             <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-[40px] group-hover:scale-150 transition-transform pointer-events-none" />
             
             <div className="flex items-center gap-4 relative z-10">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-black/5 to-black/20 dark:from-white/5 dark:to-white/10 flex items-center justify-center overflow-hidden shrink-0 border border-white/5">
                   {client.logoUrl ? (
                     <img src={client.logoUrl} alt={client.name} className="w-full h-full object-contain p-2" />
                   ) : (
                     <span className="text-xl font-display font-black opacity-40">{client.name.substring(0, 2).toUpperCase()}</span>
                   )}
                </div>
                <div className="flex flex-col">
                   <h4 className="font-bold text-base leading-tight group-hover:text-primary transition-colors">{client.name}</h4>
                   <span className="text-[10px] font-bold uppercase opacity-30 tracking-widest mt-1">Clique para opções</span>
                </div>
             </div>

             {viewMode === 'grid' && (
               <div className="mt-8 flex items-center justify-between pt-4 border-t border-white/5 relative z-10">
                  <div className="flex -space-x-2">
                     {[1, 2].map(i => (
                       <div key={i} className="w-6 h-6 rounded-full bg-white/10 border border-background flex items-center justify-center">
                          <div className="w-4 h-4 rounded-full bg-primary/20" />
                       </div>
                     ))}
                  </div>
                  <div className="flex items-center gap-2 text-[9px] font-black uppercase opacity-20 group-hover:opacity-100 transition-opacity">
                     Configurar <ChevronRight className="w-3 h-3" />
                  </div>
               </div>
             )}

             {viewMode === 'list' && (
               <div className="flex items-center gap-4 relative z-10">
                  <div className="px-3 py-1 rounded-lg bg-black/5 dark:bg-white/5 border border-white/5 text-[10px] font-bold opacity-40 uppercase">
                     Ativo
                  </div>
                  <MoreVertical className="w-4 h-4 opacity-20" />
               </div>
             )}
          </motion.div>
        ))}
      </div>

      {/* PITCH-STYLE CONTEXTUAL ACTION MODAL */}
      <AnimatePresence>
        {selectedClientForActions && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedClientForActions(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            
            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-md bg-white/95 dark:bg-zinc-900/95 backdrop-blur-3xl rounded-[3rem] p-8 border border-black/5 dark:border-white/10 shadow-3xl z-10 flex flex-col gap-6"
            >
               {/* Header */}
               <div className="flex items-center justify-between pb-4 border-b border-black/5 dark:border-white/5">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black uppercase text-sm">
                        {selectedClientForActions.name.substring(0, 2)}
                     </div>
                     <div className="flex flex-col text-left">
                        <h4 className="font-display font-black text-lg">{selectedClientForActions.name}</h4>
                        <span className="text-[9px] font-black uppercase opacity-40 tracking-widest mt-0.5">Selecione o Modo de Trabalho</span>
                     </div>
                  </div>
                  <button 
                     onClick={() => setSelectedClientForActions(null)}
                     className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                  >
                     <X className="w-4 h-4" />
                  </button>
               </div>

               {/* Action Grid */}
               <div className="grid grid-cols-1 gap-3">
                  {[
                    { id: 'editor', label: 'Modo Edição', desc: 'Criar, organizar e planejar os posts', icon: PenTool, color: 'bg-primary/10 text-primary' },
                    { id: 'viewer', label: 'Modo Apresentação', desc: 'Visualizar o feed em formato de pitch', icon: LayoutTemplate, color: 'bg-emerald-500/10 text-emerald-500' },
                    { id: 'data_analysis', label: 'Modo Analítico', desc: 'Métricas, performance e gráficos', icon: TrendingUp, color: 'bg-indigo-500/10 text-indigo-500' },
                    { id: 'client_setup', label: 'Configurações', desc: 'Ajustes de marca, logo e acessos', icon: Settings, color: 'bg-zinc-500/10 text-zinc-500' }
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
  );
}
