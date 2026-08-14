import React, { useState, useEffect, useMemo, useRef } from "react";
import { Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../lib/api";
import { auth } from "../lib/auth";
import { ClientData } from "../types";
import { MainLayout } from "../components/MainLayout";
import { useNotifications } from "../contexts/NotificationContext";
import { format } from "date-fns";
import { ClientStrategyList } from "./client-strategy/ClientStrategyList";
import { ClientStrategyEditor } from "./client-strategy/ClientStrategyEditor";
import { ClientStrategyAudioModal } from "./client-strategy/ClientStrategyAudioModal";
import styles from "./ClientStrategyScreen.module.css";

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

  const [searchTerm, setSearchTerm] = useState("");
  const [sectorFilter, setSectorFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => () => {
    if (audioUrl?.startsWith("blob:")) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  const [audioTitle, setAudioTitle] = useState("");
  const [showAudioSaveModal, setShowAudioSaveModal] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);

  const [newTagInput, setNewTagInput] = useState("");

  const currentUser = auth.currentUser;
  const userRole = currentUser?.role || "designer";

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const loaded = await api.getClients();
      setClients(loaded);
      if (currentClient) {
        const matched = loaded.find((c) => c.id === currentClient.id);
        if (matched) setSelectedClient(matched);
      }
    } catch (e) {
      console.error("Error loading clients", e);
    } finally {
      setLoading(false);
    }
  };

  const allSectors = useMemo(() => {
    const sectors = new Set<string>();
    clients.forEach((c) => {
      if (c.config?.sector) sectors.add(c.config.sector);
    });
    return Array.from(sectors);
  }, [clients]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    clients.forEach((c) => {
      c.config?.tags?.forEach((t: string) => tags.add(t));
    });
    return Array.from(tags);
  }, [clients]);

  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSector = !sectorFilter || c.config?.sector === sectorFilter;
      const matchesTag = !tagFilter || c.config?.tags?.includes(tagFilter);
      const isOwner = c.owners?.includes(currentUser?.uid || "");
      const isAdmin = ["admin", "gerente", "atendimento"].includes(userRole);
      return matchesSearch && matchesSector && matchesTag && (isAdmin || isOwner);
    });
  }, [clients, searchTerm, sectorFilter, tagFilter, userRole, currentUser]);

  const handleCreateDraft = () => {
    const draftId = "cli_" + Math.random().toString(36).substring(2, 10);
    const draft: ClientData = {
      id: draftId,
      name: "",
      socialLinks: {},
      owners: [currentUser?.uid || ""],
      config: {
        activeDays: [1, 3, 5],
        defaultTypes: { 1: "post", 3: "carousel", 5: "reel" },
        sector: "",
        tags: [],
        briefing: "",
        objectives: "",
        competitors: "",
        targetAudience: "",
        trafficDef: "",
        inputs: "",
        audioRecordings: [],
      },
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
      await fetchClients();
      if (currentClient && currentClient.id === selectedClient.id) {
        onSelectClient(selectedClient);
      }
    } catch (e) {
      toast("Erro ao salvar direcionamento.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === ",") && selectedClient) {
      e.preventDefault();
      const tagStr = newTagInput.trim().replace(/#/g, "");
      if (!tagStr) return;
      const config = selectedClient.config || { activeDays: [1, 3, 5], defaultTypes: {} };
      const currentTags = config.tags || [];
      if (!currentTags.includes(tagStr)) {
        const updatedConfig = { ...config, tags: [...currentTags, tagStr] };
        setSelectedClient({ ...selectedClient, config: updatedConfig });
      }
      setNewTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (!selectedClient) return;
    const config = selectedClient.config || { activeDays: [1, 3, 5], defaultTypes: {} };
    const currentTags = config.tags || [];
    const updatedConfig = { ...config, tags: currentTags.filter((t) => t !== tagToRemove) };
    setSelectedClient({ ...selectedClient, config: updatedConfig });
  };

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
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setAudioTitle(`Alinhamento - ${format(new Date(), "dd/MM/yyyy")}`);
        setShowAudioSaveModal(true);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
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
      setTimeout(() => {
        setAudioBlob(null);
        setAudioUrl(null);
        setShowAudioSaveModal(false);
      }, 100);
    }
  };

  const saveRecordedAudio = async () => {
    if (!audioBlob || !selectedClient) return;
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = async () => {
      const base64data = reader.result as string;
      try {
        toast("Enviando gravação de áudio...", "info");
        const finalUrl = await api.uploadAudio(base64data, `meeting_${selectedClient.id}_${Date.now()}`, "audio", selectedClient.id);
        const config = selectedClient.config || { activeDays: [1, 3, 5], defaultTypes: {} };
        const audios = config.audioRecordings || [];
        const newAudioItem = {
          id: `aud_${Date.now()}`,
          name: audioTitle || `Gravação ${format(new Date(), "dd/MM")}`,
          url: finalUrl,
          createdAt: Date.now(),
          duration: recordingTime,
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
    const config = selectedClient.config || { activeDays: [1, 3, 5], defaultTypes: {} };
    const audios = config.audioRecordings || [];
    const updatedConfig = { ...config, audioRecordings: audios.filter((a) => a.id !== audioId) };
    setSelectedClient({ ...selectedClient, config: updatedConfig });
    toast("Áudio removido do briefing (salve para persistir).", "info");
  };

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remainingSecs.toString().padStart(2, "0")}`;
  };

  return (
    <MainLayout activeScreen="client_strategy" onNavigate={onNavigate} currentClient={currentClient}>
      <div className={styles.workspace}>
        <ClientStrategyList
          clients={clients}
          filteredClients={filteredClients}
          selectedClient={selectedClient}
          setSelectedClient={setSelectedClient}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          sectorFilter={sectorFilter}
          setSectorFilter={setSectorFilter}
          tagFilter={tagFilter}
          setTagFilter={setTagFilter}
          showFilters={showFilters}
          setShowFilters={setShowFilters}
          allSectors={allSectors}
          allTags={allTags}
          loading={loading}
          handleCreateDraft={handleCreateDraft}
        />

        <AnimatePresence mode="wait">
          {selectedClient ? (
            <motion.div key={selectedClient.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className={styles.editorPane}>
              <ClientStrategyEditor
                selectedClient={selectedClient}
                setSelectedClient={setSelectedClient}
                clients={clients}
                onSelectClient={onSelectClient}
                userRole={userRole}
                saving={saving}
                handleSave={handleSave}
                newTagInput={newTagInput}
                setNewTagInput={setNewTagInput}
                handleAddTag={handleAddTag}
                handleRemoveTag={handleRemoveTag}
                isRecording={isRecording}
                recordingTime={recordingTime}
                startRecording={startRecording}
                stopRecording={stopRecording}
                cancelRecording={cancelRecording}
                handleDeleteAudio={handleDeleteAudio}
                formatTimer={formatTimer}
              />
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                <Sparkles />
              </div>
              <h3 className={styles.emptyTitle}>Direcionamento de Clientes</h3>
              <p className={styles.emptyDescription}>
                Selecione um cliente no painel esquerdo ou clique em **"+ Novo Briefing"** para gerenciar briefings, setores, concorrentes e gravações de reuniões estratégicas.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ClientStrategyAudioModal
        showAudioSaveModal={showAudioSaveModal}
        setShowAudioSaveModal={setShowAudioSaveModal}
        audioTitle={audioTitle}
        setAudioTitle={setAudioTitle}
        saveRecordedAudio={saveRecordedAudio}
      />
    </MainLayout>
  );
}
