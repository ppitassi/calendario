import { Sparkles } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { POST_TYPES } from "../../lib/constants";
import { ClientData, PostData } from "../../types";
import { EditorCapabilities } from "../../lib/editor-capabilities";
import { SmartMediaUploader } from "../../components/SmartMediaUploader";
import { PlannerEditorFields } from "./PlannerEditorFields";
import { useState } from "react";
import { cn } from "../../lib/utils";
import styles from "./PlannerEditor.module.css";
import { Select } from "../../components/ui/Select/Select";
import { Input } from "../../components/ui/Input/Input";
import { Textarea } from "../../components/ui/Textarea/Textarea";
import { Button } from "../../components/ui/Button/Button";
import { Modal } from "../../components/ui/Modal/Modal";

type PlannerEditorFormProps = {
  currentPost: PostData;
  currentClient: ClientData | null;
  selectedDateStr: string;
  updateCurrentPost: (updates: Partial<PostData>) => void;
  editorCapabilities: EditorCapabilities;
  isGeneratingPost: boolean;
  isGeneratingMonth: boolean;
  generateCurrentPostFields: () => Promise<void>;
  generateMonthFields: () => Promise<void>;
};

export function PlannerEditorForm({
  currentPost,
  currentClient,
  selectedDateStr,
  updateCurrentPost,
  editorCapabilities,
  isGeneratingPost,
  isGeneratingMonth,
  generateCurrentPostFields,
  generateMonthFields,
}: PlannerEditorFormProps) {
  const [activePanel, setActivePanel] = useState<"content" | "media" | "notes">("content");
  const panels: Array<{ id: "content" | "media" | "notes"; label: string }> = [
    { id: "content", label: "Conteúdo" },
    ...(editorCapabilities.canUploadArtwork ? [{ id: "media" as const, label: "Mídia" }] : []),
    ...(editorCapabilities.canViewInternalNotes ? [{ id: "notes" as const, label: "Notas" }] : []),
  ];
  return (
    <div className={styles.formRoot}>
      {editorCapabilities.canEditCopy && (
        <div className={cn(styles.aiActions, "flex shrink-0 flex-wrap items-center gap-2 mb-2")}>
          <Button
            onClick={generateCurrentPostFields}
            disabled={isGeneratingPost || isGeneratingMonth}
            variant="primary"
            size="small"
            loading={isGeneratingPost}
            icon={<Sparkles />}
          >
            {isGeneratingPost ? "LeIA está gerando..." : "Gerar com LeIA"}
          </Button>
          <Button
            onClick={generateMonthFields}
            disabled={isGeneratingPost || isGeneratingMonth}
            variant="glass"
            size="small"
            loading={isGeneratingMonth}
            icon={<Sparkles />}
          >
            {isGeneratingMonth
              ? "LeIA está gerando o mês..."
              : "Gerar mês com LeIA"}
          </Button>
        </div>
      )}

      {/* Título Interno Document-Style */}
      <div className={styles.tabs} role="tablist" aria-label="Seções da publicação">
        {panels.map((panel) => (
          <Button key={panel.id} role="tab" aria-selected={activePanel === panel.id} onClick={() => setActivePanel(panel.id)} size="small" variant={activePanel === panel.id ? "primary" : "ghost"}>
            {panel.label}
          </Button>
        ))}
      </div>

      {activePanel === "content" && <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Textarea
        value={currentPost.title || ""}
        onChange={(e) => updateCurrentPost({ title: e.target.value })}
        rows={1}
        placeholder="Título interno da publicação..."
        className="shrink-0 w-full mb-2"
      />

      {/* Properties Grid */}
      <div className={cn(styles.metaGrid, "grid shrink-0 grid-cols-4 gap-x-2 gap-y-1")}>
        <div className={styles.metaField}>
          <span>
            Data
          </span>
          <strong>
            {format(
              new Date(selectedDateStr + "T12:00:00"),
              "EEEE, dd 'de' MMMM",
              { locale: ptBR },
            )}
          </strong>
        </div>
        <div className={styles.metaField}>
          <span>
            Formato
          </span>
          <Select
            value={currentPost.type}
            onChange={(e) =>
              updateCurrentPost({ type: e.target.value as any })
            }
            className="w-full"
          >
            {POST_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
        <div className={styles.metaField}>
          <span>
            Canal
          </span>
          <Input
            type="text"
            value={currentPost.channel || ""}
            onChange={(e) => updateCurrentPost({ channel: e.target.value })}
            placeholder="Instagram, LinkedIn..."
            className="w-full"
          />
        </div>
        <div className={styles.metaField}>
          <span>
            Prazo
          </span>
          <Input
            type="date"
            value={
              currentPost.deadline
                ? typeof currentPost.deadline === "string" &&
                  /^\d{4}-\d{2}-\d{2}$/.test(currentPost.deadline)
                  ? currentPost.deadline
                  : format(new Date(currentPost.deadline), "yyyy-MM-dd")
                : ""
            }
            onChange={(e) => updateCurrentPost({ deadline: e.target.value })}
          />
        </div>
      </div>

      <PlannerEditorFields
        currentPost={currentPost}
        updateCurrentPost={updateCurrentPost}
        editorCapabilities={editorCapabilities}
      />
      </div>}

      {/* Bloco Mídia */}
      {activePanel === "media" && editorCapabilities.canUploadArtwork && (
        <Modal open onClose={() => setActivePanel("content")} title="Galeria de Mídia do Post" className="w-full max-w-3xl">
          <div className="min-h-0 overflow-y-auto pr-1">
            <SmartMediaUploader currentPost={currentPost} onUpdate={updateCurrentPost} clientId={currentClient?.id} />
          </div>
        </Modal>
      )}

      {/* Bloco Observações Internas */}
      {activePanel === "notes" && editorCapabilities.canViewInternalNotes && (
        <div className={styles.notesPanel}>
          <span>
            Observações Internas (Equipe)
          </span>
          <Textarea
            value={currentPost.internalNotes || ""}
            onChange={(e) =>
              updateCurrentPost({ internalNotes: e.target.value })
            }
            placeholder="Nota ou alinhamento privado para a equipe de design/atendimento..."
            rows={3}
            readOnly={!editorCapabilities.canEditInternalNotes}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
}
