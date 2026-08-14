import React from "react";
import {
  Calendar,
  Save,
  Layers,
  X,
  Mic,
  Square,
  Download,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { ClientData } from "../../types";
import { Textarea } from "../../components/ui/Textarea/Textarea";
import { Input } from "../../components/ui/Input/Input";
import { Button } from "../../components/ui/Button/Button";
import { IconButton } from "../../components/ui/IconButton/IconButton";
import styles from "./ClientStrategyEditor.module.css";

type ClientStrategyEditorProps = {
  selectedClient: ClientData;
  setSelectedClient: (client: ClientData) => void;
  clients: ClientData[];
  onSelectClient: (
    client: ClientData,
    role?: string,
    destination?: string,
  ) => void;
  userRole: string;
  saving: boolean;
  handleSave: () => Promise<void>;
  newTagInput: string;
  setNewTagInput: (val: string) => void;
  handleAddTag: (e: React.KeyboardEvent) => void;
  handleRemoveTag: (tag: string) => void;
  isRecording: boolean;
  recordingTime: number;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  cancelRecording: () => void;
  handleDeleteAudio: (audioId: string) => void;
  formatTimer: (secs: number) => string;
};

export function ClientStrategyEditor({
  selectedClient,
  setSelectedClient,
  clients,
  onSelectClient,
  userRole,
  saving,
  handleSave,
  newTagInput,
  setNewTagInput,
  handleAddTag,
  handleRemoveTag,
  isRecording,
  recordingTime,
  startRecording,
  stopRecording,
  cancelRecording,
  handleDeleteAudio,
  formatTimer,
}: ClientStrategyEditorProps) {
  return (
    <div className={styles.editor}>
      <div className={styles.container}>
        <div className={styles.topbar}>
          <div className={styles.identity}>
            <div className={styles.avatar}>
              {selectedClient.name ? selectedClient.name.substring(0, 2) : "?"}
            </div>

            {selectedClient.id.startsWith("cli_") &&
            !clients.some((c) => c.id === selectedClient.id) ? (
              <div className={styles.nameField}>
                <span className={styles.fieldCaption}>
                  Nome da Marca
                </span>
                <Input
                  type="text"
                  value={selectedClient.name}
                  onChange={(e) =>
                    setSelectedClient({
                      ...selectedClient,
                      name: e.target.value,
                    })
                  }
                  className="w-full"
                  placeholder="Coca-Cola, etc."
                />
              </div>
            ) : (
              <div className={styles.clientTitle}>
                <h2>
                  {selectedClient.name}
                </h2>
                <span className={styles.profileCaption}>
                  Perfil Estratégico
                </span>
              </div>
            )}
          </div>

          <div className={styles.topActions}>
            {clients.some((c) => c.id === selectedClient.id) && (
              <Button
                onClick={() =>
                  onSelectClient(selectedClient, userRole, "editor")
                }
                variant="glass"
                icon={<Calendar />}
              >
                Abrir Calendário
              </Button>
            )}

            <Button
              onClick={handleSave}
              loading={saving}
              variant="primary"
              icon={<Save />}
            >
              {saving ? "Salvando..." : "Salvar Briefing"}
            </Button>
          </div>
        </div>

        <div className={styles.scrollArea}>
          <div className={styles.panel}>
            <h3 className={styles.sectionTitle}>
              <Layers /> Classificação
              Estratégica
            </h3>

            <div className={styles.classificationGrid}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>
                  Setor de Atuação
                </label>
                <Input
                  type="text"
                  value={selectedClient.config?.sector || ""}
                  onChange={(e) => {
                    const config = selectedClient.config || {
                      activeDays: [1, 3, 5],
                      defaultTypes: {},
                    };
                    setSelectedClient({
                      ...selectedClient,
                      config: { ...config, sector: e.target.value },
                    });
                  }}
                  className="w-full"
                  placeholder="Ex: Alimentos, Tecnologia, Moda..."
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>
                  Tags (digite e aperte Enter)
                </label>
                <Input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  className="w-full"
                  placeholder="Adicione tags..."
                />
              </div>
            </div>

            {selectedClient.config?.tags &&
              selectedClient.config.tags.length > 0 && (
                <div className={styles.tagList}>
                  {selectedClient.config.tags.map((t) => (
                    <span
                      key={t}
                      className={styles.tag}
                    >
                      #{t}
                      <IconButton
                        onClick={() => handleRemoveTag(t)}
                        label={`Remover tag ${t}`}
                        size="small"
                      >
                        <X />
                      </IconButton>
                    </span>
                  ))}
                </div>
              )}
          </div>

          <div className={styles.fieldGrid}>
            {[
              {
                label: "Briefing Geral",
                key: "briefing",
                placeholder:
                  "Resuma os valores, tom de voz e propósito da marca...",
              },
              {
                label: "Objetivos do Cliente",
                key: "objectives",
                placeholder:
                  "O que o cliente quer alcançar? (Vendas, Leads, Branding, Engajamento...)",
              },
              {
                label: "Público-Alvo (Persona)",
                key: "targetAudience",
                placeholder:
                  "Idade, interesses, dores e aspirações do cliente ideal...",
              },
              {
                label: "Principais Concorrentes",
                key: "competitors",
                placeholder:
                  "Links e nomes de marcas concorrentes de referência...",
              },
              {
                label: "Diretrizes de Tráfego Pago",
                key: "trafficDef",
                placeholder:
                  "Canais de investimento, budget aproximado, landing pages...",
              },
              {
                label: "Inputs e Entregáveis",
                key: "inputs",
                placeholder:
                  "Como o cliente enviará os insumos? Fotos, vídeos brutos, etc...",
              },
            ].map((field) => {
              const config = selectedClient.config || {
                activeDays: [1, 3, 5],
                defaultTypes: {},
              };
              return (
                <div key={field.key} className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>
                    {field.label}
                  </label>
                  <Textarea
                    label={field.label}
                    value={(config as any)[field.key] || ""}
                    onChange={(e) => {
                      const updatedConfig = {
                        ...config,
                        [field.key]: e.target.value,
                      };
                      setSelectedClient({
                        ...selectedClient,
                        config: updatedConfig,
                      });
                    }}
                    rows={4}
                    className="w-full"
                    placeholder={field.placeholder}
                  />
                </div>
              );
            })}
          </div>

          <div className={styles.panel}>
            <div className={styles.recordingsHeader}>
              <h3 className={styles.sectionTitle}>
                <Mic /> Reuniões & Briefings
                Gravados
              </h3>

              {isRecording ? (
                <div className={styles.recordingStatus}>
                  <div className={styles.recordingDot} />
                  <span className={styles.recordingTime}>
                    {formatTimer(recordingTime)}
                  </span>
                  <div className={styles.recordingDivider} />
                  <IconButton
                    onClick={stopRecording}
                    label="Parar e salvar"
                    variant="danger"
                    size="small"
                  >
                    <Square />
                  </IconButton>
                  <IconButton
                    onClick={cancelRecording}
                    label="Cancelar"
                    variant="danger"
                    size="small"
                  >
                    <X />
                  </IconButton>
                </div>
              ) : (
                <Button
                  onClick={startRecording}
                  variant="danger"
                  icon={<Mic />}
                >
                  Gravar Alinhamento
                </Button>
              )}
            </div>

            {selectedClient.config?.audioRecordings &&
            selectedClient.config.audioRecordings.length > 0 ? (
              <div className={styles.recordingsGrid}>
                {selectedClient.config.audioRecordings.map((audio: any) => (
                  <div
                    key={audio.id}
                    className={styles.audioCard}
                  >
                    <div className={styles.audioHeader}>
                      <span className={styles.audioName}>
                        {audio.name}
                      </span>
                      <span className={styles.audioDate}>
                        {format(new Date(audio.createdAt), "dd/MM/yy HH:mm")}
                      </span>
                    </div>

                    <audio
                      src={audio.url}
                      controls
                      className={styles.audioPlayer}
                    />

                    <div className={styles.audioActions}>
                      <a
                        href={audio.url}
                        download={audio.name}
                        className={styles.download}
                        title="Baixar"
                      >
                        <Download />
                      </a>
                      <IconButton
                        onClick={() => handleDeleteAudio(audio.id)}
                        label="Excluir áudio"
                        variant="danger"
                        size="small"
                      >
                        <Trash2 />
                      </IconButton>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.empty}>
                Nenhuma gravação de reunião vinculada a este cliente.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
