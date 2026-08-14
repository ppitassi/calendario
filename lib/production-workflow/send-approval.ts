import "server-only";
import { randomBytes } from "crypto";
import { getDbPool } from "../db";
import { createNotificationEvent } from "../notifications";
import { recordPostActivity, WorkflowSession } from "../post-workflow";
import {
  ArtworkVersion,
  ClientRow,
  clientResponsible,
  planningId,
  PlanningPost,
  planningPosts,
  PlanningRef,
  ResponsibleUser,
} from "./core";

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

export async function sendPlanningToApproval(
  session: WorkflowSession,
  ref: PlanningRef,
) {
  const c = await getDbPool().getConnection(),
    corr = randomBytes(16).toString("hex");
  let atendimento: ResponsibleUser;
  let posts: PlanningPost[] = [];
  let designer: ResponsibleUser;
  let client: ClientRow;
  try {
    await c.beginTransaction();
    posts = await planningPosts(c, ref, true);
    if (!posts.length)
      throw Object.assign(
        new Error("Nenhuma postagem ativa no planejamento."),
        { status: 422, code: "EMPTY_PLANNING" },
      );
    const designResponsible = await clientResponsible(
      c,
      ref.clientId,
      "designer",
    );
    if (!designResponsible.user)
      throw Object.assign(new Error("Cliente sem Designer responsÃ¡vel."), {
        status: 422,
        code: "MISSING_DESIGNER",
      });
    designer = designResponsible.user;
    await assertBatchActor(session, "Designer", designer.uid);
    const resolved = await clientResponsible(
      c,
      ref.clientId,
      "atendimento",
    );
    client = resolved.client;
    if (!resolved.user)
      throw Object.assign(
        new Error(`O cliente ${client.name} estÃ¡ sem Atendimento responsÃ¡vel.`),
        { status: 422, code: "MISSING_ATENDIMENTO" },
      );
    atendimento = resolved.user;
    const blocks = posts
      .filter(
        (p) =>
          !p.artworkCurrentVersion || p.workflowStatus !== "awaiting_approval",
      )
      .map((p) => ({
        postId: p.id,
        title: p.title || p.head || `Post ${p.id}`,
        reason: !p.artworkCurrentVersion
          ? "sem arquivo/versÃ£o"
          : "nÃ£o marcada como aguardando aprovaÃ§Ã£o",
      }));
    if (blocks.length)
      throw Object.assign(
        new Error(
          `${blocks.length} postagens ainda nÃ£o estÃ£o prontas para aprovaÃ§Ã£o.`,
        ),
        { status: 422, code: "ARTWORK_INCOMPLETE", blocks },
      );
    for (const p of posts) {
      const [versionRows] = await c.query(
        "SELECT id,versionNumber FROM post_artwork_versions WHERE postId=? AND versionNumber=? LIMIT 1",
        [p.id, p.artworkCurrentVersion],
      );
      const versions = versionRows as ArtworkVersion[];
      const version = versions[0];
      if (!version)
        throw Object.assign(
          new Error(`Postagem ${p.id} sem versÃ£o persistida.`),
          { status: 422, code: "INVALID_ARTWORK_VERSION" },
        );
      await c.execute(
        "UPDATE post_artwork_versions SET status='awaiting_approval',submittedByUserId=?,submittedAt=COALESCE(submittedAt,NOW()) WHERE id=?",
        [session.userId, version.id],
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
          atendimento.uid,
          p.currentAssigneeId,
          "approval",
          "Repasse do planejamento para aprovaÃ§Ã£o",
        ],
      );
      await c.execute(
        "UPDATE posts SET currentStage='approval',workflowStatus='pending',currentAssigneeId=?,actionAssigneeId=NULL,assigneeId=?,assignedAt=NOW(),stageEnteredAt=NOW(),lastActivityAt=NOW(),workVersion=workVersion+1 WHERE id=?",
        [atendimento.uid, atendimento.uid, p.id],
      );
      await recordPostActivity(c, {
        
        postId: p.id,
        actorUserId: session.userId,
        eventType: "planning_sent_to_approval",
        entityType: "artwork_version",
        entityId: version.id,
        stageFrom: p.currentStage,
        stageTo: "approval",
        assigneeFromId: p.currentAssigneeId,
        assigneeToId: atendimento.uid,
        summary: `${session.displayName} concluiu as artes e enviou o planejamento para ${atendimento.displayName}, do Atendimento.`,
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
    type: "planning_sent_to_approval",
    category: "approvals",
    entityType: "planning",
    entityId: planningId(ref.clientId, ref.month),
    clientId: ref.clientId,
    title: "Planejamento pronto para aprovaÃ§Ã£o",
    body: `${posts!.length} postagens aguardam seu atendimento.`,
    route: `/?clientId=${encodeURIComponent(ref.clientId)}&month=${ref.month}`,
    recipientUserIds: [atendimento.uid],
    dedupeKey: `planning-approval:${ref.clientId}:${ref.month}`,
  }).catch(() => {});
  return {
    success: true,
    count: posts!.length,
    assignee: { uid: atendimento.uid, displayName: atendimento.displayName },
  };
}
