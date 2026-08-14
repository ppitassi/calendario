import { NextRequest, NextResponse } from "next/server";
import { exec, getDbPool, rows } from "../db";
import { ApiContext, ApiParams } from "../api-types";
import { err, ok } from "../api-response";
import { body } from "./context";
import { publicPost } from "../post-data";
import { assertPostDate } from "../date-utils";
import { clientResponsible } from "../production-workflow";
import { recordAutosaveActivity, recordPostActivity } from "../post-workflow";
import { createNotificationEvent, resolvePostRecipients } from "../notifications";
import { assetUrls } from "./media-utils";
import { handlePostCommentsApi } from "./posts-comments";
import { enqueueAssetRelocations } from "../storage/relocation";

async function clientExists(clientId: string) {
  const result = await rows("SELECT id FROM clients WHERE id = ? LIMIT 1", [clientId]);
  return Boolean(result[0]);
}

function tablePayload(data: Record<string, any>) {
  const result: Record<string, any> = { ...data };
  for (const [key, value] of Object.entries(result)) {
    if (Array.isArray(value) || (value && typeof value === "object"))
      result[key] = JSON.stringify(value);
  }
  return result;
}

export async function handlePostsApi(
  method: string,
  route: string,
  req: NextRequest,
  params: ApiParams,
  ctx: ApiContext,
  removeLocalAsset: (url: string) => Promise<void>,
): Promise<NextResponse | null> {
  const commentsRes = await handlePostCommentsApi(method, route, req, params, ctx);
  if (commentsRes) return commentsRes;

  if (route === "/posts" && method === "GET") {
    const result = await rows(
      "SELECT *, DATE_FORMAT(date, '%Y-%m-%d') AS date FROM posts ORDER BY date ASC",
    );
    return ok(result.map(publicPost));
  }

  if (route === "/posts/[clientId]" && method === "GET") {
    const result = await rows(
      "SELECT *, DATE_FORMAT(date, '%Y-%m-%d') AS date FROM posts WHERE clientId = ? ORDER BY date ASC",
      [params.clientId],
    );
    return ok(result.map(publicPost));
  }

  if (route === "/posts" && method === "POST") {
    const bodyData = await body(req);
    const previousPost = bodyData.id
      ? (
          await rows("SELECT * FROM posts WHERE id = ?", [bodyData.id])
        )[0]
      : null;
    if (!previousPost && !ctx.permissions.has("canCreatePosts"))
      return err("Permissao insuficiente para criar postagens.", 403);
    if (previousPost) {
      const elevated = ["admin", "gerente", "atendimento"].includes(ctx.userRole || "");
      const assigned =
        previousPost.currentAssigneeId === ctx.userUid ||
        previousPost.actionAssigneeId === ctx.userUid ||
        previousPost.assigneeId === ctx.userUid;
      const allowed =
        elevated ||
        ctx.permissions.has("canEditCalendar") ||
        (ctx.permissions.has("canEditAssignedPosts") && assigned);
      if (!allowed) return err("Voce nao pode editar esta postagem.", 403);
    }
    const filteredData: Record<string, any> = {};
    const POST_COLUMNS = [
      "id",
      "clientId",
      "date",
      "type",
      "head",
      "subhead",
      "subtitle",
      "objective",
      "channel",
      "title",
      "centralIdea",
      "caption",
      "artHeadline",
      "artText",
      "cta",
      "hashtags",
      "visualBriefing",
      "internalNotes",
      "theme",
      "script",
      "feedImages",
      "storyImage",
      "coverImage",
      "linkedinCover",
      "funnelStage",
      "status",
      "deadline",
      "assigneeId",
      "videoUrl",
      "createdByUserId",
      "currentAssigneeId",
      "currentStage",
      "workflowStatus",
      "assignedAt",
      "dueDate",
      "priority",
      "workVersion",
      "stageEnteredAt",
      "lastActivityAt",
      "artworkCurrentVersion",
    ];
    for (const key of POST_COLUMNS) {
      if (bodyData[key] !== undefined) {
        filteredData[key] = bodyData[key];
      }
    }
    filteredData.date = assertPostDate(filteredData.date);
    if (!filteredData.clientId) return err("Cliente obrigatorio.", 400);
    if (!(await clientExists(filteredData.clientId)))
      return err("Cliente nÃ£o pertence Ã  sua agÃªncia.", 403);
    if (
      previousPost &&
      bodyData.workVersion !== undefined &&
      Number(bodyData.workVersion) !== Number(previousPost.workVersion || 1)
    )
      return err(
        "A postagem foi alterada por outro colaborador.",
        409,
        "POST_VERSION_CONFLICT",
      );
    if (!previousPost) {
      filteredData.createdByUserId = ctx.userUid;
      const socialResponsible = (
        await clientResponsible(
          getDbPool(),
          filteredData.clientId,
          "social_media",
        )
      ).user;
      if (!socialResponsible)
        return err(
          "Este cliente estÃ¡ sem Social Media responsÃ¡vel configurado. Configure a equipe antes de criar postagens.",
          422,
          "CLIENT_SOCIAL_MEDIA_NOT_CONFIGURED",
        );
      filteredData.currentAssigneeId = socialResponsible.uid;
      filteredData.assigneeId = socialResponsible.uid;
      filteredData.currentStage = "copy";
      filteredData.workflowStatus = "in_progress";
      filteredData.assignedAt = new Date();
      filteredData.stageEnteredAt = new Date();
      filteredData.lastActivityAt = new Date();
      filteredData.workVersion = 1;
    } else
      filteredData.workVersion = Number(previousPost.workVersion || 1) + 1;
    const data = tablePayload(filteredData);
    let result: any;
    if (previousPost) {
      const update = { ...data };
      delete update.id;
      result = await exec("UPDATE posts SET ? WHERE id = ?", [
        update,
        previousPost.id,
      ]);
    } else {
      if (data.id !== undefined && data.id !== null && data.id !== "") {
        const collision = await rows("SELECT id FROM posts WHERE id = ? LIMIT 1", [data.id]);
        if (collision[0]) return err("Identificador de postagem ja utilizado.", 409);
      }
      result = await exec("INSERT INTO posts SET ?", [data]);
    }
    if (previousPost) {
      const oldUrls = assetUrls(Object.values(previousPost));
      const currentUrls = new Set(assetUrls(Object.values(data)));
      for (const url of oldUrls.filter((item) => !currentUrls.has(item)))
        await removeLocalAsset(url);
    }
    const postId = data.id || result.insertId;
    if (!previousPost) {
      const actor = (
        await rows(
          "SELECT displayName FROM users WHERE uid=? LIMIT 1",
          [ctx.userUid],
        )
      )[0];
      const assignee = data.currentAssigneeId
        ? (
            await rows(
              "SELECT displayName FROM users WHERE uid=? LIMIT 1",
              [data.currentAssigneeId],
            )
          )[0]
        : null;
      await recordPostActivity(getDbPool(), {
        
        postId: Number(postId),
        actorUserId: ctx.userUid,
        eventType: "post_created",
        summary: assignee
          ? `${actor?.displayName || "Um colaborador"} criou esta postagem e atribuiu a tarefa a ${assignee.displayName}.`
          : `${actor?.displayName || "Um colaborador"} criou esta postagem.`,
      });
      if (data.currentAssigneeId)
        await exec(
          "INSERT INTO post_assignments(postId,assignedByUserId,assignedToUserId,stage) VALUES(?,?,?,?)",
          [
            postId,
            ctx.userUid,
            data.currentAssigneeId,
            data.currentStage,
          ],
        );
      void resolvePostRecipients(
        data.clientId,
        data.currentAssigneeId,
      )
        .then((recipients) =>
          createNotificationEvent({
            
            actorUserId: ctx.userUid,
            type: "post_created",
            category: "assignments",
            entityType: "post",
            entityId: postId,
            clientId: data.clientId,
            title: "Nova postagem",
            body: "Uma nova postagem relacionada a vocÃª foi criada.",
            route: `/?clientId=${encodeURIComponent(data.clientId)}&postId=${postId}`,
            recipientUserIds: recipients,
            dedupeKey: `post-created:${postId}`,
          }),
        )
        .catch(() => {});
    } else if (ctx.userUid) {
      const changed = [
        "head",
        "subhead",
        "caption",
        "objective",
        "visualBriefing",
        "deadline",
      ].filter(
        (key) =>
          bodyData[key] !== undefined &&
          String(bodyData[key] ?? "") !== String(previousPost[key] ?? ""),
      );
      if (changed.length) {
        const actor = (
          await rows(
            "SELECT displayName FROM users WHERE uid=? LIMIT 1",
            [ctx.userUid],
          )
        )[0];
        await recordAutosaveActivity({
          
          postId: Number(postId),
          actorUserId: ctx.userUid,
          actorName: actor?.displayName || "Um colaborador",
          fields: changed,
        });
      }
    }
    if (previousPost && ["clientId", "date", "type", "title", "head", "centralIdea"].some((key) => bodyData[key] !== undefined && String(bodyData[key] ?? "") !== String(previousPost[key] ?? ""))) {
      void enqueueAssetRelocations({ clientId: String(data.clientId || previousPost.clientId) }).catch((error) => console.error("[media-relocation]", error));
    }
    return ok({ id: postId, date: data.date, workVersion: data.workVersion });
  }

  if (route === "/posts/[clientId]/[date]" && method === "DELETE") {
    const removedPosts = await rows(
      "SELECT feedImages, storyImage, coverImage, linkedinCover, videoUrl FROM posts WHERE clientId = ? AND date = ?",
      [params.clientId, assertPostDate(params.date)],
    );
    await exec(
      "DELETE FROM posts WHERE clientId = ? AND date = ?",
      [params.clientId, assertPostDate(params.date)],
    );
    for (const url of assetUrls(
      removedPosts.flatMap((post) => Object.values(post)),
    ))
      await removeLocalAsset(url);
    return ok();
  }

  if (route === "/posts-bulk/[clientId]" && method === "POST") {
    const data = await body(req);
    if (Array.isArray(data.dates) && data.dates.length)
      await exec(
        "DELETE FROM posts WHERE clientId = ? AND date IN (?)",
        [params.clientId, data.dates.map(assertPostDate)],
      );
    return ok();
  }

  return null;
}
