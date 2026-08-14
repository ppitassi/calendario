import { useEffect, useMemo, useState } from "react";
import { History, UserRound, Clock3, X, Check } from "lucide-react";
import { api } from "../lib/api";
import { PostData, UserProfile } from "../types";
import { useNotifications } from "../contexts/NotificationContext";
import { Button } from "./ui/Button/Button";
import { IconButton } from "./ui/IconButton/IconButton";
import { Input } from "./ui/Input/Input";
import { Select } from "./ui/Select/Select";
import styles from "./PostWorkflowBar.module.css";

const STAGE_LABELS: Record<string, string> = {
  briefing: "Briefing",
  copy: "Copy",
  aguardando_design: "Aguardando design",
  design: "Design",
  revisao_interna: "Revisão interna",
  aguardando_aprovacao: "Aguardando aprovação",
  alteracoes_solicitadas: "Alterações solicitadas",
  aprovado: "Aprovado",
  agendado: "Agendado",
  publicado: "Publicado",
  arquivado: "Arquivado",
  cancelado: "Cancelado",
};
const FILTERS = [
  ["all", "Tudo"],
  ["workflow", "Workflow"],
  ["copy", "Copy"],
  ["artwork", "Artes"],
  ["approval", "Aprovação"],
  ["comments", "Comentários"],
] as const;
function relative(value?: string) {
  if (!value) return "Sem atividade";
  const delta = Date.now() - new Date(value).getTime(),
    minutes = Math.max(0, Math.floor(delta / 60000));
  if (minutes < 1) return "Agora";
  if (minutes < 60) return `Há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Há ${hours} h`;
  return `Há ${Math.floor(hours / 24)} d`;
}
function eventGroup(type: string) {
  if (type.includes("artwork")) return "artwork";
  if (type.includes("approv")) return "approval";
  if (type.includes("comment") || type.includes("mention")) return "comments";
  if (type.includes("copy")) return "copy";
  return "workflow";
}
export function PostWorkflowBar({
  post,
  onPostRefresh,
}: {
  post: PostData;
  onPostRefresh?: (patch: Partial<PostData>) => void;
}) {
  const [work, setWork] = useState<any>(null),
    [members, setMembers] = useState<UserProfile[]>([]),
    [activity, setActivity] = useState<any[]>([]),
    [historyOpen, setHistoryOpen] = useState(false),
    [filter, setFilter] = useState("all"),
    [assignOpen, setAssignOpen] = useState(false),
    [assignmentType, setAssignmentType] = useState<"primary" | "action">(
      "primary",
    ),
    [assignee, setAssignee] = useState(""),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false);
  const { toast } = useNotifications();
  const load = async () => {
    if (!post.id) return;
    const [item, team] = await Promise.all([
      api.getPostWorkItem(post.id),
      api.getTeamMembers(),
    ]);
    setWork(item);
    setMembers(team);
    setAssignee(item.currentAssigneeId || "");
  };
  useEffect(() => {
    void load().catch(() => setWork(null));
  }, [post.id]);
  const openHistory = async () => {
    setHistoryOpen(true);
    if (post.id)
      setActivity(await api.getPostActivity(post.id).catch(() => []));
  };
  const assign = async () => {
    if (!post.id || !assignee || !reason.trim() || busy) return;
    setBusy(true);
    try {
      await api.overridePostAssignment(post.id, {
        assignmentType,
        assigneeId: assignee,
        reasonCode: "operational_override",
        reasonText: reason,
        expectedCurrentAssigneeId:
          assignmentType === "primary"
            ? work?.currentAssigneeId || ""
            : work?.actionAssigneeId || "",
      });
      await load();
      setAssignOpen(false);
      setReason("");
      onPostRefresh?.(
        assignmentType === "primary"
          ? { currentAssigneeId: assignee, assigneeId: assignee }
          : { actionAssigneeId: assignee },
      );
      toast("Responsável atualizado.", "success");
    } catch (e: any) {
      toast(
        e?.response?.data?.error || "Falha ao atribuir responsável.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };
  const visible = useMemo(
    () =>
      activity.filter(
        (e) => filter === "all" || eventGroup(e.eventType) === filter,
      ),
    [activity, filter],
  );
  if (!post.id) return null;
  return (
    <>
      <section
        className={styles.bar}
        aria-label="Fluxo da postagem"
      >
        <span className={styles.stage}>
          {STAGE_LABELS[work?.currentStage || post.currentStage || "briefing"]}
        </span>
        {work?.canOverrideAssignment && (
          <Button
            type="button"
            onClick={() => setAssignOpen((v) => !v)}
            size="small"
            variant="glass"
            title="Atribuir ou repassar"
          >
            <span className={styles.assigneeAvatar}>
              {work?.assigneePhoto ? (
                <img
                  src={work.assigneePhoto}
                  className={styles.assigneeImage}
                  alt=""
                />
              ) : (
                <UserRound />
              )}
            </span>
            {work?.assigneeName || "Sem responsável"}
          </Button>
        )}
        <span className={styles.deadline}>
          <Clock3 />
          {work?.dueDate
            ? new Date(work.dueDate).toLocaleDateString("pt-BR")
            : "Sem prazo"}{" "}
          · {relative(work?.stageEnteredAt)}
        </span>
        <span className={styles.lastActivity}>
          Última atividade: {relative(work?.lastActivityAt)}
        </span>
        <div className={styles.barActions}>
          {work?.currentStage === "design" && work?.artworkCurrentVersion && (
            <Button
              disabled={busy || work?.workflowStatus === "awaiting_approval"}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await api.markPostAwaitingApproval(post.id!);
                  onPostRefresh?.({
                    workflowStatus: "awaiting_approval",
                    workVersion: r.workVersion,
                  });
                  await load();
                  toast("Postagem aguardando aprova??o.", "success");
                } catch (e: any) {
                  toast(
                    e?.response?.data?.error || "A arte ainda n?o est? pronta.",
                    "error",
                  );
                } finally {
                  setBusy(false);
                }
              }}
              className="hidden md:flex"
              size="small"
              variant="glass"
            >
              Marcar aguardando aprova??o
              <Check />
            </Button>
          )}
          <Button
            type="button"
            onClick={() => void openHistory()}
            size="small"
            variant="glass"
          >
            <History />
            Histórico
          </Button>
        </div>
        {assignOpen && (
          <div className={styles.assignmentForm}>
            <Select
              value={assignmentType}
              onChange={(e) =>
                setAssignmentType(e.target.value as "primary" | "action")
              }
            >
              <option value="primary">Responsável principal</option>
              <option value="action">Próxima ação</option>
            </Select>
            <Select
              className="min-w-44"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            >
              <option value="">Selecione</option>
              {members.map((m) => (
                <option key={m.uid} value={m.uid}>
                  {m.displayName || m.email}
                </option>
              ))}
            </Select>
            <Input
              className="min-w-48 flex-1"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motivo obrigatório"
            />
            <Button
              disabled={!assignee || !reason.trim() || busy}
              onClick={() => void assign()}
              variant="primary"
              icon={<Check />}
            >
              Atribuir
            </Button>
          </div>
        )}
      </section>
      {historyOpen && (
        <div className={styles.drawerRoot}>
          <div
            aria-label="Fechar histórico"
            className={styles.drawerBackdrop}
            onClick={() => setHistoryOpen(false)}
          />
          <aside className={styles.drawer}>
            <div className={styles.drawerHeader}>
              <div>
                <h2>Histórico</h2>
                <p>Linha do tempo da postagem</p>
              </div>
              <IconButton
                onClick={() => setHistoryOpen(false)}
                aria-label="Fechar histórico"
                label="Fechar histórico"
                size="small"
              >
                <X />
              </IconButton>
            </div>
            <div className={styles.filters}>
              {FILTERS.map(([id, label]) => (
                <Button
                  key={id}
                  onClick={() => setFilter(id)}
                  size="small"
                  variant={filter === id ? "primary" : "ghost"}
                >
                  {label}
                </Button>
              ))}
            </div>
            <div className={styles.timeline}>
              {visible.length ? (
                visible.map((event) => (
                  <article
                    key={event.id}
                    className={styles.event}
                  >
                    <div className={styles.eventHeader}>
                      <strong>
                        {event.actorName || "Sistema"}
                      </strong>
                      <time>
                        {new Date(event.createdAt).toLocaleString("pt-BR")}
                      </time>
                    </div>
                    <p>
                      {event.summary}
                    </p>
                    {event.stageTo && (
                      <span className={styles.eventStage}>
                        {STAGE_LABELS[event.stageTo] || event.stageTo}
                      </span>
                    )}
                  </article>
                ))
              ) : (
                <div className={styles.emptyTimeline}>
                  <span>Nenhuma atividade neste filtro.</span>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
