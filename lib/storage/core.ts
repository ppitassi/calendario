import { accessSync, constants, mkdirSync } from "node:fs";
import path from "node:path";

export const MIME_EXTENSIONS: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
};

export const FILE_EXTENSIONS: Record<string, string[]> = {
  "video/mp4": ["mp4"],
  "video/webm": ["webm"],
  "video/quicktime": ["mov"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "audio/mpeg": ["mp3"],
  "audio/wav": ["wav"],
  "audio/ogg": ["ogg"],
};

export function matchesFileSignature(bytes: Uint8Array, mimeType: string) {
  const ascii = (start: number, length: number) =>
    String.fromCharCode(...bytes.slice(start, start + length));
  if (mimeType === "video/mp4") return ascii(4, 4) === "ftyp";
  if (mimeType === "video/quicktime") return ascii(4, 4) === "ftyp";
  if (mimeType === "video/webm")
    return (
      bytes[0] === 0x1a &&
      bytes[1] === 0x45 &&
      bytes[2] === 0xdf &&
      bytes[3] === 0xa3
    );
  if (mimeType === "image/jpeg")
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png")
    return bytes[0] === 0x89 && ascii(1, 3) === "PNG";
  if (mimeType === "image/webp")
    return ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP";
  if (mimeType === "audio/wav")
    return ascii(0, 4) === "RIFF" && ascii(8, 4) === "WAVE";
  if (mimeType === "audio/ogg") return ascii(0, 4) === "OggS";
  if (mimeType === "audio/mpeg")
    return ascii(0, 3) === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
  return false;
}

export function localUploadsRoot() {
  const configured = String(process.env.UPLOAD_STORAGE_ROOT || "").trim();
  if (process.env.NODE_ENV !== "production")
    return path.resolve(
      configured || path.join(/* turbopackIgnore: true */ process.cwd(), "server", "uploads"),
    );
  if (!configured || !path.isAbsolute(configured))
    throw new Error(
      "UPLOAD_STORAGE_ROOT must be an absolute writable path in production.",
    );
  const root = path.resolve(configured);
  const repository = path.resolve(/* turbopackIgnore: true */ process.cwd());
  const forbidden = [
    repository,
    path.join(repository, ".next"),
    path.join(repository, "server", "uploads"),
  ];
  if (
    forbidden.some(
      (item) => root === item || root.startsWith(item + path.sep),
    )
  )
    throw new Error(
      "UPLOAD_STORAGE_ROOT must be outside the application repository.",
    );
  mkdirSync(root, { recursive: true });
  accessSync(root, constants.R_OK | constants.W_OK);
  return root;
}

export function localFallbackEnabled() {
  return process.env.UPLOAD_LOCAL_FALLBACK_ENABLED === "true";
}
