/**
 * Assets = metadata/referência de arquivos que vivem no Nextcloud.
 * Nunca guarda binário. Não existe deleteFile: remover vínculo = `detachAsset`
 * (marca detached_at; o arquivo permanece intacto no Nextcloud).
 */

import crypto from "node:crypto";
import { getDb } from "./db";
import type { SafeUser } from "./auth";
import type { Asset } from "./task-types";

export class ForbiddenError extends Error {
  constructor(message = "Acesso negado.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

function mapAsset(r: any): Asset {
  return {
    id: r.id,
    provider: "nextcloud",
    nextcloudFileId: r.nextcloud_file_id,
    nextcloudPath: r.nextcloud_path,
    filename: r.filename,
    mimeType: r.mime_type || undefined,
    sizeBytes: r.size_bytes != null ? Number(r.size_bytes) : undefined,
    etag: r.etag || undefined,
    workUnitId: r.work_unit_id || undefined,
    taskId: r.task_id || undefined,
    postId: r.post_id || undefined,
    previewAssetId: r.preview_asset_id || undefined,
    uploadedById: r.uploaded_by_id || undefined,
    detachedAt: r.detached_at || undefined,
    archivedAt: r.archived_at || undefined,
    createdAt: r.created_at,
  };
}

export async function getAsset(assetId: string): Promise<Asset | null> {
  const row = await getDb().prepare("SELECT * FROM assets WHERE id = ?").get(assetId);
  return row ? mapAsset(row) : null;
}

export async function createAsset(input: {
  nextcloudFileId: string;
  nextcloudPath: string;
  filename: string;
  mimeType?: string;
  sizeBytes?: number;
  etag?: string;
  workUnitId?: string | null;
  taskId?: string | null;
  postId?: string | null;
  previewAssetId?: string | null;
  uploadedById?: string | null;
}): Promise<Asset> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await getDb()
    .prepare(
      `INSERT INTO assets (id, provider, nextcloud_file_id, nextcloud_path, filename, mime_type, size_bytes, etag,
         work_unit_id, task_id, post_id, preview_asset_id, uploaded_by_id, created_at)
       VALUES (?, 'nextcloud', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id, input.nextcloudFileId, input.nextcloudPath, input.filename, input.mimeType || null,
      input.sizeBytes ?? null, input.etag || null, input.workUnitId || null, input.taskId || null,
      input.postId || null, input.previewAssetId || null, input.uploadedById || null, now
    );
  return (await getAsset(id))!;
}

async function setLink(assetId: string, column: "work_unit_id" | "task_id" | "post_id", value: string) {
  await getDb()
    .prepare(`UPDATE assets SET ${column} = ?, detached_at = NULL WHERE id = ?`)
    .run(value, assetId);
}
export const attachAssetToWorkUnit = (assetId: string, workUnitId: string) => setLink(assetId, "work_unit_id", workUnitId);
export const attachAssetToTask = (assetId: string, taskId: string) => setLink(assetId, "task_id", taskId);
export const attachAssetToPost = (assetId: string, postId: string) => setLink(assetId, "post_id", postId);

/** Desvincula sem apagar nada: o arquivo permanece no Nextcloud e a linha fica como histórico. */
export async function detachAsset(assetId: string): Promise<void> {
  await getDb()
    .prepare("UPDATE assets SET detached_at = ? WHERE id = ?")
    .run(new Date().toISOString(), assetId);
}

/** Master + preview: se houver preview, é ele que o browser reproduz. */
export async function resolvePlaybackAsset(asset: Asset): Promise<Asset> {
  if (asset.previewAssetId) {
    const preview = await getAsset(asset.previewAssetId);
    if (preview) return preview;
  }
  return asset;
}

/** admin/social_media veem tudo; designer só o que é seu (upload ou atribuição efetiva). */
export async function assertCanViewAsset(user: SafeUser, asset: Asset): Promise<void> {
  if (user.role === "admin" || user.role === "social_media") return;
  if (asset.uploadedById === user.id) return;
  if (asset.postId) return; // posts do calendário são visíveis à equipe

  const db = getDb();
  if (asset.taskId) {
    const row = await db
      .prepare(
        `SELECT COALESCE(t.assignee_id, wu.executor_id, wu.owner_id, c.owner_id) AS eff
         FROM tasks t JOIN work_units wu ON wu.id = t.work_unit_id JOIN clients c ON c.id = wu.client_id
         WHERE t.id = ?`
      )
      .get(asset.taskId);
    if (row && (row as any).eff === user.id) return;
  }
  if (asset.workUnitId) {
    const row = await db
      .prepare(
        `SELECT 1 AS ok FROM work_units wu JOIN clients c ON c.id = wu.client_id
         WHERE wu.id = ? AND (
           wu.executor_id = ? OR wu.owner_id = ? OR c.owner_id = ? OR EXISTS (
             SELECT 1 FROM tasks t WHERE t.work_unit_id = wu.id AND t.assignee_id = ? AND t.deleted_at IS NULL))`
      )
      .get(asset.workUnitId, user.id, user.id, user.id, user.id);
    if (row) return;
  }
  throw new ForbiddenError("Você não tem permissão para visualizar este arquivo.");
}
