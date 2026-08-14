import path from "path";
import { promises as fsp } from "fs";
import { randomUUID } from "crypto";
import { exec, parseJson, rows } from "../db";
import { deleteStoredAsset, localUploadsRoot } from "../storage";
import { ApiContext as Ctx } from "../api-types";

export function assetUrls(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(assetUrls);
  if (typeof value === "string" && value.startsWith("/uploads/"))
    return [value];
  if (typeof value === "string" && value.startsWith("["))
    return assetUrls(parseJson(value, []));
  return [];
}

export async function removeLocalAssetIfUnreferenced(url: string) {
  const refs=await rows(`SELECT 1 FROM clients WHERE logo_url=? UNION ALL SELECT 1 FROM agency_profile WHERE logo=? OR logo_dark=? UNION ALL SELECT 1 FROM users WHERE avatar=? LIMIT 1`,[url,url,url,url]);
  if (refs.length) return;
  const assets = await rows(
    "SELECT id,storage_provider storageProvider,storage_key storageKey FROM media_assets WHERE storage_key=? AND deleted_at IS NULL",
    [url],
  );
  await exec(
    "UPDATE media_assets SET deleted_at=NOW() WHERE storage_key=? AND deleted_at IS NULL",
    [url],
  );
  for (const asset of assets)
    await deleteStoredAsset(asset.storageProvider, asset.storageKey).catch(
      () => undefined,
    );
  if (!url.startsWith("/uploads/")) return;
  const relativeParts = url
    .split("?")[0]
    .split("/")
    .filter(Boolean)
    .slice(1)
    .map(decodeURIComponent);
  const root = localUploadsRoot();
  const target = path.resolve(root, ...relativeParts);
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return;
  await fsp.unlink(target).catch(() => undefined);
}

export async function registerMediaAsset(
  ctx: Ctx,
  data: any,
  stored: any,
  category: string,
  suffix = "",
) {
  const ownerType =
    category === "avatar"
      ? "user"
      : category.startsWith("agency")
        ? "agency"
        : category === "logo"
          ? "client"
          : category === "audio"
            ? "client"
            : "post";
  const ownerId = String(
    data.ownerId ||
    data.targetUserId ||
    data.clientId ||
    ctx.userUid ||
    "agency",
  );
  const id=randomUUID(),entityType=ownerType.toUpperCase(),entityId=ownerId,originalName=String(stored.originalName||data.fileName||"asset").slice(0,512),mimeType=stored.mimeType||data.mimeType||"application/octet-stream",size=Number(stored.sizeBytes||data.size||0);
  await exec(
    `INSERT INTO media_assets (id,storage_provider,storage_key,original_name,mime_type,byte_size,checksum_sha256,created_by) VALUES (?,?,?,?,?,?,?,?)`,
    [
      id,
      stored.provider,
      stored.storageKey,
      originalName,
      mimeType,
      size,
      stored.checksum || null,
      ctx.userUid,
    ],
  );
  await exec("INSERT INTO asset_versions (id,logical_asset_id,media_asset_id,version_number,created_by) VALUES (?,?,?,?,?)",[randomUUID(),id,id,1,ctx.userUid]);await exec("INSERT INTO file_links (id,media_asset_id,entity_type,entity_id,category) VALUES (?,?,?,?,?)",[randomUUID(),id,entityType,entityId,category+suffix]);
  return id;
}

export const POST_MEDIA_CATEGORIES = new Set([
  "post_feed",
  "post_story",
  "post_cover",
  "post_linkedin_cover",
  "post_video",
  "post_document",
  "artwork",
  "media",
]);

export function normalizedPostMediaCategory(value: unknown) {
  const category = String(value || "media")
    .trim()
    .toLowerCase();
  if (!POST_MEDIA_CATEGORIES.has(category))
    throw Object.assign(new Error("Categoria de mídia inválida."), {
      code: "MEDIA_CATEGORY_INVALID",
      status: 422,
    });
  return category;
}
