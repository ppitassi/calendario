import path from "path";
import { promises as fsp } from "fs";
import { randomBytes } from "crypto";
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
  const refs = await rows(
    `SELECT 1 FROM clients WHERE logoUrl = ?
     UNION ALL SELECT 1 FROM agencies WHERE logo_url = ? OR logo_dark_url = ?
     UNION ALL SELECT 1 FROM users WHERE photoURL = ?
     UNION ALL SELECT 1 FROM posts WHERE feedImages LIKE ? OR storyImage = ? OR coverImage = ? OR linkedinCover = ? OR videoUrl = ? LIMIT 1`,
    [
      url,
      url,
      url,
      url,
      `%${url}%`,
      url,
      url,
      url,
      url,
    ],
  );
  if (refs.length) return;
  const assets = await rows(
    "SELECT id, storageProvider, storageKey FROM media_assets WHERE publicUrl = ? AND status = 'active'",
    [url],
  );
  await exec(
    "UPDATE media_assets SET status = 'deleted', deletedAt = NOW() WHERE publicUrl = ? AND status = 'active'",
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
  const id = randomBytes(24).toString("hex");
  await exec(
    `INSERT INTO media_assets
     (id, clientId, ownerType, ownerId, category, storageProvider, storageKey, publicUrl, mimeType, sizeBytes, width, height, originalName, checksum, status, createdBy)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
    [
      id,
      data.clientId || null,
      ownerType,
      ownerId,
      category + suffix,
      stored.provider,
      stored.storageKey,
      stored.url || null,
      stored.mimeType || data.mimeType || "application/octet-stream",
      Number(stored.sizeBytes || data.size || 0),
      stored.width || null,
      stored.height || null,
      String(stored.originalName || data.fileName || "asset").slice(0, 255),
      stored.checksum || null,
      ctx.userUid,
    ],
  );
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
