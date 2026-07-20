import React from 'react';
import { motion } from 'motion/react';
import { X, Settings, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { ClientData } from '../types';

interface ClientSetupModalProps {
  setupClient: ClientData | null;
  setSetupClient: (client: ClientData | null) => void;
  handleSaveClientSetup: (e: React.FormEvent) => Promise<string | null> | void;
  onOpenAdvanced: (clientId: string) => void;
}

export function ClientSetupModal({ 
  setupClient, 
  setSetupClient, 
  handleSaveClientSetup,
  onOpenAdvanced
}: ClientSetupModalProps) {
  if (!setupClient) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={() => setSetupClient(null)} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="glass p-10 rounded-[3rem] w-full max-w-lg shadow-4xl relative z-10 border border-white/20"
      >
        <button onClick={() => setSetupClient(null)} className="absolute top-6 right-6 p-2 bg-black/5 dark:bg-white/10 rounded-full hover:bg-black/10 transition-colors">
          <X className="w-5 h-5" />
        </button>
        
        <div className="flex flex-col items-center text-center mb-8">
           <div className="p-4 bg-primary/10 text-primary rounded-2xl mb-4">
              <Settings className="w-8 h-8" />
           </div>
           <h2 className="text-2xl font-display font-bold">Quick Setup</h2>
           <p className="text-xs opacity-40 mt-2 uppercase tracking-widest font-black">Configuração básica do cliente</p>
        </div>
        
        <form onSubmit={handleSaveClientSetup} className="space-y-6">
            <div className="space-y-2">
               <label className="text-[10px] font-black uppercase opacity-40 ml-1">Nome da Marca</label>
               <input 
                 type="text" 
                 value={setupClient.name}
                 onChange={e => setSetupClient({...setupClient, name: e.target.value})}
                 className="w-full bg-black/5 dark:bg-white/5 border border-white/5 rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                 placeholder="Ex: Coca-Cola"
               />
            </div>

            <button 
             type="submit"
             className="w-full py-5 bg-primary text-white font-black uppercase text-xs rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Salvar e Continuar
            </button>

            <button 
              type="button"
              onClick={async (e) => {
                const currentId = setupClient.id;
                const savedId = await handleSaveClientSetup(e);
                onOpenAdvanced(savedId || currentId);
              }}
              className="w-full py-4 flex items-center justify-center gap-2 text-[10px] font-black uppercase opacity-40 hover:opacity-100 hover:text-primary transition-all"
            >
               Acessar Configurações Avançadas <ExternalLink className="w-3 h-3" />
            </button>
        </form>
      </motion.div>
    </div>
  );
}
