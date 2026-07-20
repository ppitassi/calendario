import React, { useState, useEffect } from 'react';
import {
   X,
   Upload,
   Palette,
   Layout,
   Save,
   Check,
   Moon,
   Sun,
   Smartphone,
   Globe,
   Settings,
   Image as ImageIcon,
   ChevronRight,
   Sparkles,
   Type,
   Building2,
   Trash2,
   AlertCircle,
   Calendar,
   Clock
} from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../lib/api';
import { auth } from '../lib/auth';
import { ImageCropperModal } from '../modals/ImageCropperModal';
import { useNotifications } from '../contexts/NotificationContext';

interface AgencySetupProps {
   onClose: () => void;
   initialData?: any;
   onSave: (data: any) => void;
}

export function AgencySetupScreen({ onClose, initialData, onSave }: AgencySetupProps) {
   const { toast } = useNotifications();
   const [isSaving, setIsSaving] = useState(false);
   const [activeTab, setActiveTab] = useState<'branding' | 'theme' | 'identity'>('branding');
   const [cropData, setCropData] = useState<{ image: string; type: 'light' | 'dark' } | null>(null);

   const [agencies, setAgencies] = useState<any[]>([]);
   const [selectedAgencyId, setSelectedAgencyId] = useState(auth.currentUser?.tenant_id || 'default_agency');

   const [formData, setFormData] = useState({
      id: selectedAgencyId,
      name: initialData?.name || '',
      slogan: initialData?.slogan || '',
      logo_url: initialData?.logo_url || '',
      logo_dark_url: initialData?.logo_dark_url || '',
      planning_month: initialData?.planning_month || '',
      deadline_pre: initialData?.deadline_pre || '',
      deadline_final: initialData?.deadline_final || '',
      theme_config: (typeof initialData?.theme_config === 'string' ? JSON.parse(initialData.theme_config) : initialData?.theme_config) || {
         primary: '#6366f1',
         light: {
            background: '#ffffff',
            surface: '#f8fafc'
         },
         dark: {
            background: '#0f172a',
            surface: '#1e293b'
         }
      }
   });

   useEffect(() => {
      // Carrega lista de agências para o seletor (se for admin)
      if (auth.currentUser?.role === 'admin') {
         api.getAgencies().then(setAgencies).catch(console.error);
      }
      
      // Carrega dados da agência atual ao montar
      if (selectedAgencyId) {
         handleAgencyChange(selectedAgencyId);
      }
   }, []);

   const handleAgencyChange = async (id: string) => {
      setSelectedAgencyId(id);
      try {
         const data = await api.getAgencySettings(id);
         if (data) {
            setFormData({
               id: data.id,
               name: data.name || '',
               slogan: data.slogan || '',
               logo_url: data.logo_url || '',
               logo_dark_url: data.logo_dark_url || '',
               planning_month: data.planning_month || '',
               deadline_pre: data.deadline_pre || '',
               deadline_final: data.deadline_final || '',
               theme_config: typeof data.theme_config === 'string' ? JSON.parse(data.theme_config) : (data.theme_config || formData.theme_config)
            });
         }
      } catch (e) {
         console.error("Erro ao carregar agência:", e);
      }
   };

   const handleSave = async () => {
      setIsSaving(true);
      try {
         await api.updateAgencySettings(formData);

         // Se a agência editada for a atual do usuário, atualiza na memória
         if (auth.currentUser && auth.currentUser.tenant_id === formData.id) {
            auth.currentUser = {
               ...auth.currentUser,
               agencyName: formData.name,
               agencySlogan: formData.slogan,
               agencyLogo: formData.logo_url,
               agencyLogoDark: formData.logo_dark_url,
               theme_config: formData.theme_config,
               planning_month: formData.planning_month,
               deadline_pre: formData.deadline_pre,
               deadline_final: formData.deadline_final
            };
         }

         onSave(formData);
         onClose();
      } catch (e) {
         console.error(e);
         toast('Erro ao salvar o Brand System', 'error');
      } finally {
         setIsSaving(false);
      }
   };

   const uploadAsset = async (file: File, type: 'light' | 'dark') => {
      const reader = new FileReader();
      reader.onload = (e) => {
         setCropData({ image: e.target?.result as string, type });
      };
      reader.readAsDataURL(file);
   };

   const handleCropComplete = async (croppedBlob: Blob) => {
      if (!cropData) return;
      const type = cropData.type;
      setCropData(null);

      try {
         const reader = new FileReader();
         reader.readAsDataURL(croppedBlob);
         reader.onloadend = async () => {
            const base64data = reader.result as string;
            const url = await api.uploadImage(base64data, `branding_logo_${type}_${Date.now()}`, 'branding');
            if (type === 'light') setFormData(prev => ({ ...prev, logo_url: url }));
            else setFormData(prev => ({ ...prev, logo_dark_url: url }));
         };
      } catch (e) {
         console.error(e);
         toast('Erro ao processar imagem', 'error');
      }
   };

   return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
         <div className="w-full max-w-5xl bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300 h-[90vh]">

            {/* HEADER */}
            <div className="p-10 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-gradient-to-br from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-950">
               <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-[1.5rem] bg-primary flex items-center justify-center text-white shadow-2xl shadow-primary/30 ring-4 ring-primary/10">
                     <Sparkles className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                     <h2 className="text-3xl font-display font-black tracking-tight text-zinc-900 dark:text-white">Configurações de Branding</h2>
                     <p className="text-sm font-medium opacity-50 mb-4">Configure a identidade visual da agência</p>
                     
                     {/* SELETOR DE AGÊNCIA - Reposicionado e Estilizado */}
                     {auth.currentUser?.role === 'admin' && agencies.length > 0 && (
                        <div className="flex items-center gap-3 bg-black/5 dark:bg-white/5 px-4 py-2.5 rounded-2xl border border-black/5 dark:border-white/10 w-fit animate-in fade-in slide-in-from-left-2 duration-500 hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
                           <Building2 className="w-4 h-4 text-primary" />
                           <div className="flex flex-col">
                              <select
                                 value={selectedAgencyId}
                                 onChange={(e) => handleAgencyChange(e.target.value)}
                                 className="bg-transparent text-xs font-black uppercase tracking-widest focus:outline-none cursor-pointer appearance-none pr-4"
                              >
                                 {agencies.map(a => (
                                    <option key={a.id} value={a.id} className="text-black">
                                       {a.name} — ID: {a.id}
                                    </option>
                                 ))}
                              </select>
                           </div>
                        </div>
                     )}
                  </div>
               </div>

               <div className="flex items-center gap-3">
                  <button onClick={onClose} className="p-4 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors group">
                     <X className="w-6 h-6 opacity-20 group-hover:opacity-100 transition-opacity" />
                  </button>
               </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
               {/* SIDEBAR NAVIGATION */}
               <div className="w-64 border-r border-black/5 dark:border-white/5 p-6 space-y-2">
                  <button
                     onClick={() => setActiveTab('branding')}
                     className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all",
                        activeTab === 'branding' ? "bg-primary text-white shadow-lg shadow-primary/20" : "hover:bg-black/5 dark:hover:bg-white/5 opacity-60"
                     )}
                  >
                     <ImageIcon className="w-5 h-5" /> Logos & Ativos
                  </button>
                  <button
                     onClick={() => setActiveTab('theme')}
                     className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all",
                        activeTab === 'theme' ? "bg-primary text-white shadow-lg shadow-primary/20" : "hover:bg-black/5 dark:hover:bg-white/5 opacity-60"
                     )}
                  >
                     <Palette className="w-5 h-5" /> Cores & Tema
                  </button>
                  <button
                     onClick={() => setActiveTab('identity')}
                     className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all",
                        activeTab === 'identity' ? "bg-primary text-white shadow-lg shadow-primary/20" : "hover:bg-black/5 dark:hover:bg-white/5 opacity-60"
                     )}
                  >
                     <Type className="w-5 h-5" /> Nome & Slogan
                  </button>
               </div>

               {/* CONTENT */}
               <div className="flex-1 overflow-y-auto p-10 bg-zinc-50/50 dark:bg-zinc-900/50">
                  {activeTab === 'branding' && (
                     <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                        <div className="grid grid-cols-2 gap-8">
                           {/* LIGHT LOGO */}
                           <div className="space-y-4">
                              <label className="text-xs font-bold uppercase tracking-widest opacity-40">Logo Modo Claro</label>
                              <div className="group relative aspect-video rounded-3xl border-2 border-dashed border-black/10 dark:border-white/10 bg-white flex items-center justify-center overflow-hidden hover:border-primary/50 transition-colors">
                                 {formData.logo_url ? (
                                    <img src={formData.logo_url} className="max-h-[80%] object-contain" />
                                 ) : (
                                    <div className="text-center">
                                       <Upload className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                       <p className="text-xs opacity-40">PNG ou SVG (Fundo Transparente)</p>
                                    </div>
                                 )}
                                 <input
                                    type="file"
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    onChange={(e) => e.target.files?.[0] && uploadAsset(e.target.files[0], 'light')}
                                 />
                              </div>
                           </div>

                           {/* DARK LOGO */}
                           <div className="space-y-4">
                              <label className="text-xs font-bold uppercase tracking-widest opacity-40">Logo Modo Escuro</label>
                              <div className="group relative aspect-video rounded-3xl border-2 border-dashed border-black/10 dark:border-white/10 bg-zinc-800 flex items-center justify-center overflow-hidden hover:border-primary/50 transition-colors">
                                 {formData.logo_dark_url ? (
                                    <img src={formData.logo_dark_url} className="max-h-[80%] object-contain" />
                                 ) : (
                                    <div className="text-center">
                                       <Upload className="w-8 h-8 mx-auto mb-2 opacity-20 text-white" />
                                       <p className="text-xs text-white/40">PNG ou SVG (Ideal Branco)</p>
                                    </div>
                                 )}
                                 <input
                                    type="file"
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    onChange={(e) => e.target.files?.[0] && uploadAsset(e.target.files[0], 'dark')}
                                 />
                              </div>
                           </div>
                        </div>

                        <div className="p-6 bg-amber-500/10 rounded-3xl border border-amber-500/20 flex gap-4">
                           <AlertCircle className="w-6 h-6 text-amber-500 shrink-0" />
                           <div>
                              <p className="text-sm font-bold text-amber-600 dark:text-amber-400">Recomendação Profissional</p>
                              <p className="text-xs opacity-60 leading-relaxed mt-1">Utilize logos em formato horizontal com proporção aproximada de 3:1. Imagens com fundo transparente garantem que sua marca se integre perfeitamente em todos os layouts.</p>
                           </div>
                        </div>
                     </div>
                  )}

                  {activeTab === 'theme' && (
                     <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                        <div className="grid grid-cols-2 gap-10">
                           {/* PRIMARY COLOR */}
                           <div className="space-y-6">
                              <h3 className="font-display font-bold text-lg">Cor Principal (Accent)</h3>
                              <div className="flex items-center gap-6 p-6 bg-white dark:bg-zinc-800 rounded-3xl shadow-sm border border-black/5">
                                 <input
                                    type="color"
                                    value={formData.theme_config.primary}
                                    onChange={(e) => {
                                       const val = e.target.value;
                                       setFormData(p => ({ 
                                          ...p, 
                                          theme_config: { 
                                             ...p.theme_config, 
                                             primary: val,
                                             light: { ...p.theme_config.light, primary: val },
                                             dark: { ...p.theme_config.dark, primary: val }
                                          } 
                                       }));
                                    }}
                                    className="w-16 h-16 rounded-2xl cursor-pointer border-none"
                                 />
                                 <div>
                                    <p className="font-bold">{formData.theme_config.primary}</p>
                                    <p className="text-xs opacity-40 uppercase font-black tracking-widest mt-1">Cód. Hexadecimal</p>
                                 </div>
                              </div>
                              <p className="text-xs opacity-40 leading-relaxed">Esta cor será aplicada em botões, links, destaques do calendário e elementos ativos da interface.</p>
                           </div>

                           {/* THEME PREVIEW */}
                           <div className="space-y-4">
                              <label className="text-xs font-bold uppercase tracking-widest opacity-40">Prévia do Ecossistema</label>
                              <div className="bg-white dark:bg-zinc-800 rounded-3xl p-6 border border-black/5 shadow-inner space-y-4">
                                 <div className="flex gap-2">
                                    <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: formData.theme_config.primary }} />
                                    <div className="w-full h-8 rounded-lg bg-black/5 dark:bg-white/10" />
                                 </div>
                                 <div className="grid grid-cols-3 gap-2">
                                    <div className="h-20 rounded-2xl bg-black/5 dark:bg-white/5" />
                                    <div className="h-20 rounded-2xl" style={{ backgroundColor: `${formData.theme_config.primary}20`, border: `1px solid ${formData.theme_config.primary}` }} />
                                    <div className="h-20 rounded-2xl bg-black/5 dark:bg-white/5" />
                                 </div>
                              </div>
                           </div>
                        </div>

                        <hr className="border-black/5 dark:border-white/5" />

                        <div className="grid grid-cols-2 gap-8">
                           {/* LIGHT OVERRIDES */}
                           <div className="space-y-4">
                              <div className="flex items-center gap-2 text-sm font-bold"><Sun className="w-4 h-4 text-orange-500" /> Overrides Claro</div>
                              <div className="space-y-3">
                                 <div className="flex items-center justify-between p-4 bg-white dark:bg-zinc-800 rounded-2xl border border-black/5">
                                    <span className="text-xs font-semibold opacity-60">Fundo</span>
                                    <input
                                       type="color"
                                       value={formData.theme_config.light.background}
                                       onChange={(e) => setFormData(p => ({ ...p, theme_config: { ...p.theme_config, light: { ...p.theme_config.light, background: e.target.value } } }))}
                                       className="w-8 h-8 rounded-lg cursor-pointer"
                                    />
                                 </div>
                                 <div className="flex items-center justify-between p-4 bg-white dark:bg-zinc-800 rounded-2xl border border-black/5">
                                    <span className="text-xs font-semibold opacity-60">Superfície (Cards)</span>
                                    <input
                                       type="color"
                                       value={formData.theme_config.light.surface}
                                       onChange={(e) => setFormData(p => ({ ...p, theme_config: { ...p.theme_config, light: { ...p.theme_config.light, surface: e.target.value } } }))}
                                       className="w-8 h-8 rounded-lg cursor-pointer"
                                    />
                                 </div>
                              </div>
                           </div>

                           {/* DARK OVERRIDES */}
                           <div className="space-y-4">
                              <div className="flex items-center gap-2 text-sm font-bold"><Moon className="w-4 h-4 text-indigo-400" /> Overrides Escuro</div>
                              <div className="space-y-3">
                                 <div className="flex items-center justify-between p-4 bg-white dark:bg-zinc-800 rounded-2xl border border-black/5">
                                    <span className="text-xs font-semibold opacity-60">Fundo</span>
                                    <input
                                       type="color"
                                       value={formData.theme_config.dark.background}
                                       onChange={(e) => setFormData(p => ({ ...p, theme_config: { ...p.theme_config, dark: { ...p.theme_config.dark, background: e.target.value } } }))}
                                       className="w-8 h-8 rounded-lg cursor-pointer"
                                    />
                                 </div>
                                 <div className="flex items-center justify-between p-4 bg-white dark:bg-zinc-800 rounded-2xl border border-black/5">
                                    <span className="text-xs font-semibold opacity-60">Superfície (Cards)</span>
                                    <input
                                       type="color"
                                       value={formData.theme_config.dark.surface}
                                       onChange={(e) => setFormData(p => ({ ...p, theme_config: { ...p.theme_config, dark: { ...p.theme_config.dark, surface: e.target.value } } }))}
                                       className="w-8 h-8 rounded-lg cursor-pointer"
                                    />
                                 </div>
                              </div>
                           </div>
                        </div>
                     </div>
                  )}

                  {activeTab === 'identity' && (
                     <div className="max-w-xl space-y-8 animate-in slide-in-from-right-4 duration-300">
                        <div className="space-y-3">
                           <label className="text-xs font-black uppercase tracking-widest opacity-40">Nome da Agência</label>
                           <input
                              type="text"
                              value={formData.name}
                              onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                              className="w-full bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 rounded-3xl px-6 py-4 text-lg font-display font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                              placeholder="Ex: Third Floor Agency"
                           />
                        </div>

                        <div className="space-y-3">
                           <label className="text-xs font-black uppercase tracking-widest opacity-40">Slogan / Descrição</label>
                           <input
                              type="text"
                              value={formData.slogan}
                              onChange={(e) => setFormData(p => ({ ...p, slogan: e.target.value }))}
                              className="w-full bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 rounded-3xl px-6 py-4 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                              placeholder="Ex: Criatividade que converte em resultados"
                           />
                           <p className="text-[10px] opacity-40 font-bold uppercase tracking-tighter">Este texto aparecerá no cabeçalho e rodapé dos planejamentos.</p>
                        </div>
                     </div>
                  )}
               </div>
            </div>

            {/* FOOTER */}
            <div className="p-8 border-t border-black/5 dark:border-white/5 bg-white dark:bg-zinc-900 flex justify-between items-center">
               <div className="flex items-center gap-2 opacity-40 text-xs font-bold uppercase tracking-widest">
                  <Check className="w-4 h-4" /> Alterações salvas no Ecossistema
               </div>

               <div className="flex gap-4">
                  <button
                     onClick={onClose}
                     className="px-8 py-4 rounded-2xl text-sm font-bold opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                  >
                     Cancelar
                  </button>
                  <button
                     onClick={handleSave}
                     disabled={isSaving}
                     className={cn(
                        "px-10 py-4 bg-primary text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2",
                        isSaving && "opacity-50 cursor-wait"
                     )}
                  >
                     {isSaving ? 'Salvando...' : <><Save className="w-5 h-5" /> Update Ecosystem</>}
                  </button>
               </div>
            </div>
         </div>

         {cropData && (
            <ImageCropperModal
               image={cropData.image}
               onClose={() => setCropData(null)}
               onCropComplete={handleCropComplete}
               circular={false}
            />
         )}
      </div>
   );
}
