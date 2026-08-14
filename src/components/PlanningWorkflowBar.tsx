import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowRight, ChevronDown } from "lucide-react";
import { api } from "../lib/api";
import { PostData } from "../types";
import { useNotifications } from "../contexts/NotificationContext";
import { Button } from "./ui/Button/Button";
import styles from "./PlanningWorkflowBar.module.css";

type Props = {
  clientId: string;
  month: string;
  posts: Record<string, PostData>;
  onRefresh: () => Promise<void> | void;
  onConfigure: () => void;
  compact?: boolean;
};

export function PlanningWorkflowBar({ clientId, month, posts, onRefresh, onConfigure, compact = false }: Props) {
  const [id] = useState(() => encodeURIComponent(clientId) + "__" + month);
  const [state, setState] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState(false);
  const { toast } = useNotifications();
  const workflowRevision = useMemo(
    () =>
      Object.values(posts)
        .filter((post) => String(post.date || "").startsWith(month))
        .map((post) =>
          [
            post.id,
            post.workVersion,
            post.currentStage,
            post.artworkCurrentVersion,
            post.head,
            post.subhead,
            post.caption,
            post.subtitle,
          ].join(":"),
        )
        .sort()
        .join("|"),
    [posts, month],
  );
  const load = () => api.getPlanningWorkflow(id).then(setState).catch(() => setState(null));

  useEffect(() => {
    void load();
  }, [id, workflowRevision]);

  if (!state) return null;
  const phase = state.phase || "copy";
  const action =
    phase === "copy"
      ? "Enviar para o designer"
      : phase === "design"
        ? "Enviar para aprovação"
        : state.completion?.enabled
          ? "Concluir planejamento"
          : null;
  const enabled =
    phase === "copy" ? state.copy.enabled : phase === "design" ? state.artwork.enabled : Boolean(state.completion?.enabled);
  const summary =
    phase === "copy"
      ? `${state.total - new Set((state.copy.blocks || []).map((item: any) => item.postId)).size} de ${state.total} postagens completas`
      : phase === "design"
        ? `${state.artwork.ready} de ${state.total} artes prontas`
        : `${state.counts.published} publicadas · ${state.counts.scheduled} agendadas · ${state.counts.changes} com ajustes`;
  const blocks = phase === "copy" ? state.copy.blocks : state.artwork.blocks;
  const compactSummary =
    phase === "copy"
      ? `${state.total - new Set((state.copy.blocks || []).map((item: any) => item.postId)).size}/${state.total} posts`
      : phase === "design"
        ? `${state.artwork.ready}/${state.total} artes`
        : `${state.counts.published}/${state.total} publicados`;
  const compactAction =
    phase === "copy"
      ? "Enviar ao design"
      : phase === "design"
        ? "Enviar à aprovação"
        : action;

  const run = async () => {
    if (!action || !enabled || busy) return;
    setBusy(true);
    try {
      phase === "copy"
        ? await api.sendPlanningToDesign(id)
        : phase === "design"
          ? await api.sendPlanningToApproval(id)
          : await api.completePlanning(id);
      toast(`${action} concluído.`, "success");
      await onRefresh();
      await load();
    } catch (error: any) {
      toast(error?.response?.data?.error || "Não foi possível concluir o repasse.", "error");
      setState((value: any) => ({
        ...value,
        [phase === "copy" ? "copy" : "artwork"]: {
          ...value[phase === "copy" ? "copy" : "artwork"],
          blocks: error?.response?.data?.blocks || blocks,
        },
      }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section data-planning-workflow className={`${styles.root} ${compact ? styles.compact : ""}`}>
      <div className={styles.summaryRow}>
        <div className={styles.summaryText}>
          <p className={styles.phase}>
            {phase === "copy" ? "Copy" : phase === "design" ? "Design" : "Atendimento"}
          </p>
          <p className={`${styles.summary} ${compact ? styles.compactSummary : ""}`}>{compact ? compactSummary : summary}</p>
        </div>
        {action && (
          <Button
            disabled={!enabled || busy}
            onClick={() => void run()}
            className="shrink-0"
            size="small"
            variant="primary"
            loading={busy}
            icon={<ArrowRight/>}
          >
            {compact ? compactAction : action}
          </Button>
        )}
      </div>
      {blocks?.length > 0 && (
        <>
          <Button
            onClick={() => setDetails((value) => !value)}
            className={compact?"mt-1":"mt-2"}
            size="small"
            variant="ghost"
          >
            <AlertCircle />
            {compact
              ? `${phase === "copy" ? new Set(blocks.map((item: any) => item.postId)).size : blocks.length} pendentes`
              : phase === "copy"
                ? `${new Set(blocks.map((item: any) => item.postId)).size} postagens ainda precisam de conteúdo.`
                : `${blocks.length} postagens pendentes.`}
            <ChevronDown />
          </Button>
          {details && (
            <div className={`${styles.details} ${compact ? styles.compactDetails : ""}`}>
              {blocks.map((block: any, index: number) => (
                <div key={index} className={styles.block}>
                  {block.title}: {block.field || block.reason}
                </div>
              ))}
              {String(blocks[0]?.reason || "").includes("responsável") && (
                <Button onClick={onConfigure} size="small" variant="ghost">
                  Configurar equipe
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
