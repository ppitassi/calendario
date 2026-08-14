import { promises as fsp, createWriteStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { randomBytes } from "node:crypto";
import { localFallbackEnabled, localUploadsRoot, matchesFileSignature, MIME_EXTENSIONS, FILE_EXTENSIONS } from "./core";
import { safeSegment } from "./local-provider";
import { canonicalAssetsRoot } from "./asset-paths";

export type StoreMediaInput = {
  body: ReadableStream<Uint8Array>;
  clientId: string;
  postDate?: string;
  fileName: string;
  mimeType: string;
  size: number;
  allowLocal?: boolean;
};

export async function validateAndRestoreStream(body: ReadableStream<Uint8Array>, mimeType: string, maxBytes: number) {
  const reader = body.getReader();
  const buffered: Uint8Array[] = [];
  let headSize = 0;
  while (headSize < 16) {
    const item = await reader.read();
    if (item.done) break;
    buffered.push(item.value);
    headSize += item.value.byteLength;
  }
  const head = new Uint8Array(headSize);
  let offset = 0;
  for (const chunk of buffered) {
    head.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (!matchesFileSignature(head, mimeType)) {
    await reader.cancel();
    throw new Error("MEDIA_SIGNATURE_INVALID");
  }
  let received = headSize;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of buffered) controller.enqueue(chunk);
    },
    async pull(controller) {
      const item = await reader.read();
      if (item.done) return controller.close();
      received += item.value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        return controller.error(new Error("MEDIA_SIZE_INVALID"));
      }
      controller.enqueue(item.value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

function encodedPath(parts: string[]) {
  return parts.map(encodeURIComponent).join("/");
}

export async function createNextcloudFolders(baseUrl: string, parts: string[], authorization: string) {
  for (let index = 1; index <= parts.length; index += 1) {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/${encodedPath(parts.slice(0, index))}`, {
      method: "MKCOL",
      headers: { Authorization: authorization },
    });
    if (!response.ok && response.status !== 405) throw new Error(`NEXTCLOUD_MKCOL_${response.status}`);
  }
}

export async function createPublicShare(remotePath: string, authorization: string, publicUpload = false) {
  const ocsUrl = process.env.NEXTCLOUD_OCS_URL;
  if (!ocsUrl) throw new Error("NEXTCLOUD_OCS_URL_REQUIRED");
  const endpoint = new URL(ocsUrl);
  endpoint.searchParams.set("format", "json");
  const shareBody: Record<string, string> = {
    path: remotePath,
    shareType: "3",
    permissions: publicUpload ? "4" : "1",
  };
  if (publicUpload) {
    shareBody.publicUpload = "true";
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    shareBody.expireDate = expiry.toISOString().slice(0, 10);
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "OCS-APIRequest": "true",
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(shareBody),
  });
  if (!response.ok) throw new Error(`NEXTCLOUD_SHARE_${response.status}`);
  const payload: any = await response.json();
  const share = payload?.ocs?.data;
  if (!share?.url || !share?.id || !share?.token) throw new Error("NEXTCLOUD_SHARE_DATA_MISSING");
  return {
    id: String(share.id),
    token: String(share.token),
    url: String(share.url).replace(/\/$/, ""),
  };
}

export async function deletePublicShare(shareId: string, authorization: string) {
  const ocsUrl = process.env.NEXTCLOUD_OCS_URL;
  if (!ocsUrl || !shareId) return;
  const endpoint = `${ocsUrl.replace(/\/$/, "")}/${encodeURIComponent(shareId)}?format=json`;
  await fetch(endpoint, {
    method: "DELETE",
    headers: { Authorization: authorization, "OCS-APIRequest": "true", Accept: "application/json" },
  }).catch(() => undefined);
}

export function nextcloudAuth() {
  const webdavUrl = process.env.NEXTCLOUD_WEBDAV_URL;
  const user = process.env.NEXTCLOUD_USERNAME;
  const password = process.env.NEXTCLOUD_APP_PASSWORD;
  if (!webdavUrl || !user || !password) throw new Error("NEXTCLOUD_WEBDAV_REQUIRED");
  return {
    webdavUrl: webdavUrl.replace(/\/$/, ""),
    authorization: `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`,
  };
}

export function publicDavBase(webdavUrl: string) {
  if (process.env.NEXTCLOUD_PUBLIC_DAV_URL) return process.env.NEXTCLOUD_PUBLIC_DAV_URL.replace(/\/$/, "");
  return `${new URL(webdavUrl).origin}/public.php/dav/files`;
}

export async function storeAssetBuffer(input: {
  buffer: Buffer;
  folder: string;
  fileName: string;
  mimeType: string;
  requireRemote?: boolean;
}) {
  const storedName = `${randomBytes(16).toString("hex")}-${safeSegment(input.fileName, "asset")}`;
  if (!process.env.NEXTCLOUD_WEBDAV_URL || !process.env.NEXTCLOUD_USERNAME || !process.env.NEXTCLOUD_APP_PASSWORD) {
    if (input.requireRemote) throw new Error("REMOTE_STORAGE_UNAVAILABLE");
    const folder = safeSegment(input.folder, "assets");
    const root = localUploadsRoot();
    const target = path.resolve(root, folder, storedName);
    const relative = path.relative(root, target);
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("MEDIA_PATH_INVALID");
    await fsp.mkdir(path.dirname(target), { recursive: true });
    const temporary=`${target}.${randomBytes(6).toString("hex")}.uploading`;
    try{await fsp.writeFile(temporary,input.buffer,{flag:"wx"});await fsp.rename(temporary,target)}catch(error){await fsp.unlink(temporary).catch(()=>undefined);throw error}
    return { url: `/uploads/${folder}/${storedName}`, provider: "local", storageKey: `${folder}/${storedName}` };
  }
  const { webdavUrl, authorization } = nextcloudAuth();
  const parts = [
    safeSegment(process.env.NEXTCLOUD_ROOT || "ContentPlanner", "ContentPlanner"),
    safeSegment(input.folder, "assets"),
  ];
  await createNextcloudFolders(webdavUrl, parts, authorization);
  const relativeParts = [...parts, storedName];
  const temporaryParts=[...parts,`.${storedName}.${randomBytes(6).toString("hex")}.uploading`];
  const response = await fetch(`${webdavUrl}/${encodedPath(temporaryParts)}`, {
    method: "PUT",
    headers: {
      Authorization: authorization,
      "Content-Type": input.mimeType,
      "Content-Length": String(input.buffer.length),
    },
    body: input.buffer, signal:AbortSignal.timeout(Math.max(10_000,Number(process.env.PDF_STORAGE_TIMEOUT_MS||60_000))),
  });
  if (!response.ok) throw new Error(`NEXTCLOUD_ASSET_UPLOAD_${response.status}`);
  const moved=await fetch(`${webdavUrl}/${encodedPath(temporaryParts)}`,{method:"MOVE",headers:{Authorization:authorization,Destination:`${webdavUrl}/${encodedPath(relativeParts)}`,Overwrite:"F"},signal:AbortSignal.timeout(Math.max(10_000,Number(process.env.PDF_STORAGE_TIMEOUT_MS||60_000)))});
  if(!moved.ok)throw new Error(`NEXTCLOUD_ASSET_MOVE_${moved.status}`);
  const share = await createPublicShare(`/${relativeParts.join("/")}`, authorization);
  return { url: `${share.url}/download`, provider: "nextcloud-webdav", storageKey: `/${relativeParts.join("/")}` };
}

export async function initDirectNextcloudUpload(input: {
  intentId: string;
  clientId: string;
  postDate?: string;
  fileName: string;
  mimeType: string;
  size: number;
}) {
  const extension = MIME_EXTENSIONS[input.mimeType];
  if (!extension) throw new Error("MEDIA_TYPE_NOT_ALLOWED");
  const originalExtension = path.extname(input.fileName).slice(1).toLowerCase();
  if (!FILE_EXTENSIONS[input.mimeType]?.includes(originalExtension)) throw new Error("MEDIA_EXTENSION_INVALID");
  const maxBytes = Math.max(1, Number(process.env.MAX_MEDIA_UPLOAD_GB || 20)) * 1024 * 1024 * 1024;
  if (!input.size || input.size > maxBytes) throw new Error("MEDIA_SIZE_INVALID");

  const { webdavUrl, authorization } = nextcloudAuth();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(input.postDate || "") ? String(input.postDate) : new Date().toISOString().slice(0, 10);
  const parts = [
    safeSegment(process.env.NEXTCLOUD_ROOT || "ContentPlanner", "ContentPlanner"),
    safeSegment(input.clientId, "client"),
    date.slice(0, 7),
    `upload-${safeSegment(input.intentId, "intent")}`,
  ];
  const storedName = `${date}-${safeSegment(path.parse(input.fileName).name, "media")}-${randomBytes(8).toString("hex")}.${extension}`;
  await createNextcloudFolders(webdavUrl, parts, authorization);
  const folderPath = `/${parts.join("/")}`;
  const share = await createPublicShare(folderPath, authorization, true);
  return {
    uploadUrl: `${publicDavBase(webdavUrl)}/${encodeURIComponent(share.token)}/${encodeURIComponent(storedName)}`,
    remotePath: `${folderPath}/${storedName}`,
    storedName,
    uploadShareId: share.id,
  };
}

export async function finalizeDirectNextcloudUpload(input: {
  remotePath: string;
  uploadShareId: string;
  mimeType: string;
  expectedSize: number;
}) {
  const { webdavUrl, authorization } = nextcloudAuth();
  const fileUrl = `${webdavUrl}/${encodedPath(input.remotePath.split("/").filter(Boolean))}`;
  const head = await fetch(fileUrl, { method: "HEAD", headers: { Authorization: authorization } });
  if (!head.ok) throw new Error("NEXTCLOUD_UPLOAD_NOT_FOUND");
  const actualSize = Number(head.headers.get("content-length") || 0);
  if (!actualSize || actualSize !== input.expectedSize) throw new Error("NEXTCLOUD_UPLOAD_SIZE_MISMATCH");

  const sampleResponse = await fetch(fileUrl, {
    headers: { Authorization: authorization, Range: "bytes=0-31" },
  });
  if (!sampleResponse.ok || !sampleResponse.body) throw new Error("NEXTCLOUD_UPLOAD_VERIFY_FAILED");
  const reader = sampleResponse.body.getReader();
  const first = await reader.read();
  await reader.cancel();
  const sample = first.value?.slice(0, 32) || new Uint8Array();
  if (!matchesFileSignature(sample, input.mimeType)) throw new Error("MEDIA_SIGNATURE_INVALID");

  await deletePublicShare(input.uploadShareId, authorization);
  const share = await createPublicShare(input.remotePath, authorization);
  return { url: `${share.url}/download`, provider: "nextcloud-direct", storageKey: input.remotePath };
}

export function isNextcloudConfigured() {
  return Boolean(
    process.env.NEXTCLOUD_MOUNT_PATH ||
    (process.env.NEXTCLOUD_WEBDAV_URL && process.env.NEXTCLOUD_USERNAME && process.env.NEXTCLOUD_APP_PASSWORD),
  );
}

export async function storeMedia(input: StoreMediaInput) {
  const extension = MIME_EXTENSIONS[input.mimeType];
  if (!extension) throw new Error("MEDIA_TYPE_NOT_ALLOWED");
  const originalExtension = path.extname(input.fileName).slice(1).toLowerCase();
  if (!FILE_EXTENSIONS[input.mimeType]?.includes(originalExtension)) throw new Error("MEDIA_EXTENSION_INVALID");
  const maxBytes = Math.max(1, Number(process.env.MAX_MEDIA_UPLOAD_GB || 20)) * 1024 * 1024 * 1024;
  if (!input.size || input.size > maxBytes) throw new Error("MEDIA_SIZE_INVALID");
  const validatedBody = await validateAndRestoreStream(input.body, input.mimeType, maxBytes);

  const date = /^\d{4}-\d{2}-\d{2}$/.test(input.postDate || "") ? String(input.postDate) : new Date().toISOString().slice(0, 10);
  const parts = [
    safeSegment(process.env.NEXTCLOUD_ROOT || "ContentPlanner", "ContentPlanner"),
    safeSegment(input.clientId, "client"),
    date.slice(0, 7),
  ];
  const baseName = safeSegment(path.parse(input.fileName).name, "media");
  const storedName = `${date}-${baseName}-${randomBytes(8).toString("hex")}.${extension}`;
  const relativeParts = [...parts, storedName];
  const remotePath = `/${relativeParts.join("/")}`;

  const mountPath = process.env.NEXTCLOUD_MOUNT_PATH;
  if (mountPath) {
    const absoluteRoot = path.resolve(mountPath);
    const target = path.resolve(absoluteRoot, ...relativeParts);
    const relative = path.relative(absoluteRoot, target);
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("MEDIA_PATH_INVALID");
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await pipeline(Readable.fromWeb(validatedBody as any), createWriteStream(target, { flags: "wx" }));
    const publicBase = process.env.NEXTCLOUD_PUBLIC_BASE_URL;
    if (publicBase) return { url: `${publicBase.replace(/\/$/, "")}/${encodedPath(relativeParts)}`, provider: "nextcloud-mount", storageKey: remotePath };
    const user = process.env.NEXTCLOUD_USERNAME;
    const password = process.env.NEXTCLOUD_APP_PASSWORD;
    if (user && password) {
      const share = await createPublicShare(remotePath, `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`);
      return { url: `${share.url}/download`, provider: "nextcloud-mount", storageKey: remotePath };
    }
    throw new Error("NEXTCLOUD_PUBLIC_URL_REQUIRED");
  }

  const webdavUrl = process.env.NEXTCLOUD_WEBDAV_URL;
  const user = process.env.NEXTCLOUD_USERNAME;
  const password = process.env.NEXTCLOUD_APP_PASSWORD;
  if (webdavUrl && user && password) {
    const authorization = `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
    await createNextcloudFolders(webdavUrl, parts, authorization);
    const upload = await fetch(`${webdavUrl.replace(/\/$/, "")}/${encodedPath(relativeParts)}`, {
      method: "PUT",
      headers: { Authorization: authorization, "Content-Type": input.mimeType, "Content-Length": String(input.size) },
      body: validatedBody as any,
      duplex: "half",
    } as any);
    if (!upload.ok) throw new Error(`NEXTCLOUD_UPLOAD_${upload.status}`);
    const share = await createPublicShare(remotePath, authorization);
    return { url: `${share.url}/download`, provider: "nextcloud-webdav", storageKey: remotePath };
  }

  if (!input.allowLocal && !localFallbackEnabled()) throw new Error("REMOTE_STORAGE_UNAVAILABLE");
  const localRoot = path.resolve(localUploadsRoot(), "media");
  const target = path.resolve(localRoot, storedName);
  await fsp.mkdir(localRoot, { recursive: true });
  await pipeline(Readable.fromWeb(validatedBody as any), createWriteStream(target, { flags: "wx" }));
  return { url: `/uploads/media/${storedName}`, provider: "local", storageKey: `media/${storedName}` };
}

export async function deleteStoredAsset(provider: string, storageKey: string) {
  if (!storageKey) return;
  if (provider === "nextcloud-mount") {
    const root = canonicalAssetsRoot();
    const target = path.resolve(root, ...storageKey.split("/").filter(Boolean));
    const relative = path.relative(root, target);
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("MEDIA_PATH_INVALID");
    await fsp.unlink(target).catch((error) => { if (error?.code !== "ENOENT") throw error; });
    let directory = path.dirname(target);
    while (directory !== root && path.relative(root, directory) && !path.relative(root, directory).startsWith("..")) {
      try {
        await fsp.rmdir(directory);
        directory = path.dirname(directory);
      } catch (error: any) {
        if (error?.code === "ENOENT") directory = path.dirname(directory);
        else break;
      }
    }
    return;
  }
  if (provider === "local") {
    const root = localUploadsRoot();
    const target = path.resolve(root, ...storageKey.split("/").filter(Boolean));
    const relative = path.relative(root, target);
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("MEDIA_PATH_INVALID");
    await fsp.unlink(target).catch((error) => { if (error?.code !== "ENOENT") throw error; });
    return;
  }
  if (provider.startsWith("nextcloud")) {
    const { webdavUrl, authorization } = nextcloudAuth();
    const response = await fetch(`${webdavUrl}/${encodedPath(storageKey.split("/").filter(Boolean))}`, { method: "DELETE", headers: { Authorization: authorization } });
    if (!response.ok && response.status !== 404) throw new Error(`NEXTCLOUD_DELETE_${response.status}`);
  }
}
