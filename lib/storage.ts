import { createWriteStream, promises as fsp } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { randomBytes } from 'node:crypto';

type StoreMediaInput = {
  body: ReadableStream<Uint8Array>;
  tenantId: string;
  clientId: string;
  postDate?: string;
  fileName: string;
  mimeType: string;
  size: number;
};

const MIME_EXTENSIONS: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg'
};

const FILE_EXTENSIONS: Record<string, string[]> = {
  'video/mp4': ['mp4'],
  'video/webm': ['webm'],
  'video/quicktime': ['mov'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'audio/mpeg': ['mp3'],
  'audio/wav': ['wav'],
  'audio/ogg': ['ogg']
};

function matchesSignature(bytes: Uint8Array, mimeType: string) {
  const ascii = (start: number, length: number) =>
    String.fromCharCode(...bytes.slice(start, start + length));
  if (mimeType === 'video/mp4') return ascii(4, 4) === 'ftyp';
  if (mimeType === 'video/quicktime') return ascii(4, 4) === 'ftyp';
  if (mimeType === 'video/webm') return bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  if (mimeType === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === 'image/png') return bytes[0] === 0x89 && ascii(1, 3) === 'PNG';
  if (mimeType === 'image/webp') return ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP';
  if (mimeType === 'audio/wav') return ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WAVE';
  if (mimeType === 'audio/ogg') return ascii(0, 4) === 'OggS';
  if (mimeType === 'audio/mpeg') return ascii(0, 3) === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
  return false;
}

async function validateAndRestoreStream(body: ReadableStream<Uint8Array>, mimeType: string, maxBytes: number) {
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
  if (!matchesSignature(head, mimeType)) {
    await reader.cancel();
    throw new Error('MEDIA_SIGNATURE_INVALID');
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
        return controller.error(new Error('MEDIA_SIZE_INVALID'));
      }
      controller.enqueue(item.value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    }
  });
}

function safeSegment(value: string, fallback: string) {
  return String(value || fallback).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100) || fallback;
}

function encodedPath(parts: string[]) {
  return parts.map(encodeURIComponent).join('/');
}

async function createNextcloudFolders(baseUrl: string, parts: string[], authorization: string) {
  for (let index = 1; index <= parts.length; index += 1) {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/${encodedPath(parts.slice(0, index))}`, {
      method: 'MKCOL',
      headers: { Authorization: authorization }
    });
    if (!response.ok && response.status !== 405) throw new Error(`NEXTCLOUD_MKCOL_${response.status}`);
  }
}

async function createPublicShare(remotePath: string, authorization: string) {
  const ocsUrl = process.env.NEXTCLOUD_OCS_URL;
  if (!ocsUrl) throw new Error('NEXTCLOUD_OCS_URL_REQUIRED');
  const response = await fetch(ocsUrl, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'OCS-APIRequest': 'true',
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ path: remotePath, shareType: '3', permissions: '1' })
  });
  if (!response.ok) throw new Error(`NEXTCLOUD_SHARE_${response.status}`);
  const payload: any = await response.json();
  const shareUrl = payload?.ocs?.data?.url;
  if (!shareUrl) throw new Error('NEXTCLOUD_SHARE_URL_MISSING');
  return `${String(shareUrl).replace(/\/$/, '')}/download`;
}

export function isNextcloudConfigured() {
  return Boolean(
    process.env.NEXTCLOUD_MOUNT_PATH ||
    (process.env.NEXTCLOUD_WEBDAV_URL && process.env.NEXTCLOUD_USERNAME && process.env.NEXTCLOUD_APP_PASSWORD)
  );
}

export async function storeMedia(input: StoreMediaInput) {
  const extension = MIME_EXTENSIONS[input.mimeType];
  if (!extension) throw new Error('MEDIA_TYPE_NOT_ALLOWED');
  const originalExtension = path.extname(input.fileName).slice(1).toLowerCase();
  if (!FILE_EXTENSIONS[input.mimeType]?.includes(originalExtension)) throw new Error('MEDIA_EXTENSION_INVALID');
  const maxBytes = Math.max(1, Number(process.env.MAX_MEDIA_UPLOAD_GB || 20)) * 1024 * 1024 * 1024;
  if (!input.size || input.size > maxBytes) throw new Error('MEDIA_SIZE_INVALID');
  const validatedBody = await validateAndRestoreStream(input.body, input.mimeType, maxBytes);

  const date = /^\d{4}-\d{2}-\d{2}$/.test(input.postDate || '') ? String(input.postDate) : new Date().toISOString().slice(0, 10);
  const parts = [
    safeSegment(process.env.NEXTCLOUD_ROOT || 'ContentPlanner', 'ContentPlanner'),
    safeSegment(input.tenantId, 'tenant'),
    safeSegment(input.clientId, 'client'),
    date.slice(0, 7)
  ];
  const baseName = safeSegment(path.parse(input.fileName).name, 'media');
  const storedName = `${date}-${baseName}-${randomBytes(8).toString('hex')}.${extension}`;
  const relativeParts = [...parts, storedName];
  const remotePath = `/${relativeParts.join('/')}`;

  const mountPath = process.env.NEXTCLOUD_MOUNT_PATH;
  if (mountPath) {
    const absoluteRoot = path.resolve(mountPath);
    const target = path.resolve(absoluteRoot, ...relativeParts);
    const relative = path.relative(absoluteRoot, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('MEDIA_PATH_INVALID');
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await pipeline(Readable.fromWeb(validatedBody as any), createWriteStream(target, { flags: 'wx' }));
    const publicBase = process.env.NEXTCLOUD_PUBLIC_BASE_URL;
    if (publicBase) return { url: `${publicBase.replace(/\/$/, '')}/${encodedPath(relativeParts)}`, provider: 'nextcloud-mount' };
    const user = process.env.NEXTCLOUD_USERNAME;
    const password = process.env.NEXTCLOUD_APP_PASSWORD;
    if (user && password) return { url: await createPublicShare(remotePath, `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`), provider: 'nextcloud-mount' };
    throw new Error('NEXTCLOUD_PUBLIC_URL_REQUIRED');
  }

  const webdavUrl = process.env.NEXTCLOUD_WEBDAV_URL;
  const user = process.env.NEXTCLOUD_USERNAME;
  const password = process.env.NEXTCLOUD_APP_PASSWORD;
  if (webdavUrl && user && password) {
    const authorization = `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
    await createNextcloudFolders(webdavUrl, parts, authorization);
    const upload = await fetch(`${webdavUrl.replace(/\/$/, '')}/${encodedPath(relativeParts)}`, {
      method: 'PUT',
      headers: { Authorization: authorization, 'Content-Type': input.mimeType, 'Content-Length': String(input.size) },
      body: validatedBody as any,
      duplex: 'half'
    } as any);
    if (!upload.ok) throw new Error(`NEXTCLOUD_UPLOAD_${upload.status}`);
    return { url: await createPublicShare(remotePath, authorization), provider: 'nextcloud-webdav' };
  }

  const localRoot = path.resolve(process.cwd(), 'server', 'uploads', safeSegment(input.tenantId, 'tenant'), 'media');
  const target = path.resolve(localRoot, storedName);
  await fsp.mkdir(localRoot, { recursive: true });
  await pipeline(Readable.fromWeb(validatedBody as any), createWriteStream(target, { flags: 'wx' }));
  return { url: `/uploads/${safeSegment(input.tenantId, 'tenant')}/media/${storedName}`, provider: 'local' };
}
