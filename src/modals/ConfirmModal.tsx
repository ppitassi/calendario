import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle } from 'lucide-react';

export function ConfirmModal({ isOpen, onClose, onConfirm, title, message }: { isOpen: boolean, onClose: () => void, onConfirm: () => void, title: string, message: string }) {
  if (!isOpen) return null;
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xl"
        >
          <motion.div 
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="w-full max-w-md glass rounded-[3rem] p-10 border border-white/20 shadow-3xl flex flex-col items-center text-center gap-8 bg-white/50 dark:bg-black/50"
          >
            <div className="w-20 h-20 rounded-3xl bg-red-500/10 flex items-center justify-center text-red-500">
               <AlertCircle className="w-10 h-10" />
            </div>
            <div className="space-y-4">
               <h2 className="text-3xl font-display font-black tracking-tight">{title}</h2>
               <p className="text-lg opacity-60 font-medium leading-relaxed">{message}</p>
            </div>
            <div className="flex w-full gap-4 pt-4">
               <button 
                 onClick={onClose} 
                 className="flex-1 px-8 py-5 rounded-2xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 font-bold uppercase transition-all text-xs tracking-widest"
               >
                 Cancelar
               </button>
               <button 
                 onClick={() => { onConfirm(); onClose(); }} 
                 className="flex-1 px-8 py-5 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-bold uppercase transition-all text-xs tracking-widest shadow-2xl shadow-red-500/30"
               >
                 Excluir Tudo
               </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
