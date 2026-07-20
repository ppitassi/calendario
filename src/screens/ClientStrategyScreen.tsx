import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ArrowLeft, 
  Search, 
  Plus, 
  Filter, 
  Tag, 
  Save, 
  Calendar, 
  Mic, 
  Square, 
  Play, 
  Trash2, 
  Download, 
  Check, 
  X, 
  HelpCircle, 
  Briefcase,
  Layers,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../lib/api';
import { auth } from '../lib/auth';
import { ClientData } from '../types';
import { cn } from '../lib/utils';
import { MainLayout } from '../components/MainLayout';
import { useNotifications } from '../contexts/NotificationContext';
import { format } from 'date-fns';

interface ClientStrategyScreenProps {
  currentClient: ClientData | null;
  onSelectClient: (client: ClientData, role?: string, destination?: string) => void;
  onNavigate: (screen: string) => void;
}

export function ClientStrategyScreen({ currentClient, onSelectClient, onNavigate }: ClientStrategyScreenProps) {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useNotifications();

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Audio Recorder States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioTitle, setAudioTitle] = useState('');
  const [showAudioSaveModal, setShowAudioSaveModal] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);

  // Tag editing temp state
  const [newTagInput, setNewTagInput] = useState('');

  const currentUser = auth.currentUser;
  const userRole = currentUser?.role || 'designer';

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const loaded = await api.getClients();
      setClients(loaded);
      
      // Auto-select client if one is active globally
      if (currentClient) {
        const matched = loaded.find(c => c.id === currentClient.id);
        if (matched) setSelectedClient(matched);
      }
    } catch (e) {
      console.error("Error loading clients", e);
    } finally {
      setLoading(false);
    }
  };

  // List of unique sectors and tags for filters
  const allSectors = useMemo(() => {
    const sectors = new Set<string>();
    clients.forEach(c => {
      if (c.config?.sector) sectors.add(c.config.sector);
    });
    return Array.from(sectors);
  }, [clients]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    clients.forEach(c => {
      c.config?.tags?.forEach((t: string) => tags.add(t));
    });
    return Array.from(tags);
  }, [clients]);

  // Filter clients
  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSector = !sectorFilter || c.config?.sector === sectorFilter;
      const matchesTag = !tagFilter || c.config?.tags?.includes(tagFilter);
      const isOwner = c.owners?.includes(currentUser?.uid || '');
      const isAdmin = ['admin', 'gerente', 'atendimento'].includes(userRole);
      return matchesSearch && matchesSector && matchesTag && (isAdmin || isOwner);
    });
  }, [clients, searchTerm, sectorFilter, tagFilter, userRole, currentUser]);

  const handleCreateDraft = () => {
    const draftId = 'cli_' + Math.random().toString(36).substring(2, 10);
    const draft: ClientData = {
      id: draftId,
      name: '',
      socialLinks: {},
      owners: [currentUser?.uid || ''],
      config: {
        activeDays: [1, 3, 5],
        defaultTypes: { 1: 'post', 3: 'carousel', 5: 'reel' },
        sector: '',
        tags: [],
        briefing: '',
        objectives: '',
        competitors: '',
        targetAudience: '',
        trafficDef: '',
        inputs: '',
        audioRecordings: []
      }
    };
    setSelectedClient(draft);
  };

  const handleSave = async () => {
    if (!selectedClient) return;
    if (!selectedClient.name.trim()) {
      toast("Por favor, informe o nome da marca/cliente.", "error");
      return;
    }

    setSaving(true);
    try {
      await api.saveClient(selectedClient);
      toast("Direcionamento salvo com sucesso!", "success");
      
      // Update local list
      await fetchClients();
      
      // If we just saved the current client, update global state
      if (currentClient && currentClient.id === selectedClient.id) {
        onSelectClient(selectedClient);
      }
    } catch (e) {
      toast("Erro ao salvar direcionamento.", "error");
    } finally {
      setSaving(false);
    }
  };

  // Dynamic tags cloud logic
  const handleAddTag = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ',') && selectedClient) {
      e.preventDefault();
      const tagStr = newTagInput.trim().replace(/#/g, '');
      if (!tagStr) return;
      
      const config = selectedClient.config || { activeDays: [1,3,5], defaultTypes: {} };
      const currentTags = config.tags || [];
      if (!currentTags.includes(tagStr)) {
        const updatedConfig = { ...config, tags: [...currentTags, tagStr] };
        setSelectedClient({ ...selectedClient, config: updatedConfig });
      }
      setNewTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (!selectedClient) return;
    const config = selectedClient.config || { activeDays: [1,3,5], defaultTypes: {} };
    const currentTags = config.tags || [];
    const updatedConfig = { ...config, tags: currentTags.filter(t => t !== tagToRemove) };
    setSelectedClient({ ...selectedClient, config: updatedConfig });
  };

  // Audio recording logic
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setAudioTitle(`Alinhamento - ${format(new Date(), 'dd/MM/yyyy')}`);
        setShowAudioSaveModal(true);
        
        // Stop all track devices
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      toast("Permissão de microfone negada ou erro ao iniciar gravação.", "error");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerIntervalRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerIntervalRef.current);
      // Discard recorded chunks
      setTimeout(() => {
        setAudioBlob(null);
        setAudioUrl(null);
        setShowAudioSaveModal(false);
      }, 100);
    }
  };

  const saveRecordedAudio = async () => {
    if (!audioBlob || !selectedClient) return;

    // Convert blob to base64
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = async () => {
      const base64data = reader.result as string;
      try {
        toast("Enviando gravação de áudio...", "info");
        const finalUrl = await api.uploadAudio(base64data, `meeting_${selectedClient.id}_${Date.now()}`);
        
        const config = selectedClient.config || { activeDays: [1,3,5], defaultTypes: {} };
        const audios = config.audioRecordings || [];
        const newAudioItem = {
          id: `aud_${Date.now()}`,
          name: audioTitle || `Gravação ${format(new Date(), 'dd/MM')}`,
          url: finalUrl,
          createdAt: Date.now(),
          duration: recordingTime
        };

        const updatedConfig = { ...config, audioRecordings: [...audios, newAudioItem] };
        setSelectedClient({ ...selectedClient, config: updatedConfig });
        
        setShowAudioSaveModal(false);
        setAudioBlob(null);
        setAudioUrl(null);
        toast("Gravação salva com sucesso!", "success");
      } catch (err) {
        toast("Erro ao processar arquivo de áudio.", "error");
      }
    };
  };

  const handleDeleteAudio = (audioId: string) => {
    if (!selectedClient) return;
    const config = selectedClient.config || { activeDays: [1,3,5], defaultTypes: {} };
    const audios = config.audioRecordings || [];
    const updatedConfig = { ...config, audioRecordings: audios.filter(a => a.id !== audioId) };
    setSelectedClient({ ...selectedClient, config: updatedConfig });
    toast("Áudio removido do briefing (salve para persistir).", "info");
  };

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  return (
    <MainLayout activeScreen="client_strategy" onNavigate={onNavigate} currentClient={currentClient}>
      <div className="flex-1 flex gap-8 p-8 max-w-7xl mx-auto w-full h-[calc(100vh-80px)] overflow-hidden">
        
        {/* LEFT COLUMN: LIST & FILTERS (35% width) */}
        <div className="w-[35%] flex flex-col gap-6 h-full border-r border-black/5 dark:border-white/5 pr-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-display font-black tracking-tight text-left">Gestão Estratégica</h1>
            <p className="text-[10px] font-bold uppercase opacity-40 tracking-wider text-left">Alinhamento de Conteúdo & Briefings</p>
          </div>

          <button 
            onClick={handleCreateDraft}
            className="flex items-center justify-center gap-2 w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-bold uppercase text-xs transition-all shadow-lg shadow-purple-600/20 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" /> Novo Briefing / Cliente
          </button>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-35" />
            <input 
              type="text"
              placeholder="Buscar por marca..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-2xl pl-12 pr-10 py-3.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-600/40"
            />
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all",
                showFilters ? "bg-purple-600/10 text-purple-600" : "opacity-40 hover:opacity-100"
              )}
            >
              <Filter className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Advanced Filters Drawer */}
          <AnimatePresence>
            {showFilters && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5 p-4 space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 text-left">
                    <label className="text-[9px] font-black uppercase opacity-45 ml-1">Setor</label>
                    <select 
                      value={sectorFilter} 
                      onChange={e => setSectorFilter(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-800 border border-black/5 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-semibold"
                    >
                      <option value="">Todos</option>
                      {allSectors.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1.5 text-left">
                    <label className="text-[9px] font-black uppercase opacity-45 ml-1">Tag</label>
                    <select 
                      value={tagFilter} 
                      onChange={e => setTagFilter(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-800 border border-black/5 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-semibold"
                    >
                      <option value="">Todas</option>
                      {allTags.map(t => <option key={t} value={t}>#{t}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button 
                    onClick={() => { setSectorFilter(''); setTagFilter(''); setSearchTerm(''); }}
                    className="text-[9px] font-black uppercase text-rose-500 hover:underline"
                  >
                    Limpar Filtros
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Client List */}
          <div className="flex-1 overflow-y-auto pr-1 no-scrollbar space-y-3">
            {loading ? (
              <div className="text-center py-10 opacity-30 italic text-xs animate-pulse">Carregando direcionamentos...</div>
            ) : filteredClients.length > 0 ? (
              filteredClients.map(c => {
                const isSelected = selectedClient && selectedClient.id === c.id;
                return (
                  <div 
                    key={c.id}
                    onClick={() => setSelectedClient(c)}
                    className={cn(
                      "p-4 rounded-2xl border text-left cursor-pointer transition-all flex flex-col gap-3 group relative overflow-hidden",
                      isSelected 
                        ? "bg-purple-500/10 border-purple-600/30 text-purple-700 dark:text-purple-400" 
                        : "bg-white/50 dark:bg-zinc-900/40 border-black/5 dark:border-white/5 hover:border-purple-600/30"
                    )}
                  >
                    <div className="flex items-center gap-3 relative z-10">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                        {c.name ? c.name.substring(0, 2) : '?'}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-sm truncate">{c.name || <span className="italic opacity-30">Sem nome</span>}</span>
                        {c.config?.sector && (
                          <span className="text-[9px] font-bold text-purple-600 dark:text-purple-400 opacity-80 mt-0.5">{c.config.sector}</span>
                        )}
                      </div>
                    </div>

                    {c.config?.tags && c.config.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 relative z-10">
                        {c.config.tags.slice(0, 3).map((tag: string) => (
                          <span key={tag} className="px-2 py-0.5 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-full text-[8px] font-semibold opacity-70">
                            #{tag}
                          </span>
                        ))}
                        {c.config.tags.length > 3 && (
                          <span className="text-[8px] font-bold opacity-30 px-1">+{c.config.tags.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-20 opacity-40 text-xs italic">Nenhum cliente ou direcionamento encontrado.</div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: EDITOR & BRIEFING DETAILS (65% width) */}
        <div className="w-[65%] flex flex-col h-full bg-white/50 dark:bg-zinc-900/40 border border-black/5 dark:border-white/10 rounded-[3rem] p-8 shadow-sm overflow-hidden">
          <AnimatePresence mode="wait">
            {selectedClient ? (
              <motion.div 
                key={selectedClient.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="flex flex-col h-full gap-6 overflow-hidden"
              >
                {/* Header of Strategy Profile */}
                <div className="flex items-center justify-between pb-4 border-b border-black/5 dark:border-white/5 shrink-0">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-display font-black uppercase text-sm">
                      {selectedClient.name ? selectedClient.name.substring(0, 2) : '?'}
                    </div>
                    
                    {/* Render input if new brand draft, else label */}
                    {selectedClient.id.startsWith('cli_') && !clients.some(c => c.id === selectedClient.id) ? (
                      <div className="flex flex-col items-start gap-1 w-full max-w-sm">
                        <span className="text-[9px] font-black uppercase opacity-40 tracking-widest leading-none">Nome da Marca</span>
                        <input 
                          type="text"
                          value={selectedClient.name}
                          onChange={e => setSelectedClient({ ...selectedClient, name: e.target.value })}
                          className="w-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-purple-600"
                          placeholder="Coca-Cola, etc."
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col text-left">
                        <h2 className="font-display font-black text-xl leading-none">{selectedClient.name}</h2>
                        <span className="text-[9px] font-black uppercase opacity-40 mt-1.5 tracking-wider">Perfil Estratégico</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Shortcut to calendar if not a new unsaved client */}
                    {clients.some(c => c.id === selectedClient.id) && (
                      <button
                        onClick={() => onSelectClient(selectedClient, userRole, 'editor')}
                        className="flex items-center gap-2 px-4 py-3 bg-purple-600/10 hover:bg-purple-600/25 text-purple-600 dark:text-purple-400 rounded-xl font-bold uppercase text-[9px] tracking-wider transition-all border border-purple-500/15"
                      >
                        <Calendar className="w-3.5 h-3.5" /> Abrir Calendário
                      </button>
                    )}
                    
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-2 px-5 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold uppercase text-[9px] tracking-wider transition-all shadow-md shadow-purple-600/15 disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" /> {saving ? 'Salvando...' : 'Salvar Briefing'}
                    </button>
                  </div>
                </div>

                {/* Form fields & audio recorder */}
                <div className="flex-1 overflow-y-auto pr-2 no-scrollbar space-y-6 text-left">
                  
                  {/* Categorization & Tags Box */}
                  <div className="p-6 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-3xl space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-wider opacity-60 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-purple-600" /> Classificação Estratégica
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase opacity-45 ml-1">Setor de Atuação</label>
                        <input 
                          type="text"
                          value={selectedClient.config?.sector || ''}
                          onChange={e => {
                            const config = selectedClient.config || { activeDays: [1,3,5], defaultTypes: {} };
                            setSelectedClient({ ...selectedClient, config: { ...config, sector: e.target.value } });
                          }}
                          className="w-full bg-white dark:bg-zinc-800 border border-black/5 dark:border-white/10 rounded-xl px-4 py-3 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-purple-600"
                          placeholder="Ex: Alimentos, Tecnologia, Moda..."
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase opacity-45 ml-1">Tags (digite e aperte Enter)</label>
                        <input 
                          type="text"
                          value={newTagInput}
                          onChange={e => setNewTagInput(e.target.value)}
                          onKeyDown={handleAddTag}
                          className="w-full bg-white dark:bg-zinc-800 border border-black/5 dark:border-white/10 rounded-xl px-4 py-3 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-purple-600"
                          placeholder="Adicione tags..."
                        />
                      </div>
                    </div>

                    {/* Active tags cloud */}
                    {selectedClient.config?.tags && selectedClient.config.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {selectedClient.config.tags.map(t => (
                          <span 
                            key={t}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 rounded-full text-[10px] font-bold uppercase"
                          >
                            #{t}
                            <button 
                              onClick={() => handleRemoveTag(t)}
                              className="p-0.5 rounded-full hover:bg-purple-600 hover:text-white transition-all"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Strategic Text Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[
                      { label: 'Briefing Geral', key: 'briefing', placeholder: 'Resuma os valores, tom de voz e propósito da marca...' },
                      { label: 'Objetivos do Cliente', key: 'objectives', placeholder: 'O que o cliente quer alcançar? (Vendas, Leads, Branding, Engajamento...)' },
                      { label: 'Público-Alvo (Persona)', key: 'targetAudience', placeholder: 'Idade, interesses, dores e aspirações do cliente ideal...' },
                      { label: 'Principais Concorrentes', key: 'competitors', placeholder: 'Links e nomes de marcas concorrentes de referência...' },
                      { label: 'Diretrizes de Tráfego Pago', key: 'trafficDef', placeholder: 'Canais de investimento, budget aproximado, landing pages...' },
                      { label: 'Inputs e Entregáveis', key: 'inputs', placeholder: 'Como o cliente enviará os insumos? Fotos, vídeos brutos, etc...' },
                    ].map(field => {
                      const config = selectedClient.config || { activeDays: [1,3,5], defaultTypes: {} };
                      return (
                        <div key={field.key} className="space-y-1.5 flex flex-col">
                          <label className="text-[10px] font-black uppercase opacity-45 ml-1">{field.label}</label>
                          <textarea
                            value={(config as any)[field.key] || ''}
                            onChange={e => {
                              const updatedConfig = { ...config, [field.key]: e.target.value };
                              setSelectedClient({ ...selectedClient, config: updatedConfig });
                            }}
                            rows={4}
                            className="w-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-2xl px-5 py-4 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-purple-600 resize-y no-scrollbar"
                            placeholder={field.placeholder}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Voice Recorder & Meeting Archives */}
                  <div className="p-6 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-3xl space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-black uppercase tracking-wider opacity-60 flex items-center gap-1.5">
                        <Mic className="w-4 h-4 text-purple-600" /> Reuniões & Briefings Gravados
                      </h3>
                      
                      {/* Audio Recorder Controls */}
                      {isRecording ? (
                        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-xl">
                          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                          <span className="text-[10px] font-mono font-bold text-red-500 leading-none">{formatTimer(recordingTime)}</span>
                          <div className="h-4 w-px bg-red-500/20" />
                          <button onClick={stopRecording} className="p-1 hover:bg-red-500/20 text-red-500 rounded-lg transition-all" title="Parar e Salvar">
                            <Square className="w-3.5 h-3.5 fill-current" />
                          </button>
                          <button onClick={cancelRecording} className="p-1 hover:bg-red-500/20 text-red-500 rounded-lg transition-all" title="Cancelar">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={startRecording}
                          className="flex items-center gap-1.5 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold uppercase text-[9px] tracking-wider transition-all shadow-md shadow-red-500/15"
                        >
                          <Mic className="w-3.5 h-3.5" /> Gravar Alinhamento
                        </button>
                      )}
                    </div>

                    {/* Audio Saves List */}
                    {selectedClient.config?.audioRecordings && selectedClient.config.audioRecordings.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedClient.config.audioRecordings.map((audio: any) => (
                          <div key={audio.id} className="p-4 bg-white dark:bg-zinc-800 border border-black/5 dark:border-white/5 rounded-2xl flex flex-col gap-2 relative group/audio">
                            <div className="flex justify-between items-start">
                              <span className="text-xs font-bold truncate max-w-[70%]">{audio.name}</span>
                              <span className="text-[8px] font-mono opacity-40">{format(new Date(audio.createdAt), 'dd/MM/yy HH:mm')}</span>
                            </div>
                            
                            <audio src={audio.url} controls className="w-full h-8 mt-1 accent-purple-600" />
                            
                            {/* Float Actions */}
                            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover/audio:opacity-100 transition-opacity">
                              <a href={audio.url} download={audio.name} className="p-1 text-zinc-500 hover:text-purple-600 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-purple-600/10 transition-colors" title="Baixar">
                                <Download className="w-3.5 h-3.5" />
                              </a>
                              <button onClick={() => handleDeleteAudio(audio.id)} className="p-1 text-zinc-500 hover:text-red-500 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-red-500/10 transition-colors" title="Excluir">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-8 text-center text-xs italic opacity-40">Nenhuma gravação de reunião vinculada a este cliente.</div>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-full gap-4 opacity-40 py-20 text-center"
              >
                <div className="p-6 bg-purple-500/10 text-purple-600 rounded-[2.5rem]">
                  <Sparkles className="w-16 h-16 animate-pulse" />
                </div>
                <h3 className="font-display font-black text-xl">Direcionamento de Clientes</h3>
                <p className="text-xs max-w-sm leading-relaxed">
                  Selecione um cliente no painel esquerdo ou clique em **"+ Novo Briefing"** para gerenciar briefings, setores, concorrentes e gravações de reuniões estratégicas.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* AUDIO TITLE MODAL */}
      <AnimatePresence>
        {showAudioSaveModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowAudioSaveModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 rounded-[2.5rem] p-8 w-full max-w-sm z-10 space-y-6 text-left"
            >
              <div className="space-y-2">
                <h4 className="font-display font-black text-lg">Salvar Gravação de Reunião</h4>
                <p className="text-xs opacity-40">Dê um nome ou identificação para facilitar a busca interna da agência.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase opacity-45 ml-1">Título do Áudio</label>
                <input 
                  type="text"
                  value={audioTitle}
                  onChange={e => setAudioTitle(e.target.value)}
                  className="w-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-xl px-4 py-3 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-purple-600"
                  placeholder="Ex: Reunião Inicial de Briefing"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowAudioSaveModal(false)}
                  className="flex-1 py-3 bg-black/5 dark:bg-white/5 rounded-xl font-bold uppercase text-[10px] opacity-40 hover:opacity-100 transition-all"
                >
                  Descartar
                </button>
                <button
                  onClick={saveRecordedAudio}
                  className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold uppercase text-[10px] transition-all shadow-md shadow-purple-600/15"
                >
                  Salvar Gravação
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </MainLayout>
  );
}
