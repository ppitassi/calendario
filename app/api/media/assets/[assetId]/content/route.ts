import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../../../lib/db';
import { accessiblePost, workflowSession } from '../../../../../../lib/post-workflow';
import { canonicalAssetsRoot, localUploadsRoot } from '../../../../../../lib/storage';

async function resolveAsset(req: NextRequest, assetId: string) {
  const [rows]: any = await getDbPool().query(
    'SELECT * FROM media_assets WHERE id=? AND status=? LIMIT 1',
    [assetId, 'active'],
  );
  const asset = rows[0];
  if (!asset) return { error: NextResponse.json({ error: 'MÃ­dia nÃ£o encontrada.' }, { status: 404 }) };
  if (asset.visibility === 'public') return { asset };
  const session = await workflowSession(req);
  if (!session) return { error: NextResponse.json({ error: 'NÃ£o autenticado.' }, { status: 401 }) };
  if (asset.ownerType === 'post' && !(await accessiblePost(session, asset.ownerId))) {
    return { error: NextResponse.json({ error: 'Acesso negado.' }, { status: 403 }) };
  }
  if (asset.ownerType === 'user' && asset.ownerId !== session.userId && !['admin', 'gerente'].includes(session.role)) {
    return { error: NextResponse.json({ error: 'Acesso negado.' }, { status: 403 }) };
  }
  return { asset };
}

function parseRange(header: string | null, size: number) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match) return false;
  let start = match[1] ? Number(match[1]) : 0;
  let end = match[2] ? Number(match[2]) : size - 1;
  if (!match[1] && match[2]) start = Math.max(0, size - Number(match[2]));
  if (start < 0 || end < start || start >= size) return false;
  return { start, end: Math.min(end, size - 1) };
}

async function fileResponse(req: NextRequest, asset: any, headOnly: boolean, target: string, root: string) {
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return NextResponse.json({ error: 'MÃ­dia invÃ¡lida.' }, { status: 500 });
  let stat;
  try { stat = await fs.stat(target); } catch { return NextResponse.json({ error: 'MÃ­dia temporariamente indisponÃ­vel.' }, { status: 503 }); }
  const range = parseRange(req.headers.get('range'), stat.size);
  if (range === false) return new NextResponse(null, { status: 416, headers: { 'Content-Range': `bytes */${stat.size}` } });
  const selected = range || { start: 0, end: stat.size - 1 };
  const headers = new Headers({
    'Accept-Ranges': 'bytes',
    'Content-Type': asset.detectedMimeType || asset.mimeType || 'application/octet-stream',
    'Content-Length': String(selected.end - selected.start + 1),
    ETag: `"${asset.sha256 || asset.checksum || `${stat.size}-${stat.mtimeMs}`}"`
  });
  if (asset.visibility !== 'public') {
    const safeName = String(asset.originalName || 'arquivo').replace(/["\\\r\n]/g, '_');
    headers.set('Content-Disposition', `attachment; filename="${safeName}"`);
    headers.set('X-Content-Type-Options', 'nosniff');
  }
  if (range) headers.set('Content-Range', `bytes ${selected.start}-${selected.end}/${stat.size}`);
  if (headOnly) return new NextResponse(null, { status: range ? 206 : 200, headers });
  const stream = createReadStream(target, selected);
  return new NextResponse(Readable.toWeb(stream) as ReadableStream, { status: range ? 206 : 200, headers });
}

async function localResponse(req: NextRequest, asset: any, headOnly: boolean) {
  const root = asset.storageProvider === 'nextcloud-mount' ? canonicalAssetsRoot() : asset.visibility === 'public' ? canonicalAssetsRoot() : localUploadsRoot();
  return fileResponse(req, asset, headOnly, path.resolve(root, String(asset.localPath || asset.storageKey || '')), root);
}

async function cachedRemoteResponse(req: NextRequest, asset: any, headOnly: boolean, remoteUrl: string, authorization: string) {
  const root = path.resolve(localUploadsRoot(), 'cache');
  await fs.mkdir(root, { recursive: true });
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  const files: Array<{ path: string; size: number; mtimeMs: number }> = [];
  for (const entry of entries) {
    if (!entry.isFile() || entry.name.endsWith('.uploading')) continue;
    const filePath = path.resolve(root, entry.name);
    const stat = await fs.stat(filePath).catch(() => null);
    if (stat) files.push({ path: filePath, size: stat.size, mtimeMs: stat.mtimeMs });
  }
  const etagKey = String(asset.remoteEtag || asset.sha256 || asset.checksum || 'remote').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
  const target = path.resolve(root, `${asset.id}__${etagKey}`);
  const ttlMs = Math.max(1, Number(process.env.LOCAL_MEDIA_TEMP_TTL_HOURS || 24)) * 3_600_000;
  for (const file of files) if (file.path !== target && Date.now() - file.mtimeMs > ttlMs) await fs.unlink(file.path).catch(() => undefined);
  const maxBytes = Math.max(0.1, Number(process.env.LOCAL_MEDIA_CACHE_MAX_GB || 5)) * 1024 ** 3;
  if (maxBytes > 0) {
    let total = files.reduce((sum, file) => sum + file.size, 0);
    for (const file of files.sort((a, b) => a.mtimeMs - b.mtimeMs)) {
      if (total <= maxBytes) break;
      if (file.path === target) continue;
      await fs.unlink(file.path).catch(() => undefined);
      total -= file.size;
    }
  }
  let cached = false;
  try {
    const stat = await fs.stat(target);
    cached = Date.now() - stat.mtimeMs <= ttlMs;
    if (!cached) await fs.unlink(target).catch(() => undefined);
  } catch {}
  if (!cached && !headOnly && !req.headers.get('range')) {
    const remote = await fetch(remoteUrl, { headers: { Authorization: authorization } });
    if (remote.ok && remote.body) {
      const temporary = `${target}.uploading`;
      const writer = (await import('node:fs')).createWriteStream(temporary, { flags: 'w' });
      await import('node:stream/promises').then(({ pipeline }) => pipeline(Readable.fromWeb(remote.body as any), writer));
      await fs.rename(temporary, target);
      cached = true;
    }
  }
  return cached ? fileResponse(req, asset, headOnly, target, root) : null;
}

export async function serveResolvedAsset(req: NextRequest, asset: any, headOnly = false) {
  if (asset.storageState !== 'remote_only' && (asset.localPath || asset.storageProvider === 'local')) {
    return localResponse(req, asset, headOnly);
  }
  if (!asset.remotePath || !process.env.NEXTCLOUD_WEBDAV_URL || !process.env.NEXTCLOUD_USERNAME || !process.env.NEXTCLOUD_APP_PASSWORD) {
    return NextResponse.json({ error: 'MÃ­dia temporariamente indisponÃ­vel.' }, { status: 503 });
  }
  const url = `${process.env.NEXTCLOUD_WEBDAV_URL.replace(/\/$/, '')}/${String(asset.remotePath).split('/').filter(Boolean).map(encodeURIComponent).join('/')}`;
  const authorization = `Basic ${Buffer.from(`${process.env.NEXTCLOUD_USERNAME}:${process.env.NEXTCLOUD_APP_PASSWORD}`).toString('base64')}`;
  const cached = await cachedRemoteResponse(req, asset, headOnly, url, authorization);
  if (cached) return cached;
  const remote = await fetch(url, {
    method: headOnly ? 'HEAD' : 'GET',
    headers: { Authorization: authorization, ...(req.headers.get('range') ? { Range: req.headers.get('range')! } : {}) },
  });
  if (!remote.ok && remote.status !== 206) return NextResponse.json({ error: 'MÃ­dia temporariamente indisponÃ­vel.' }, { status: 503 });
  const headers = new Headers();
  for (const key of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag']) {
    const value = remote.headers.get(key); if (value) headers.set(key, value);
  }
  return new NextResponse(headOnly ? null : remote.body, { status: remote.status, headers });
}

async function respond(req: NextRequest, assetId: string, headOnly: boolean) {
  const resolved = await resolveAsset(req, assetId);
  if (resolved.error) return resolved.error;
  return serveResolvedAsset(req, resolved.asset, headOnly);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ assetId: string }> }) {
  return respond(req, (await params).assetId, false);
}

export async function HEAD(req: NextRequest, { params }: { params: Promise<{ assetId: string }> }) {
  return respond(req, (await params).assetId, true);
}
