import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Sun, TrendingUp, Calendar, Sparkles, MapPin, RefreshCw } from 'lucide-react';
import { CompanionSettings } from '../types';

interface CompanionSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: CompanionSettings;
  setSettings: (s: CompanionSettings) => void;
  onSave: (s: CompanionSettings) => void;
  onRefreshLocation?: () => void;
}

export function CompanionSetupModal({ isOpen, onClose, settings, setSettings, onSave, onRefreshLocation }: CompanionSetupModalProps) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto selection:bg-[var(--color-primary)] selection:text-white">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md" 
            onClick={onClose} 
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="glass p-8 md:p-12 rounded-[3.5rem] z-10 w-full max-w-lg border border-white/20 shadow-4xl overflow-hidden relative"
          >
            <div className="absolute top-0 right-0 w-48 h-48 bg-[var(--color-primary)]/10 rounded-full blur-[80px] -mr-24 -mt-24 pointer-events-none" />
            
            <div className="flex justify-between items-center mb-10 relative z-10">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[var(--color-primary)]/10 rounded-2xl">
                    <Sparkles className="w-5 h-5 text-[var(--color-primary)]" />
                  </div>
                  <h3 className="text-2xl md:text-3xl font-display font-black tracking-tight">Companion Hub</h3>
                </div>
                <p className="text-xs font-bold uppercase opacity-30 tracking-widest ml-1">Configurações de Inteligência</p>
              </div>
              <button onClick={onClose} className="p-3 hover:bg-black/5 dark:hover:bg-white/10 rounded-2xl transition-all opacity-40 hover:opacity-100">
                <X className="w-5 h-5"/>
              </button>
            </div>

            <div className="space-y-8 relative z-10">
              {/* Location Input Group */}
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-bold uppercase opacity-40 tracking-widest">Sua Localização</label>
                  <div className="flex items-center gap-1 text-[8px] uppercase opacity-40 font-bold bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-full">
                    <MapPin className="w-2 h-2 text-[var(--color-primary)]" /> Auto-detectado
                  </div>
                </div>
                <div className="relative">
                  <input 
                    type="text" 
                    value={settings.locationName}
                    onChange={e => setSettings({ ...settings, locationName: e.target.value })}
                    className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-[1.5rem] pl-5 pr-12 py-4 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 transition-all font-display font-bold text-lg placeholder:opacity-20"
                    placeholder="Sua cidade ou bairro..."
                  />
                  <button 
                    title="Recarregar localização"
                    onClick={() => {
                       setSettings({ ...settings, locationName: '' });
                       onRefreshLocation?.();
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-all text-[var(--color-primary)]"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Modules Toggles */}
              <div className="space-y-4">
                <label className="text-[10px] font-bold uppercase opacity-40 ml-1 block tracking-widest">Painéis Ativos</label>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { id: 'showWeather', label: 'Clima e UV', icon: Sun },
                    { id: 'showTrends', label: 'Real-time Trends', icon: TrendingUp },
                    { id: 'showCalendar', label: 'Próximos Prazos', icon: Calendar },
                    { id: 'showHolidays', label: 'Datas Estratégicas', icon: Sparkles },
                  ].map(widget => (
                    <button 
                      key={widget.id}
                      onClick={() => setSettings({ ...settings, [widget.id]: !settings[widget.id as any] })}
                      className={`group flex flex-col gap-3 p-5 rounded-[2rem] border-2 transition-all text-left ${settings[widget.id as keyof CompanionSettings] ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white shadow-xl shadow-[var(--color-primary)]/20' : 'bg-black/5 dark:bg-white/5 border-transparent opacity-60 hover:opacity-100 hover:bg-black/[0.08]'}`}
                    >
                      <div className="flex justify-between items-start w-full">
                        <div className={`p-2 rounded-xl ${settings[widget.id as keyof CompanionSettings] ? 'bg-white/20' : 'bg-black/10'}`}>
                          <widget.icon className="w-4 h-4" />
                        </div>
                        {settings[widget.id as keyof CompanionSettings] && <Check className="w-4 h-4" />}
                      </div>
                      <span className="text-[11px] font-black uppercase tracking-tight leading-none">{widget.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button 
                onClick={() => onSave({ ...settings, hasConfigured: true })}
                className="w-full py-5 bg-[var(--color-primary)] text-white rounded-3xl font-black uppercase text-sm tracking-widest shadow-2xl shadow-[var(--color-primary)]/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                Salvar Configurações <Check className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
