import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, ExternalLink } from 'lucide-react';
import { auth } from '../lib/auth';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  displayNameInput: string;
  setDisplayNameInput: (val: string) => void;
  handleUpdateProfile: () => void;
  onOpenAdvanced: () => void;
}

export function ProfileModal({ 
  isOpen, 
  onClose, 
  displayNameInput, 
  setDisplayNameInput, 
  handleUpdateProfile,
  onOpenAdvanced
}: ProfileModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 10 }}
            className="glass p-10 rounded-[3rem] w-full max-w-md flex flex-col gap-8 shadow-4xl relative z-10 border border-white/20"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center">
               <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-black mb-4 shadow-xl shadow-primary/20">
                  {auth.currentUser?.photoURL ? (
                    <img src={auth.currentUser.photoURL} className="w-full h-full object-cover" />
                  ) : (
                    displayNameInput.substring(0, 2).toUpperCase()
                  )}
               </div>
               <h3 className="font-display font-bold text-2xl">Ajuste Rápido</h3>
               <p className="text-[10px] font-black uppercase opacity-40 mt-2 tracking-widest">Identidade no Hub</p>
            </div>

            <div className="space-y-4">
               <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase opacity-40 ml-1">Nome de Exibição</label>
                 <input 
                   type="text" 
                   value={displayNameInput}
                   onChange={(e) => setDisplayNameInput(e.target.value)}
                   className="w-full bg-black/5 dark:bg-white/5 border border-white/5 rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                   placeholder="Seu nome"
                 />
               </div>
            </div>

            <button 
              onClick={handleUpdateProfile}
              className="w-full py-5 bg-primary text-white font-black uppercase text-xs rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Atualizar Nome
            </button>

            <button 
              onClick={() => {
                onOpenAdvanced();
                onClose();
              }}
              className="w-full py-4 flex items-center justify-center gap-2 text-[10px] font-black uppercase opacity-40 hover:opacity-100 hover:text-primary transition-all"
            >
               Gerenciar Perfil Completo <ExternalLink className="w-3 h-3" />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
