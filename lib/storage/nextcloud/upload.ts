/**
 * Upload direto browser → Nextcloud via link público "file drop" (somente criar, expira em 1 dia).
 * A Vercel só autentica, autoriza, resolve destino e registra metadata — o binário não passa por ela.
 */

import crypto from "node:crypto";
import { getDb } from "../../db";
import type { SafeUser } from "../../auth";
import { createAsset, ForbiddenError } from "../../assets";
import type { Asset } from "../../task-types";
import type { UploadContext, UploadTarget } from "../storage-provider";
import { StoragePolicyError } from "../storage-provider";
import { getNextcloudClient } from "./client";
import { resolveStorageTarget } from "./resolve-target";
import { statNode, uniqueFilename } from "./webdav";

function secret(): string {
  return String(process.env.STORAGE_INTENT_SECRET || process.env.NEXTCLOUD_APP_PASSWORD || "");
}

function tomorrow(days = 1): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

type IntentPayload = {
  u: string; folder: string; name: string; share: string;
  w?: string; t?: string; c: string; mime?: string; exp: number;
};

export function signIntent(p: IntentPayload): string {
  const body = Buffer.from(JSON.stringify(p)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyIntent(token: string): IntentPayload {
  const [body, sig] = String(token).split(".");
  const expected = crypto.createHmac("sha256", secret()).update(body || "").digest("base64url");
  if (!body || !sig || sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    throw new ForbiddenError("Intenção de upload inválida.");
  }
  const p = JSON.parse(Buffer.from(body, "base64url").toString()) as IntentPayload;
  if (p.exp < Date.now()) throw new ForbiddenError("Intenção de upload expirada.");
  return p;
}

function sanitizeFilename(name: string): string {
  const clean = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim();
  return clean || "arquivo";
}

export async function createUploadTarget(ctx: UploadContext): Promise<UploadTarget & { intent: string }> {
  const nc = await getNextcloudClient();
  const target = await resolveStorageTarget(ctx);
  const filename = await uniqueFilename(target.path, sanitizeFilename(ctx.filename));

  const share = await nc.ocs("POST", "/apps/files_sharing/api/v1/shares", {
    path: target.path,
    shareType: "3",
    permissions: "4", // create-only (file drop): não lê, não altera, não apaga
    expireDate: tomorrow(1),
    label: "studio-upload",
  });
  const token: string = share.token;
  const shareId = String(share.id);
  const expiresAt = new Date(Date.now() + 3600_000).toISOString();

  const intent = signIntent({
    u: ctx.userId, folder: target.path, name: filename, share: shareId,
    w: ctx.workUnitId, t: ctx.taskId, c: ctx.clientId, mime: ctx.mimeType,
    exp: Date.now() + 3600_000,
  });

  return {
    uploadUrl: `${nc.config.baseUrl}/public.php/webdav/${encodeURIComponent(filename)}`,
    method: "PUT",
    headers: {
      Authorization: "Basic " + Buffer.from(`${token}:`).toString("base64"),
      "If-None-Match": "*", // nunca sobrescrever
      "X-Requested-With": "XMLHttpRequest",
    },
    folderPath: target.path,
    filename,
    shareId,
    expiresAt,
    intent,
  };
}

/** Após o PUT do browser: confere o arquivo no Nextcloud e grava a referência. */
export async function confirmUpload(user: SafeUser, intentToken: string): Promise<Asset> {
  const p = verifyIntent(intentToken);
  if (p.u !== user.id) throw new ForbiddenError();

  const nc = await getNextcloudClient();
  const path = `${p.folder}/${p.name}`;
  const node = await statNode(path);
  if (!node || node.type !== "file") throw new StoragePolicyError("Arquivo não encontrado no Nextcloud após o upload.");

  const dup = await getDb().prepare("SELECT id FROM assets WHERE nextcloud_file_id = ? AND detached_at IS NULL").get(node.remoteFileId);
  if (dup) throw new StoragePolicyError("Este arquivo já está registrado.");

  const asset = await createAsset({
    nextcloudFileId: node.remoteFileId,
    nextcloudPath: node.path,
    filename: node.name,
    mimeType: node.mimeType || p.mime,
    sizeBytes: node.size,
    etag: node.etag,
    workUnitId: p.w,
    taskId: p.t,
    uploadedById: user.id,
  });

  await getDb()
    .prepare(
      `INSERT INTO activity_events (id, entity_type, entity_id, actor_id, event_type, metadata, created_at)
       VALUES (?, ?, ?, ?, 'attachment_added', ?, ?)`
    )
    .run(
      crypto.randomUUID(), p.t ? "task" : "work_unit", (p.t || p.w || asset.id), user.id,
      JSON.stringify({ assetId: asset.id, filename: asset.filename }), new Date().toISOString()
    );

  // Revoga o link de upload (não remove arquivo nenhum): best-effort.
  nc.ocs("DELETE", `/apps/files_sharing/api/v1/shares/${encodeURIComponent(p.share)}`).catch(() => {});
  return asset;
}
