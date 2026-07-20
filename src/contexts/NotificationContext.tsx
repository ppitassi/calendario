import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Info, 
  X 
} from 'lucide-react';
import { cn } from '../lib/utils';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface AlertState {
  title: string;
  message: string;
  type: NotificationType;
  resolve: () => void;
}

export interface ConfirmState {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'info';
  resolve: (value: boolean) => void;
}

export interface PromptState {
  title: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  resolve: (value: string | null) => void;
}

interface NotificationContextProps {
  toast: (message: string, type?: 'success' | 'error' | 'info') => void;
  alert: (title: string, message: string, type?: NotificationType) => Promise<void>;
  confirm: (title: string, message: string, options?: { confirmText?: string; cancelText?: string; type?: 'danger' | 'info' }) => Promise<boolean>;
  prompt: (title: string, message: string, options?: { placeholder?: string; defaultValue?: string }) => Promise<string | null>;
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [alertState, setAlertState] = useState<AlertState | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [promptState, setPromptState] = useState<PromptState | null>(null);

  // Toast
  const toast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  // Alert (returns a promise resolved when OK is clicked)
  const alert = useCallback((title: string, message: string, type: NotificationType = 'info') => {
    return new Promise<void>(resolve => {
      setAlertState({
        title,
        message,
        type,
        resolve: () => {
          setAlertState(null);
          resolve();
        }
      });
    });
  }, []);

  // Confirm (returns a promise resolved with true/false)
  const confirm = useCallback((title: string, message: string, options?: { confirmText?: string; cancelText?: string; type?: 'danger' | 'info' }) => {
    return new Promise<boolean>(resolve => {
      setConfirmState({
        title,
        message,
        confirmText: options?.confirmText,
        cancelText: options?.cancelText,
        type: options?.type || 'info',
        resolve: (val) => {
          setConfirmState(null);
          resolve(val);
        }
      });
    });
  }, []);

  // Prompt (returns a promise resolved with string or null)
  const prompt = useCallback((title: string, message: string, options?: { placeholder?: string; defaultValue?: string }) => {
    return new Promise<string | null>(resolve => {
      setPromptState({
        title,
        message,
        placeholder: options?.placeholder,
        defaultValue: options?.defaultValue,
        resolve: (val) => {
          setPromptState(null);
          resolve(val);
        }
      });
    });
  }, []);

  return (
    <NotificationContext.Provider value={{ toast, alert, confirm, prompt }}>
      {children}

      {/* TOASTS CONTAINER */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
              className="pointer-events-auto flex items-center justify-between gap-4 px-5 py-4 rounded-2xl glass border border-white/20 dark:border-white/10 shadow-2xl backdrop-blur-xl bg-white/70 dark:bg-black/70"
            >
              <div className="flex items-center gap-3">
                {t.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />}
                {t.type === 'error' && <XCircle className="w-5 h-5 text-rose-500 shrink-0" />}
                {t.type === 'info' && <Info className="w-5 h-5 text-primary shrink-0" />}
                <p className="text-xs font-bold text-foreground leading-snug">{t.message}</p>
              </div>
              <button 
                onClick={() => setToasts(prev => prev.filter(item => item.id !== t.id))}
                className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 opacity-40 hover:opacity-100 transition-all shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ALERT MODAL */}
      <AnimatePresence>
        {alertState && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xl"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-md glass rounded-[2.5rem] p-8 border border-white/20 dark:border-white/10 shadow-3xl flex flex-col items-center text-center gap-6 bg-white/80 dark:bg-black/80"
            >
              <div className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg",
                alertState.type === 'success' && "bg-emerald-500/10 text-emerald-500",
                alertState.type === 'error' && "bg-rose-500/10 text-rose-500",
                alertState.type === 'warning' && "bg-amber-500/10 text-amber-500",
                alertState.type === 'info' && "bg-primary/10 text-primary"
              )}>
                {alertState.type === 'success' && <CheckCircle className="w-8 h-8" />}
                {alertState.type === 'error' && <XCircle className="w-8 h-8" />}
                {alertState.type === 'warning' && <AlertTriangle className="w-8 h-8" />}
                {alertState.type === 'info' && <Info className="w-8 h-8" />}
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-display font-black tracking-tight">{alertState.title}</h3>
                <p className="text-sm opacity-60 font-medium leading-relaxed">{alertState.message}</p>
              </div>

              <button
                onClick={alertState.resolve}
                className="w-full py-4 rounded-xl bg-primary text-white font-bold uppercase tracking-wider text-xs hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-primary/20"
              >
                Entendido
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CONFIRM MODAL */}
      <AnimatePresence>
        {confirmState && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xl"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-md glass rounded-[2.5rem] p-8 border border-white/20 dark:border-white/10 shadow-3xl flex flex-col items-center text-center gap-6 bg-white/80 dark:bg-black/80"
            >
              <div className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg",
                confirmState.type === 'danger' ? "bg-rose-500/10 text-rose-500" : "bg-primary/10 text-primary"
              )}>
                {confirmState.type === 'danger' ? <AlertTriangle className="w-8 h-8" /> : <Info className="w-8 h-8" />}
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-display font-black tracking-tight">{confirmState.title}</h3>
                <p className="text-sm opacity-60 font-medium leading-relaxed">{confirmState.message}</p>
              </div>

              <div className="flex w-full gap-4">
                <button
                  onClick={() => confirmState.resolve(false)}
                  className="flex-1 py-4 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 font-bold uppercase transition-all text-xs tracking-wider border border-white/5 text-foreground"
                >
                  {confirmState.cancelText || 'Cancelar'}
                </button>
                <button
                  onClick={() => confirmState.resolve(true)}
                  className={cn(
                    "flex-1 py-4 rounded-xl font-bold uppercase transition-all text-xs tracking-wider text-white shadow-xl",
                    confirmState.type === 'danger' 
                      ? "bg-rose-500 hover:bg-rose-600 shadow-rose-500/20" 
                      : "bg-primary hover:bg-primary/90 shadow-primary/20"
                  )}
                >
                  {confirmState.confirmText || 'Confirmar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PROMPT MODAL */}
      <AnimatePresence>
        {promptState && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xl"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-md glass rounded-[2.5rem] p-8 border border-white/20 dark:border-white/10 shadow-3xl flex flex-col items-center text-center gap-6 bg-white/80 dark:bg-black/80"
            >
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg bg-primary/10 text-primary">
                <Info className="w-8 h-8" />
              </div>

              <div className="space-y-2 w-full text-center">
                <h3 className="text-xl font-display font-black tracking-tight">{promptState.title}</h3>
                <p className="text-sm opacity-60 font-medium leading-relaxed">{promptState.message}</p>
              </div>

              <div className="w-full">
                <textarea
                  className="w-full min-h-[100px] p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  placeholder={promptState.placeholder || "Digite aqui..."}
                  defaultValue={promptState.defaultValue}
                  id="custom-prompt-input"
                  autoFocus
                />
              </div>

              <div className="flex w-full gap-4">
                <button
                  onClick={() => promptState.resolve(null)}
                  className="flex-1 py-4 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 font-bold uppercase transition-all text-xs tracking-wider border border-white/5 text-foreground"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    const inputEl = document.getElementById('custom-prompt-input') as HTMLTextAreaElement | null;
                    promptState.resolve(inputEl?.value || '');
                  }}
                  className="flex-1 py-4 rounded-xl font-bold uppercase transition-all text-xs tracking-wider text-white bg-primary hover:bg-primary/95 shadow-xl shadow-primary/20"
                >
                  Enviar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
