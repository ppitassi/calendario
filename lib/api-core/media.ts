import { NextRequest, NextResponse } from "next/server";
import { ApiContext } from "../api-types";
import { err, ok } from "../api-response";
import { body, rateLimited } from "./context";
import { registerMediaAsset } from "./media-utils";
import { uploadBase64 } from "./upload-base64";

/**
 * Small uploads used by profile, client branding and audio settings.
 * Work-item files use the multipart `/work-items/:id/assets` endpoint so every
 * asset is linked through the universal work-item model.
 */
export async function handleMediaApi(
  method: string,
  route: string,
  req: NextRequest,
  ctx: ApiContext,
): Promise<NextResponse | null> {
  if (
    (route !== "/upload-base64" && route !== "/upload-audio") ||
    method !== "POST"
  ) {
    return null;
  }

  if (await rateLimited(`asset:${ctx.userUid}`, 30, 60_000)) {
    return err("Limite de uploads excedido.", 429);
  }

  const data = await body(req);
  const folder = String(
    data.subfolder || (route === "/upload-audio" ? "audio" : "profiles"),
  );
  if (folder === "posts") {
    return err(
      "Envie arquivos da publicação pelo item de trabalho.",
      409,
      "WORK_ITEM_ASSET_REQUIRED",
    );
  }

  if (
    ["logos", "audio"].includes(folder) &&
    !ctx.permissions.has("canConfigClients")
  ) {
    return err("Permissão insuficiente.", 403);
  }
  if (
    folder === "branding" &&
    !ctx.permissions.has("canManageBrandSystem")
  ) {
    return err("Permissão insuficiente.", 403);
  }
  if (
    ["avatars", "profiles"].includes(folder) &&
    String(data.targetUserId || ctx.userUid) !== ctx.userUid &&
    !ctx.permissions.has("canManageRoles")
  ) {
    return err("Permissão insuficiente.", 403);
  }

  const stored = await uploadBase64(data, route === "/upload-audio");
  const categoryMap: Record<string, string> = {
    avatars: "avatar",
    profiles: "avatar",
    logos: "logo",
    branding: "agency_logo",
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
