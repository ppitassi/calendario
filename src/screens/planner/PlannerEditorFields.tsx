import { cn } from "../../lib/utils";
import { PostData } from "../../types";
import { EditorCapabilities } from "../../lib/editor-capabilities";
import styles from "./PlannerEditor.module.css";
import { Select } from "../../components/ui/Select/Select";
import { Input } from "../../components/ui/Input/Input";
import { Textarea } from "../../components/ui/Textarea/Textarea";

type PlannerEditorFieldsProps = {
  currentPost: PostData;
  updateCurrentPost: (updates: Partial<PostData>) => void;
  editorCapabilities: EditorCapabilities;
};

export function PlannerEditorFields({
  currentPost,
  updateCurrentPost,
  editorCapabilities,
}: PlannerEditorFieldsProps) {
  return (
    <div className={cn(styles.fields, "min-h-0 flex-1 grid-cols-6 gap-2 overflow-hidden text-left")}>
      {!editorCapabilities.canEditCopy ? (
        <section
          aria-label="Copy da arte"
          className={cn(styles.readonlyCopy, "col-span-6 grid min-w-0 grid-cols-2 gap-2")}
        >
          <div className="min-w-0 overflow-hidden">
            <span className={styles.fieldLabel}>
              Head
            </span>
            <p
              className={styles.readonlyHead}
              data-empty={!(currentPost.head || currentPost.artHeadline) || undefined}
            >
              {currentPost.head ||
                currentPost.artHeadline ||
                "Head não definida"}
            </p>
          </div>
          <div className={styles.readonlySubhead}>
            <span className={styles.fieldLabel}>
              Subhead
            </span>
            <p
              className={styles.readonlySubheadText}
              data-empty={!currentPost.subhead || undefined}
            >
              {currentPost.subhead || "Subhead não definida"}
            </p>
          </div>
        </section>
      ) : (
        <>
          <div className={cn(styles.field, "col-span-3")}>
            <span className={styles.fieldLabel}>
              Head (Título da Arte)
            </span>
            <Input
              type="text"
              value={currentPost.head || currentPost.artHeadline || ""}
              onChange={(e) => {
                const val = e.target.value;
                updateCurrentPost({ head: val, artHeadline: val });
              }}
              placeholder="Texto de destaque na arte visual..."
              className="w-full"
            />
          </div>

          <div className={cn(styles.field, "col-span-3")}>
            <span className={styles.fieldLabel}>
              Subhead
            </span>
            <Input
              type="text"
              value={currentPost.subhead || ""}
              onChange={(e) => updateCurrentPost({ subhead: e.target.value })}
              placeholder="Subtítulo ou texto secundário da arte..."
              className="w-full"
            />
          </div>
        </>
      )}

      <div className={cn(styles.field, "col-span-6 row-start-2 flex min-h-0 flex-col")}>
        <span className={styles.fieldLabel}>
          Legenda
        </span>
        <Textarea
          value={currentPost.subtitle || currentPost.caption || ""}
          onChange={(e) => {
            const val = e.target.value;
            updateCurrentPost({ subtitle: val, caption: val });
          }}
          placeholder="Texto completo da legenda da publicação..."
          rows={4}
          className={cn(styles.captionScroll, "flex-1 w-full")}
        />
      </div>

      <div className={cn(styles.field, "col-span-2")}>
        <span className={styles.fieldLabel}>
          Objetivo
        </span>
        <Input
          type="text"
          value={currentPost.objective || ""}
          onChange={(e) => updateCurrentPost({ objective: e.target.value })}
          placeholder="Ex: Gerar engajamento, captar leads, branding..."
          className="w-full"
        />
      </div>

      <div className={cn(styles.field, "col-span-2")}>
        <span className={styles.fieldLabel}>
          Restante do briefing para a arte
        </span>
        <Textarea
          value={currentPost.visualBriefing || currentPost.artText || ""}
          onChange={(e) => {
            const val = e.target.value;
            updateCurrentPost({ visualBriefing: val, artText: val });
          }}
          placeholder="Orientação detalhada de design, referências ou texto interno..."
          rows={1}
          className="w-full"
        />
      </div>

      <div className={cn(styles.field, "col-span-2")}>
        <span className={styles.fieldLabel}>
          Etapa do Funil
        </span>
        <Select
          value={currentPost.funnelStage || "topo"}
          onChange={(e) =>
            updateCurrentPost({
              funnelStage: e.target.value as PostData["funnelStage"],
            })
          }
        >
          <option value="topo">Topo (Atração)</option>
          <option value="meio">Meio (Nutrição/Autoridade)</option>
          <option value="fundo">Fundo (Conversão)</option>
        </Select>
      </div>
    </div>
  );
}
