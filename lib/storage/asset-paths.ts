import path from "node:path";

export type AssetVisibility = "public" | "protected";

const FORMAT_ALIASES: Record<string, "feed" | "story" | "carousel" | "reel"> = {
  story: "story",
  carousel: "carousel",
  reel: "reel",
  post: "feed",
  promoted: "feed",
  linkedin: "feed",
  feed: "feed",
};

const BLOCKED_EXTENSIONS = new Set([
  "apk", "app", "bat", "bash", "bin", "cjs", "cmd", "com", "deb", "dll", "dmg",
  "docm", "exe", "hta", "htm", "html", "iso", "jar", "js", "jsx", "lnk", "mjs",
  "msi", "msp", "pkg", "ps1", "reg", "rpm", "scr", "sh", "svg", "ts", "tsx",
  "xlam", "xlsm", "pptm",
]);

const BLOCKED_MIME = /(?:html|javascript|ecmascript|svg|x-executable|x-msdownload|x-sh|x-shellscript)/i;

export function compactSlug(value: string, fallback = "cliente") {
  const normalized = String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 80);
  return normalized || fallback;
}

export function titleSlug(value: string, fallback = "post") {
  const normalized = String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return normalized || fallback;
}

export function plannerFormat(value: string) {
  return FORMAT_ALIASES[String(value || "").toLowerCase()] || "feed";
}

export function fileExtension(fileName: string) {
  const base = path.basename(String(fileName || ""));
  const extension = path.extname(base).slice(1).toLowerCase();
  return extension.replace(/[^a-z0-9]/g, "").slice(0, 12);
}

export function validateUploadName(fileName: string, mimeType: string) {
  const raw = String(fileName || "");
  if (!raw || raw !== path.basename(raw) || /[\\/\0]/.test(raw)) throw new Error("MEDIA_FILENAME_INVALID");
  const extension = fileExtension(raw);
  if (!extension || BLOCKED_EXTENSIONS.has(extension) || BLOCKED_MIME.test(String(mimeType || ""))) {
    throw new Error("MEDIA_TYPE_BLOCKED");
  }
  return extension;
}

export function isDocumentCategory(category: string) {
  return category === "post_document" || category === "document";
}

export function buildPostAssetPath(input: {
  assetId: string;
  clientName: string;
  postDate: string | Date;
  postType: string;
  postTitle: string;
  postOrder: number;
  originalName: string;
  category: string;
  itemIndex?: number;
}) {
  const date = input.postDate instanceof Date ? input.postDate : new Date(`${String(input.postDate).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error("MEDIA_POST_DATE_INVALID");
  const month = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(date).toLocaleUpperCase("pt-BR");
  const format = plannerFormat(input.postType);
  const order = String(Math.max(1, Number(input.postOrder) || 1)).padStart(2, "0");
  const item = format === "carousel" ? `--item-${String(Math.max(1, input.itemIndex || 1)).padStart(2, "0")}` : "";
  const extension = validateUploadName(input.originalName, "application/octet-stream");
  const fileName = `${order}-${titleSlug(input.postTitle)}${item}--${input.assetId}.${extension}`;
  return [
    "posts",
    compactSlug(input.clientName),
    month,
    format,
    ...(isDocumentCategory(input.category) ? ["documents"] : []),
    fileName,
  ].join("/");
}

export function publicPostsRoot() {
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), "public");
}

export function canonicalAssetsRoot() {
  const mount = String(process.env.NEXTCLOUD_MOUNT_PATH || "").trim();
  if (process.env.NEXTCLOUD_SYNC_ENABLED === "true" && mount) return path.resolve(mount);
  return publicPostsRoot();
}
