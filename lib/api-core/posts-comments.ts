import { NextRequest, NextResponse } from "next/server";
import { exec, getDbPool, rows } from "../db";
import { ApiContext, ApiParams } from "../api-types";
import { err, ok } from "../api-response";
import { body } from "./context";
import { recordPostActivity } from "../post-workflow";

export async function handlePostCommentsApi(
  method: string,
  route: string,
  req: NextRequest,
  params: ApiParams,
  ctx: ApiContext,
): Promise<NextResponse | null> {
  if (route === "/posts/[postId]/comments" && method === "GET") {
    const owned = (
      await rows("SELECT id FROM posts WHERE id=? LIMIT 1", [params.postId])
    )[0];
    if (!owned) return err("Postagem nÃ£o encontrada.", 404, "POST_NOT_FOUND");
    return ok(
      await rows(
        "SELECT * FROM post_comments WHERE postId=? ORDER BY createdAt ASC",
        [params.postId],
      ),
    );
  }

  if (route === "/posts/[postId]/comments" && method === "POST") {
    const post = (
      await rows(
        "SELECT id,clientId,currentAssigneeId FROM posts WHERE id=? LIMIT 1",
        [params.postId],
      )
    )[0];
    if (!post) return err("Postagem nÃ£o encontrada.", 404, "POST_NOT_FOUND");
    const data = await body(req);
    const content = String(data.content || "").trim();
    if (!content || content.length > 4000)
      return err("ComentÃ¡rio invÃ¡lido.", 422, "INVALID_COMMENT");
    const author = ctx.userUid
      ? await rows(
          "SELECT displayName,role FROM users WHERE uid=?",
          [ctx.userUid],
        )
      : [];
    const result = await exec(
      "INSERT INTO post_comments(postId,authorUserId,authorName,authorRole,content,revisionId,artworkVersionId,commentType,mentionsJson) VALUES(?,?,?,?,?,?,?,?,?)",
      [
        params.postId,
        ctx.userUid,
        author[0]?.displayName || "Equipe",
        author[0]?.role || "interno",
        content,
        data.revisionId || null,
        data.artworkVersionId || null,
        data.commentType === "change_request" ? "change_request" : "comment",
        JSON.stringify(
          Array.isArray(data.mentions) ? data.mentions.slice(0, 20) : [],
        ),
      ],
    );
    await recordPostActivity(getDbPool(), {
      
      postId: Number(params.postId),
      actorUserId: ctx.userUid,
      eventType:
        data.commentType === "change_request"
          ? "changes_requested"
          : "comment_added",
      entityType: data.artworkVersionId
        ? "artwork_version"
        : data.revisionId
          ? "revision"
          : "comment",
      entityId: data.artworkVersionId || data.revisionId || result.insertId,
      summary: `${author[0]?.displayName || "Um colaborador"} ${data.commentType === "change_request" ? "solicitou alteraÃ§Ãµes" : "adicionou um comentÃ¡rio"}.`,
    });
    return ok({ id: result.insertId });
  }

  return null;
}
