import { promises as fsp, createWriteStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createHash, randomBytes } from "node:crypto";
import sharp from "sharp";
import { FILE_EXTENSIONS, localUploadsRoot, matchesFileSignature } from "./core";
import { canonicalAssetsRoot, isDocumentCategory, validateUploadName } from "./asset-paths";

export function safeSegment(value: string, fallback: string) {
  return String(value || fallback).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100) || fallback;
}

export function formatCalendarMonthFolder(value: string | Date) {
  const date = value instanceof Date ? value : new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error("MEDIA_POST_DATE_INVALID");
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" })
    .format(date)
    .toLocaleUpperCase("pt-BR");
}

export function buildLocalMediaPath(input: {
  assetId: string;
  clientId: string;
  clientName: string;
  postId: string;
  postNumber: number;
  postDate: string;
  category: string;
  originalName: string;
}) {
  const date = new Date(`${input.postDate.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error("MEDIA_POST_DATE_INVALID");
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const client = `${safeSegment(input.clientName, "Cliente")}__${safeSegment(input.clientId, "client")}`;
  const post = `${String(Math.max(1, input.postNumber)).padStart(2, "0")} - ${day}-${month}-${year}__${safeSegment(input.postId, "post")}`;
  const file = `${safeSegment(input.assetId, "asset")}__${safeSegment(input.category, "media")}__${safeSegment(input.originalName, "media")}`;
  return path.join("media", client, formatCalendarMonthFolder(input.postDate), post, "original", file);
}

export async function storeMediaLocally(input: {
  body: ReadableStream<Uint8Array>;
  relativePath: string;
  mimeType: string;
  expectedSize: number;
  category?: string;
  visibility?: "public" | "protected";
}) {
  const document = isDocumentCategory(input.category || "");
  const maxBytes = document ? 100 * 1024 * 1024 : 2 * 1024 * 1024 * 1024;
  if (!input.expectedSize || input.expectedSize > maxBytes) throw new Error("MEDIA_SIZE_INVALID");
  const usingNextcloudMount = process.env.NEXTCLOUD_SYNC_ENABLED === "true" && Boolean(process.env.NEXTCLOUD_MOUNT_PATH);
  const root = usingNextcloudMount ? canonicalAssetsRoot() : input.visibility === "public" ? canonicalAssetsRoot() : localUploadsRoot();
  const target = path.resolve(root, input.relativePath);
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("MEDIA_PATH_INVALID");
  const extension = validateUploadName(path.basename(input.relativePath), input.mimeType);
  const expectedExtensions = FILE_EXTENSIONS[input.mimeType];
  if (expectedExtensions && !expectedExtensions.includes(extension)) throw new Error("MEDIA_EXTENSION_MISMATCH");
  await fsp.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.uploading-${randomBytes(6).toString("hex")}`;
  const hash = createHash("sha256");
  let sizeBytes = 0;
  const source = Readable.fromWeb(input.body as any);
  source.on("data", (chunk: Buffer) => {
    sizeBytes += chunk.length;
    if (sizeBytes > maxBytes) source.destroy(new Error("MEDIA_SIZE_INVALID"));
    hash.update(chunk);
  });
  try {
    await pipeline(source, createWriteStream(temporary, { flags: "wx" }));
    if (sizeBytes !== input.expectedSize) throw new Error("MEDIA_SIZE_MISMATCH");
    const handle = await fsp.open(temporary, "r");
    const signature = Buffer.alloc(32);
    const { bytesRead } = await handle.read(signature, 0, signature.length, 0);
    await handle.close();
    if (document) {
      const ascii = signature.subarray(0, bytesRead).toString("ascii");
      if (extension === "pdf" && !ascii.startsWith("%PDF-")) throw new Error("MEDIA_SIGNATURE_INVALID");
      if (["docx", "xlsx", "pptx", "odt", "ods", "odp", "zip"].includes(extension) && !(signature[0] === 0x50 && signature[1] === 0x4b)) throw new Error("MEDIA_SIGNATURE_INVALID");
      if (["doc", "xls", "ppt"].includes(extension) && !signature.subarray(0, 8).equals(Buffer.from([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1]))) throw new Error("MEDIA_SIGNATURE_INVALID");
    } else if (input.mimeType.startsWith("image/")) {
      const metadata = await sharp(temporary, { limitInputPixels: 64_000_000 }).metadata().catch(() => null);
      const detected = metadata?.format === "jpeg" ? "image/jpeg" : metadata?.format === "png" ? "image/png" : metadata?.format === "webp" ? "image/webp" : "";
      if (detected !== input.mimeType.trim().toLowerCase()) throw new Error("MEDIA_SIGNATURE_INVALID");
    } else if (!matchesFileSignature(signature.subarray(0, bytesRead), input.mimeType.trim().toLowerCase())) {
      throw new Error("MEDIA_SIGNATURE_INVALID");
    }
    await fsp.rename(temporary, target);
  } catch (error) {
    await fsp.unlink(temporary).catch(() => undefined);
    throw error;
  }
  return {
    provider: usingNextcloudMount ? "nextcloud-mount" : "local",
    storageKey: relative.split(path.sep).join("/"),
    localPath: relative.split(path.sep).join("/"),
    sizeBytes,
    checksum: hash.digest("hex"),
  };
}
