import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { randomBytes } from "crypto";
import { exec, getDbPool, rows } from "../db";
import { ApiContext } from "../api-types";
import { err, ok } from "../api-response";
import { body, rateLimited } from "./context";
import { normalizedPostMediaCategory, registerMediaAsset } from "./media-utils";
import { uploadBase64 } from "./upload-base64";
import { buildPostAssetPath, isDocumentCategory, storeMediaLocally, validateUploadName } from "../storage";

async function clientExists(clientId: string) {
  const result = await rows("SELECT id FROM clients WHERE id = ? LIMIT 1", [clientId]);
  return Boolean(result[0]);
}

export async function handleMediaApi(
  method: string,
  route: string,
  req: NextRequest,
  ctx: ApiContext,
): Promise<NextResponse | null> {
  if (route === "/media/mirror-manifest" && method === "GET") {
    const deviceId = String(new URL(req.url).searchParams.get("deviceId") || "").slice(0, 191);
    if (!deviceId || !/^[a-zA-Z0-9._:-]+$/.test(deviceId)) return err("Dispositivo invalido.", 400);
    const elevated = ["admin", "gerente", "atendimento"].includes(ctx.userRole || "");
    const assets = await rows(
      `SELECT a.id assetId,a.logicalPath,a.checksum,a.visibility,a.relocationRevision,
              a.mimeType,a.originalName,a.sizeBytes,a.publicUrl url,
              COALESCE(r.status,'pending') mirrorState
       FROM media_assets a
       LEFT JOIN media_asset_mirror_receipts r ON r.mediaAssetId=a.id AND r.userUid=? AND r.deviceId=?
       LEFT JOIN posts p ON a.ownerType='post' AND CAST(p.id AS CHAR)=a.ownerId
       LEFT JOIN clients c ON c.id=a.clientId
       WHERE a.status='active' AND a.logicalPath IS NOT NULL AND
         (?=1 OR p.currentAssigneeId=? OR p.actionAssigneeId=? OR p.assigneeId=? OR
          JSON_CONTAINS(CASE WHEN JSON_VALID(c.owners) THEN c.owners ELSE JSON_ARRAY() END,JSON_QUOTE(?)) OR
          EXISTS(SELECT 1 FROM users u WHERE u.uid=? AND u.clientId=a.clientId))
       ORDER BY a.updatedAt DESC LIMIT 1000`,
      [ctx.userUid, deviceId, elevated ? 1 : 0, ctx.userUid, ctx.userUid, ctx.userUid, ctx.userUid, ctx.userUid],
    );
    return ok({ deviceId, assets });
  }

  if (route === "/media/assets" && method === "GET") {
    const ownerId = String(new URL(req.url).searchParams.get("ownerId") || "");
    if (!ownerId) return err("Postagem obrigatoria.", 400);
    const elevated = ["admin", "gerente", "atendimento"].includes(ctx.userRole || "");
    const allowed = await rows(
      `SELECT 1 FROM posts p LEFT JOIN clients c ON c.id=p.clientId WHERE CAST(p.id AS CHAR)=? AND
       (?=1 OR p.currentAssigneeId=? OR p.actionAssigneeId=? OR p.assigneeId=? OR
        JSON_CONTAINS(CASE WHEN JSON_VALID(c.owners) THEN c.owners ELSE JSON_ARRAY() END,JSON_QUOTE(?)) OR
        EXISTS(SELECT 1 FROM users u WHERE u.uid=? AND u.clientId=p.clientId)) LIMIT 1`,
      [ownerId, elevated ? 1 : 0, ctx.userUid, ctx.userUid, ctx.userUid, ctx.userUid, ctx.userUid],
    );
    if (!allowed[0]) return err("Acesso negado.", 403);
    const assets = await rows(
      `SELECT id assetId,originalName,mimeType,sizeBytes,checksum,logicalPath,visibility,publicUrl url,relocationState,nextcloudState
       FROM media_assets WHERE ownerType='post' AND ownerId=? AND status='active' ORDER BY createdAt`, [ownerId],
    );
    return ok(assets);
  }

  if (route === "/media/mirror-receipts" && method === "POST") {
    const data = await body(req);
    const deviceId = String(data.deviceId || "").slice(0, 191);
    const assetId = String(data.assetId || "").slice(0, 64);
    const status = String(data.status || "pending");
    if (!/^[a-zA-Z0-9._:-]+$/.test(deviceId) || !["synced", "pending", "failed", "unavailable"].includes(status))
      return err("Recibo de espelho invalido.", 400);
    const elevated = ["admin", "gerente", "atendimento"].includes(ctx.userRole || "");
    const asset = (await rows(
      `SELECT a.id,a.checksum,a.logicalPath FROM media_assets a LEFT JOIN posts p ON a.ownerType='post' AND CAST(p.id AS CHAR)=a.ownerId
       LEFT JOIN clients c ON c.id=a.clientId WHERE a.id=? AND a.status='active' AND
       (?=1 OR p.currentAssigneeId=? OR p.actionAssigneeId=? OR p.assigneeId=? OR
        JSON_CONTAINS(CASE WHEN JSON_VALID(c.owners) THEN c.owners ELSE JSON_ARRAY() END,JSON_QUOTE(?)) OR
        EXISTS(SELECT 1 FROM users u WHERE u.uid=? AND u.clientId=a.clientId)) LIMIT 1`,
      [assetId, elevated ? 1 : 0, ctx.userUid, ctx.userUid, ctx.userUid, ctx.userUid, ctx.userUid],
    ))[0];
    if (!asset) return err("Midia nao encontrada.", 404);
    if (String(data.checksum || "") !== String(asset.checksum || "") || String(data.logicalPath || "") !== String(asset.logicalPath || ""))
      return err("Checksum ou caminho divergente.", 409, "MIRROR_MISMATCH");
    await exec(
      `INSERT INTO media_asset_mirror_receipts
       (mediaAssetId,userUid,deviceId,checksum,logicalPath,status,lastError,lastSynchronizedAt)
       VALUES (?,?,?,?,?,?,?,IF(?='synced',NOW(),NULL))
       ON DUPLICATE KEY UPDATE checksum=VALUES(checksum),logicalPath=VALUES(logicalPath),status=VALUES(status),
         lastError=VALUES(lastError),lastSynchronizedAt=IF(VALUES(status)='synced',NOW(),lastSynchronizedAt)`,
      [assetId, ctx.userUid, deviceId, asset.checksum, asset.logicalPath, status, String(data.error || "").slice(0, 500) || null, status],
    );
    return ok({ assetId, status });
  }

  if (
    (route === "/upload-base64" || route === "/upload-audio") &&
    method === "POST"
  ) {
    if (await rateLimited(`asset:${ctx.userUid}`, 30, 60_000))
      return err("Limite de uploads excedido.", 429);
    const data = await body(req);
    const folder = String(
      data.subfolder || (route === "/upload-audio" ? "audio" : "profiles"),
    );
    const clientId = String(data.clientId || "");
    if (folder === "posts") return err("Use o upload binario com uma postagem salva.", 409, "UPLOAD_INTENT_REQUIRED");
    if (
      ["posts", "logos", "audio"].includes(folder) &&
      (!clientId || !(await clientExists(clientId)))
    )
      return err("Cliente invalido.", 403);
    if (folder === "posts" && !ctx.permissions.has("canCreatePosts"))
      return err("Permissao insuficiente.", 403);
    if (
      ["logos", "audio"].includes(folder) &&
      !ctx.permissions.has("canConfigClients")
    )
      return err("Permissao insuficiente.", 403);
    if (folder === "branding" && !ctx.permissions.has("canManageBrandSystem"))
      return err("Permissao insuficiente.", 403);
    if (
      ["avatars", "profiles"].includes(folder) &&
      String(data.targetUserId || ctx.userUid) !== ctx.userUid &&
      !ctx.permissions.has("canManageRoles")
    )
      return err("Permissao insuficiente.", 403);
    const stored = await uploadBase64(
      data,
      route === "/upload-audio",
    );
    const categoryMap: Record<string, string> = {
      avatars: "avatar",
      profiles: "avatar",
      logos: "logo",
      branding: "agency_logo",
      posts: "post_art",
      audio: "audio",
    };
    const category = categoryMap[folder] || folder;
    const assetId = await registerMediaAsset(ctx, data, stored, category);
    let thumbnailAssetId: string | null = null;
    if (stored.thumbnail) {
      thumbnailAssetId = await registerMediaAsset(
        ctx,
        data,
        {
          ...stored.thumbnail,
          mimeType: "image/webp",
          originalName: stored.originalName,
        },
        category,
        "_thumbnail",
      );
    }
    return ok({
      url: stored.url,
      assetId,
      thumbnailUrl: stored.thumbnail?.url || null,
      thumbnailAssetId,
    });
  }

  if (route === "/uploads/media/init" && method === "POST") {
    if (await rateLimited(`media-init:${ctx.userUid}`, 20, 60_000))
      return err("Limite de uploads excedido.", 429);
    const data = await body(req);
    const clientId = String(data.clientId || "");
    const category = normalizedPostMediaCategory(data.category);
    if (!clientId || !(await clientExists(clientId)))
      return err("Cliente invÃ¡lido.", 403);
    const intentId = randomBytes(24).toString("hex");
    const assetId = randomBytes(24).toString("hex");
    const client = (
      await rows(
        "SELECT id,name FROM clients WHERE id=? LIMIT 1",
        [clientId],
      )
    )[0];
    const requestedOwnerId = String(data.ownerId || "");
    const post = requestedOwnerId
      ? (
        await rows(
          `SELECT p.id,p.date,p.type,p.currentAssigneeId,p.actionAssigneeId,p.assigneeId,COALESCE(NULLIF(p.title,''),NULLIF(p.head,''),NULLIF(p.centralIdea,''),'post') postTitle,
             (SELECT COUNT(*) FROM posts p2 WHERE p2.clientId=p.clientId
               AND YEAR(p2.date)=YEAR(p.date) AND MONTH(p2.date)=MONTH(p.date)
               AND (p2.date<p.date OR (p2.date=p.date AND p2.id<=p.id))) postNumber
           FROM posts p WHERE p.id=? AND p.clientId=? LIMIT 1`,
          [requestedOwnerId, clientId],
        )
      )[0]
      : null;
    if (requestedOwnerId && !post) return err("Postagem invÃ¡lida.", 403);
    if (!post) return err("Selecione uma postagem salva antes de enviar arquivos.", 422);
    const elevated = ["admin", "gerente", "atendimento"].includes(ctx.userRole || "");
    const assigned = [post.currentAssigneeId, post.actionAssigneeId, post.assigneeId].some((id) => id === ctx.userUid);
    if (!elevated && !ctx.permissions.has("canEditCalendar") && !(ctx.permissions.has("canEditAssignedPosts") && assigned))
      return err("Voce nao pode anexar arquivos a esta postagem.", 403);
    const postDate =
      post?.date instanceof Date
        ? post.date.toISOString().slice(0, 10)
        : String(post?.date || data.postDate || "").slice(0, 10);
    const originalName = String(data.fileName || "media");
    try { validateUploadName(originalName, String(data.mimeType || "")); }
    catch { return err("Tipo ou nome de arquivo nao permitido.", 422, "MEDIA_TYPE_BLOCKED"); }
    const itemIndex = Number(data.itemIndex || 1);
    if (category === "post_feed" && post.type === "carousel" && (!Number.isInteger(itemIndex) || itemIndex < 1 || itemIndex > 10))
      return err("Indice do carrossel invalido.", 422);
    const visibility = isDocumentCategory(category) ? "protected" : "public";
    const localPath = buildPostAssetPath({
      assetId,
      clientName: client.name,
      postType: post.type,
      postTitle: post.postTitle,
      postOrder: Number(post.postNumber || 1),
      postDate,
      category,
      originalName,
      itemIndex,
    });
    await exec(
      "INSERT INTO upload_intents (id,user_uid,client_id,remote_path,stored_name,mime_type,size_bytes,upload_share_id,owner_type,owner_id,category,original_name,asset_id,local_path,logical_path,visibility,item_index,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,DATE_ADD(NOW(),INTERVAL 1 DAY))",
      [
        intentId,
        ctx.userUid,
        clientId,
        "",
        path.basename(localPath),
        String(data.mimeType || "").toLowerCase(),
        Number(data.size || 0),
        "",
        "post",
        String(post?.id || requestedOwnerId || clientId),
        category,
        String(data.fileName || "media").slice(0, 255),
        assetId,
        localPath,
        localPath,
        visibility,
        itemIndex,
      ],
    );
    return ok({
      intentId,
      assetId,
      uploadUrl: `/api/uploads/media?intentId=${encodeURIComponent(intentId)}`,
      logicalPath: localPath,
      visibility,
    });
  }

  if (route === "/uploads/media/finalize" && method === "POST") {
    const data = await body(req);
    const intent = (
      await rows(
        "SELECT * FROM upload_intents WHERE id = ? AND user_uid = ? AND finalized_at IS NULL AND expires_at > NOW() LIMIT 1",
        [String(data.intentId || ""), ctx.userUid],
      )
    )[0];
    if (!intent) return err("Upload invÃ¡lido ou expirado.", 404);
    if (!intent.local_path || !intent.checksum)
      return err("Upload ainda nÃ£o foi persistido.", 409);
    const canonicalUrl = `/api/media/assets/${intent.asset_id}/content`;
    const nextcloudState = process.env.NEXTCLOUD_SYNC_ENABLED === "true" ? "pending" : "waiting_configuration";
    const storageProvider = process.env.NEXTCLOUD_SYNC_ENABLED === "true" && process.env.NEXTCLOUD_MOUNT_PATH ? "nextcloud-mount" : "local";
    const connection = await getDbPool().getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        `INSERT INTO media_assets
         (id,clientId,ownerType,ownerId,category,storageProvider,storageKey,publicUrl,mimeType,sizeBytes,originalName,checksum,status,createdBy,storageState,localPath,sha256,detectedMimeType,logicalPath,visibility,relocationState,nextcloudState)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'active',?,'local_only',?,?,?,?,?,'current',?)`,
        [
          intent.asset_id,
          intent.client_id,
          intent.owner_type,
          intent.owner_id,
          intent.category,
          storageProvider,
          intent.local_path,
          canonicalUrl,
          intent.mime_type,
          intent.size_bytes,
          intent.original_name,
          intent.checksum,
          ctx.userUid,
          intent.local_path,
          intent.checksum,
          intent.mime_type,
          intent.logical_path,
          intent.visibility,
          nextcloudState,
        ],
      );
      await connection.execute(
        "INSERT INTO media_sync_jobs (mediaAssetId,status,nextAttemptAt) VALUES (?,?,NOW())",
        [
          intent.asset_id,
          nextcloudState,
        ],
      );
      await connection.execute(
        "UPDATE upload_intents SET finalized_at=NOW(),final_url=? WHERE id=?",
        [canonicalUrl, intent.id],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    return ok({
      url: canonicalUrl,
      provider: storageProvider,
      assetId: intent.asset_id,
      storageState: "local_only",
      logicalPath: intent.logical_path,
      checksum: intent.checksum,
      visibility: intent.visibility,
      mirrorState: "pending",
    });
  }

  if (route === "/uploads/media" && method === "PUT") {
    if (process.env.VERCEL) return err("Use o fluxo de upload direto.", 409);
    if (!req.body) return err("Arquivo obrigatÃ³rio.", 400);
    if (await rateLimited(`media:${ctx.userUid}`, 20, 60_000))
      return err("Limite de uploads excedido.", 429);
    const intentId = String(
      req.headers.get("x-upload-intent-id") ||
      new URL(req.url).searchParams.get("intentId") ||
      "",
    );
    if (intentId) {
      const intent = (
        await rows(
          "SELECT * FROM upload_intents WHERE id=? AND user_uid=? AND finalized_at IS NULL AND expires_at>NOW() LIMIT 1",
          [intentId, ctx.userUid],
        )
      )[0];
      if (!intent) return err("Upload invÃ¡lido ou expirado.", 404);
      const uploadBody =
        String(intent.mime_type).startsWith("image/") &&
          Number(intent.size_bytes) <= 50 * 1024 * 1024
          ? new Blob([await req.arrayBuffer()]).stream()
          : req.body;
      let stored;
      try {
        stored = await storeMediaLocally({
          body: uploadBody,
          relativePath: intent.local_path,
          mimeType: intent.mime_type,
          expectedSize: Number(intent.size_bytes),
          category: intent.category,
          visibility: intent.visibility,
        });
      } catch (error) {
        await exec(
          "DELETE FROM upload_intents WHERE id=? AND user_uid=?",
          [intent.id, ctx.userUid],
        );
        throw error;
      }
      await exec(
        "UPDATE upload_intents SET checksum=?,local_path=? WHERE id=?",
        [stored.checksum, stored.localPath, intent.id],
      );
      return ok({
        intentId,
        sizeBytes: stored.sizeBytes,
        checksum: stored.checksum,
      });
    }
    return err("Inicialize o upload para obter um caminho canonico.", 409, "UPLOAD_INTENT_REQUIRED");
  }

  return null;
}
