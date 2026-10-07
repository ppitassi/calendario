/**
 * Playback direto: a Vercel só autoriza; o browser consome o Nextcloud (HTTP Range nativo).
 * Usa link público read-only de curta duração (cacheado em assets.share_token), nunca um proxy.
 */

import type { SafeUser } from "../../auth";
import { assertCanViewAsset, getAsset, resolvePlaybackAsset } from "../../assets";
import { getDb } from "../../db";
import type { PlaybackSource } from "../storage-provider";
import { getNextcloudClient } from "./client";

const SHARE_TTL_DAYS = 2;

/** Núcleo sem checagem de permissão (use getAssetPlaybackSource nas rotas). */
export async function getPlaybackSource(assetId: string, _userId: string): Promise<PlaybackSource> {
  const base = await getAsset(assetId);
  if (!base) throw new Error("Asset não encontrado.");
  const asset = await resolvePlaybackAsset(base); // preview otimizado, se existir
  const nc = await getNextcloudClient();
  const db = getDb();

  const row = (await db.prepare("SELECT share_token, share_expires_at FROM assets WHERE id = ?").get(asset.id)) as
    | { share_token?: string; share_expires_at?: string } | undefined;

  let token = row?.share_token || "";
  let expiresAt = row?.share_expires_at || "";
  const stillValid = token && expiresAt && new Date(expiresAt).getTime() > Date.now() + 3600_000;

  if (!stillValid) {
    const exp = new Date(Date.now() + SHARE_TTL_DAYS * 86400000);
    const share = await nc.ocs("POST", "/apps/files_sharing/api/v1/shares", {
      path: asset.nextcloudPath,
      shareType: "3",
      permissions: "1", // somente leitura
      expireDate: exp.toISOString().slice(0, 10),
      label: "studio-view",
    });
    token = share.token;
    expiresAt = exp.toISOString();
    await db.prepare("UPDATE assets SET share_token = ?, share_expires_at = ? WHERE id = ?").run(token, expiresAt, asset.id);
  }

  return {
    url: `${nc.config.baseUrl}/s/${encodeURIComponent(token)}/download`,
    expiresAt,
    mimeType: asset.mimeType,
    filename: asset.filename,
  };
}

/** Passo 1-5 do fluxo: carrega, valida permissão, resolve e devolve URL utilizável pelo browser. */
export async function getAssetPlaybackSource(assetId: string, currentUser: SafeUser): Promise<PlaybackSource> {
  const asset = await getAsset(assetId);
  if (!asset) throw new Error("Asset não encontrado.");
  await assertCanViewAsset(currentUser, asset);
  return getPlaybackSource(assetId, currentUser.id);
}
