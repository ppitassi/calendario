import "server-only";
import { randomBytes } from "crypto";
import { getDbPool } from "../db";
import { createNotificationEvent } from "../notifications";
import { createPostRevision, recordPostActivity, WorkflowSession } from "../post-workflow";
import {
  ClientRow,
  clientResponsible,
  copyBlocks,
  planningId,
  PlanningPost,
  planningPosts,
  PlanningRef,
  ResponsibleUser,
} from "./core";

export { sendPlanningToApproval } from "./send-approval";

export async function planningStatus(ref: PlanningRef) {
  const c = await getDbPool().getConnection();
  try {
    const posts = await planningPosts(c, ref);
    const blocks = copyBlocks(posts);
    const art = posts.map((p) => ({
      postId: p.id,
      title: p.title || p.head || `Post ${p.id}`,
      ready:
        Boolean(p.artworkCurrentVersion) &&
        p.workflowStatus === "awaiting_approval",
      reason: !p.artworkCurrentVersion
        ? "sem arquivo/versÃ£o"
        : p.workflowStatus !== "awaiting_approval"
          ? "nÃ£o marcada como aguardando aprovaÃ§Ã£o"
          : null,
    }));
    const phase = posts.some((p) =>
      ["approval", "aprovado", "agendado", "publicado"].includes(
        p.currentStage,
      ),
    )
      ? "service"
      : posts.some((p) => p.currentStage === "design")
        ? "design"
        : "copy";
    return {
      planningId: planningId(ref.clientId, ref.month),
      phase,
      total: posts.length,
      copy: {
        ready: posts.length - new Set(blocks.map((block) => block.postId)).size,
        enabled: posts.length > 0 && !blocks.length,
        blocks,
      },
      artwork: {
        ready: art.filter((x) => x.ready).length,
        enabled: posts.length > 0 && art.every((x) => x.ready),
        blocks: art.filter((x) => !x.ready),
      },
      completion: {
        enabled:
          posts.length > 0 &&
          posts.every((p) =>
            ["publicado", "arquivado", "cancelado"].includes(p.currentStage),
          ),
        pending: posts.filter(
          (p) =>
            !["publicado", "arquivado", "cancelado"].includes(p.currentStage),
        ).length,
      },
      counts: {
        approved: posts.filter((p) => p.currentStage === "aprovado").length,
        scheduled: posts.filter((p) => p.currentStage === "agendado").length,
        published: posts.filter((p) => p.currentStage === "publicado").length,
        changes: posts.filter((p) => p.workflowStatus === "changes_requested")
          .length,
      },
    };
  } finally {
    c.release();
  }
}

async function assertBatchActor(
  session: WorkflowSession,
  expected: string,
  userId: string,
) {
  if (session.userId !== userId && !["admin", "gerente"].includes(session.role))
    throw Object.assign(
      new Error(
        `Somente o ${expected} responsÃ¡vel pode executar este repasse.`,
      ),
      { status: 403, code: "FORBIDDEN" },
    );
}

export async function sendPlanningToDesign(
  session: WorkflowSession,
  ref: PlanningRef,
) {
  const c = await getDbPool().getConnection(),
    corr = randomBytes(16).toString("hex");
  let designer: ResponsibleUser;
  let posts: PlanningPost[] = [];
  let client: ClientRow;
  try {
    await c.beginTransaction();
    posts = await planningPosts(c, ref, true);
    if (!posts.length)
      throw Object.assign(
        new Error("Nenhuma postagem ativa no planejamento."),
        { status: 422, code: "EMPTY_PLANNING" },
      );
    const social = await clientResponsible(
      c,
      ref.clientId,
      "social_media",
    );
    client = social.client;
    if (!social.user)
      throw Object.assign(
        new Error(
          `O cliente ${client.name} estÃ¡ sem Social Media responsÃ¡vel.`,
        ),
        { status: 422, code: "MISSING_SOCIAL_MEDIA" },
      );
    await assertBatchActor(session, "Social Media", social.user.uid);
    const resolved = await clientResponsible(
      c,
      ref.clientId,
      "designer",
    );
    if (!resolved.user)
      throw Object.assign(
        new Error(`O cliente ${client.name} estÃ¡ sem Designer responsÃ¡vel.`),
        { status: 422, code: "MISSING_DESIGNER" },
      );
    designer = resolved.user;
    const blocks = copyBlocks(posts);
    if (blocks.length)
      throw Object.assign(
        new Error(
          `${new Set(blocks.map((x) => x.postId)).size} postagens ainda precisam de conteÃºdo.`,
        ),
        { status: 422, code: "COPY_INCOMPLETE", blocks },
      );
    if (posts.some((p) => !["copy", "briefing"].includes(p.currentStage)))
      throw Object.assign(
        new Error("O planejamento possui postagens fora da etapa de copy."),
        { status: 409, code: "INVALID_BATCH_STAGE" },
      );
    for (const p of posts) {
      const rev = await createPostRevision(
        c,
        p,
        session.userId,
        "send_to_design",
      );
      await c.execute(
        "UPDATE post_assignments SET endedAt=NOW() WHERE postId=? AND endedAt IS NULL",
        [p.id],
      );
      await c.execute(
        "INSERT INTO post_assignments(postId,assignedByUserId,assignedToUserId,previousAssigneeId,stage,reason) VALUES(?,?,?,?,?,?)",
        [
          p.id,
          session.userId,
          designer.uid,
          p.currentAssigneeId,
          "design",
          "Repasse do planejamento para design",
        ],
      );
      await c.execute(
        "UPDATE posts SET currentStage='design',workflowStatus='in_progress',currentAssigneeId=?,actionAssigneeId=NULL,assigneeId=?,assignedAt=NOW(),stageEnteredAt=NOW(),lastActivityAt=NOW(),workVersion=workVersion+1 WHERE id=?",
        [designer.uid, designer.uid, p.id],
      );
      await recordPostActivity(c, {
        
        postId: p.id,
        actorUserId: session.userId,
        eventType: "planning_sent_to_design",
        entityType: "revision",
        entityId: rev.id,
        stageFrom: p.currentStage,
        stageTo: "design",
        assigneeFromId: p.currentAssigneeId,
        assigneeToId: designer.uid,
        summary: `${session.displayName} concluiu a copy e enviou esta postagem para ${designer.displayName} criar a arte.`,
        correlationId: corr,
      });
    }
    await c.commit();
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
  void createNotificationEvent({
    
    actorUserId: session.userId,
    type: "planning_sent_to_design",
    category: "assignments",
    entityType: "planning",
    entityId: planningId(ref.clientId, ref.month),
    clientId: ref.clientId,
    title: "Planejamento enviado para design",
    body: `${posts!.length} postagens foram atribuÃ­das a vocÃª.`,
    route: `/?clientId=${encodeURIComponent(ref.clientId)}&month=${ref.month}`,
    recipientUserIds: [designer.uid],
    dedupeKey: `planning-design:${ref.clientId}:${ref.month}`,
  }).catch(() => {});
  return {
    success: true,
    count: posts!.length,
    assignee: { uid: designer.uid, displayName: designer.displayName },
  };
}
