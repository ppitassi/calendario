import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from './db';
import bcrypt from 'bcryptjs';
import axios from 'axios';
import path from 'path';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import sharp from 'sharp';
import { promises as fsp } from 'fs';
import { existsSync } from 'fs';
import { completeWithLeia } from './leia';
import {
  finalizeDirectNextcloudUpload,
  deleteStoredAsset,
  initDirectNextcloudUpload,
  localUploadsRoot,
  matchesFileSignature,
  storeAssetBuffer,
  storeMedia,
} from './storage';
import {
  getPresentationData,
  getReviewData,
  isReviewDataError,
  validateReviewPost,
  validateReviewToken,
} from './review-data';
import { createMetaOAuth, finishMetaOAuth, selectMetaAccount } from './meta';
import { createNotificationEvent, ensureNotificationPreferences, resolvePostRecipients } from './notifications';
import { recordAutosaveActivity, recordPostActivity } from './post-workflow';
import { clientResponsible } from './production-workflow';

function db() {
  return getDbPool();
}

type Params = Record<string, string>;
type Permission = 'canCreatePosts' | 'canEditAssignedPosts' | 'canEditCalendar' | 'canReviewAndSend' | 'canConfigClients' | 'canManageBrandSystem' | 'canManageRoles' | 'canViewPresentation' | 'canViewProductionGallery' | 'canComment';
type Ctx = { userUid: string | null; userRole: string | null; tenantId: string; isAuthenticated: boolean; permissions: Set<Permission> };

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: ['canCreatePosts', 'canEditAssignedPosts', 'canEditCalendar', 'canReviewAndSend', 'canConfigClients', 'canManageBrandSystem', 'canManageRoles', 'canViewPresentation', 'canViewProductionGallery', 'canComment'],
  gerente: ['canCreatePosts', 'canEditAssignedPosts', 'canEditCalendar', 'canReviewAndSend', 'canConfigClients', 'canManageBrandSystem', 'canViewPresentation', 'canViewProductionGallery', 'canComment'],
  atendimento: ['canReviewAndSend', 'canConfigClients', 'canViewPresentation', 'canViewProductionGallery', 'canComment'],
  designer: ['canCreatePosts', 'canEditAssignedPosts', 'canEditCalendar', 'canConfigClients', 'canViewPresentation', 'canViewProductionGallery'],
  estagiario: ['canEditAssignedPosts', 'canViewPresentation', 'canViewProductionGallery'], analista: ['canViewPresentation', 'canViewProductionGallery'],
  socialmedia: ['canCreatePosts', 'canEditAssignedPosts', 'canEditCalendar', 'canReviewAndSend', 'canConfigClients', 'canViewPresentation', 'canViewProductionGallery', 'canComment'],
};
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
async function rateLimited(key: string, limit: number, windowMs: number) {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
    await exec(
      'INSERT INTO rate_limits (bucket_key, hit_count, reset_at) VALUES (?, 1, DATE_ADD(NOW(), INTERVAL ? SECOND)) ON DUPLICATE KEY UPDATE hit_count = IF(reset_at <= NOW(), 1, hit_count + 1), reset_at = IF(reset_at <= NOW(), DATE_ADD(NOW(), INTERVAL ? SECOND), reset_at)',
      [key.slice(0, 190), windowSeconds, windowSeconds],
    );
    const bucket = (await rows('SELECT hit_count FROM rate_limits WHERE bucket_key = ? LIMIT 1', [key.slice(0, 190)]))[0];
    return Number(bucket?.hit_count || 0) > limit;
  }
  const now = Date.now(); const current = rateBuckets.get(key);
  if (!current || current.resetAt <= now) { rateBuckets.set(key, { count: 1, resetAt: now + windowMs }); return false; }
  return ++current.count > limit;
}

function ok(data: any = { success: true }, status = 200) {
  return NextResponse.json(data, { status });
}

function err(message: string, status = 500, code?: string, fields?: Record<string, string>) {
  return NextResponse.json({ error: message, ...(code ? { code } : {}), ...(fields ? { fields } : {}) }, { status });
}

async function body(req: NextRequest) {
  try { return await req.json(); } catch { return {}; }
}

function parseJson(value: any, fallback: any) {
  if (!value) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function normalizeDate(value: any): string {
  if (!value) return '';
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const match = String(value).match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : '';
}

function assertPostDate(value: any): string {
  const date = normalizeDate(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date === '0000-00-00') throw new Error('Data de postagem invalida.');
  return date;
}

function toMysqlDateTime(value: any): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

async function rows(sql: string, params: any[] = []) {
  const [r] = await db().query(sql, params);
  return r as any[];
}

async function exec(sql: string, params: any[] = []) {
  const [r] = await db().query(sql, params);
  return r as any;
}

async function getContext(req: NextRequest): Promise<Ctx> {
  const token = req.cookies.get('cp_session')?.value || null;
  if (!token) return { userUid: null, userRole: null, tenantId: '', isAuthenticated: false, permissions: new Set() };
  const users = await rows('SELECT uid, role, tenant_id FROM users WHERE session_token = ? AND session_expires_at > NOW()', [token]);
  const user = users[0];
  if (!user?.tenant_id) return { userUid: null, userRole: null, tenantId: '', isAuthenticated: false, permissions: new Set() };
  let permissions = ROLE_PERMISSIONS[user.role] || [];
  const custom = await rows('SELECT permissions FROM custom_roles WHERE id = ? AND tenant_id = ?', [user.role, user.tenant_id]);
  const overrides = parseJson(custom[0]?.permissions, {});
  if (custom[0]) {
    const base = Object.fromEntries(permissions.map(permission => [permission, true]));
    permissions = Object.entries({ ...base, ...overrides }).filter(([, value]) => value === true).map(([key]) => key as Permission);
  }
  return { userUid: user.uid, userRole: user.role, tenantId: user.tenant_id, isAuthenticated: true, permissions: new Set(permissions) };
}

function isPublic(route: string) {
  if (route === '/health' || route === '/health/db') return true;
  if (route === '/cron/deadlines') return true;
  if (route === '/auth/login' || route === '/auth/validate-token') return true;
  if (route.startsWith('/auth/social/login') || route.startsWith('/auth/callback')) return true;
  if (route.startsWith('/public/') || route.startsWith('/review/')) return true;
  return false;
}

function validCronSecret(req: NextRequest) {
  const secret = process.env.CRON_SECRET || '';
  const supplied = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const expectedBuffer = Buffer.from(secret);
  const suppliedBuffer = Buffer.from(supplied);
  return Boolean(secret) && expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function requiredPermission(method: string, route: string): Permission | null {
  if (isPublic(route)) return null;
  if (route === '/users/preferences' || route === '/users/me') return null;
  if (route.startsWith('/uploads/media')) return 'canCreatePosts';
  if (route.startsWith('/agency/settings')) return 'canManageBrandSystem';
  if (route.startsWith('/admin/') || route === '/agencies' || route.startsWith('/users') || route.startsWith('/custom-roles')) return 'canManageRoles';
  if (route.startsWith('/analytics/') || route.startsWith('/presentation/')) return 'canViewPresentation';
  if (route === '/production-gallery') return 'canViewProductionGallery';
  if (route.includes('/comments')) return 'canComment';
  if (route.startsWith('/tokens') || route.endsWith('/send-for-review') || route === '/notify-whatsapp') return 'canReviewAndSend';
  if (route.startsWith('/settings')) return method === 'GET' ? null : 'canConfigClients';
  if (route.startsWith('/clients')) return method === 'GET' ? null : 'canConfigClients';
  if (route.startsWith('/settings')) return method === 'GET' ? null : 'canConfigClients';
  if ((route.startsWith('/posts') || route.startsWith('/posts-bulk')) && method !== 'GET') return method === 'POST' ? 'canCreatePosts' : 'canEditCalendar';
  if (route === '/generate-objective') return 'canCreatePosts';
  return null;
}

type GeneratedPostFields = { date?: string; title: string; head: string; subhead: string; caption: string; objective: string; cta: string; hashtags: string; funnelStage: 'topo' | 'meio' | 'fundo'; source: 'leia' | 'rules' };

function ruleGeneratedFields(post: any, index = 0, total = 1): GeneratedPostFields {
  const text = [post.title, post.centralIdea, post.head, post.subhead, post.caption, post.subtitle, post.cta, post.hashtags, post.theme, post.script]
    .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  const lower = text.toLowerCase();
  const conversion = /compr|contrat|or[cÃ§]amento|agend|inscrev|cadastre|link|saiba mais|fale conosco|lead|venda|promo[cÃ§][aÃ£]o/.test(lower);
  const nurture = /como|guia|passo|dica|erro|benef[iÃ­]cio|entenda|aprenda|case|resultado|compar|por que|autoridade/.test(lower);
  const target = total > 1 ? index / Math.max(total, 1) : -1;
  const funnelStage: 'topo' | 'meio' | 'fundo' = conversion ? 'fundo' : nurture ? 'meio' : target >= 0.8 ? 'fundo' : target >= 0.5 ? 'meio' : 'topo';
  const clean = text.replace(/[#*_\`]/g, '').split(/[.!?\n]/)[0]?.trim() || 'ConteÃºdo estratÃ©gico';
  const words = clean.split(/\s+/).slice(0, 11).join(' ');
  const head = words.length > 78 ? `${words.slice(0, 75).trim()}...` : words;
  const objectives = {
    topo: 'Ampliar alcance e gerar reconhecimento de marca junto ao pÃºblico-alvo.',
    meio: 'Educar o pÃºblico, fortalecer autoridade e estimular consideraÃ§Ã£o pela soluÃ§Ã£o.',
    fundo: 'Estimular uma aÃ§Ã£o de conversÃ£o com uma proposta clara e relevante.'
  };
  const postNumber = Math.max(1, Number(post.postNumber) || index + 1);
  return { date: post.date, title: `Post ${postNumber} â€” ${words || 'ConteÃºdo estratÃ©gico'}`, head, subhead: '', caption: '', objective: objectives[funnelStage], cta: '', hashtags: '', funnelStage, source: 'rules' };
}

function extractGeneratedJson(raw: string): any[] | null {
  try {
    const cleaned = raw.replace(/^\`\`\`(?:json)?\s*/i, '').replace(/\s*\`\`\`$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : Array.isArray(parsed?.results) ? parsed.results : parsed ? [parsed] : null;
  } catch { return null; }
}

async function tenantOwnsClient(clientId: string, tenantId: string) {
  return Boolean((await rows('SELECT 1 FROM clients WHERE id = ? AND tenant_id = ? LIMIT 1', [clientId, tenantId]))[0]);
}

function assetUrls(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(assetUrls);
  if (typeof value === 'string' && value.startsWith('/uploads/')) return [value];
  if (typeof value === 'string' && value.startsWith('[')) return assetUrls(parseJson(value, []));
  return [];
}

async function removeLocalAssetIfUnreferenced(url: string, tenantId: string) {
  const refs = await rows(
    `SELECT 1 FROM clients WHERE tenant_id = ? AND logoUrl = ?
     UNION ALL SELECT 1 FROM agencies WHERE id = ? AND (logo_url = ? OR logo_dark_url = ?)
     UNION ALL SELECT 1 FROM users WHERE tenant_id = ? AND photoURL = ?
     UNION ALL SELECT 1 FROM posts WHERE tenant_id = ? AND (feedImages LIKE ? OR storyImage = ? OR coverImage = ? OR linkedinCover = ? OR videoUrl = ?) LIMIT 1`,
    [tenantId, url, tenantId, url, url, tenantId, url, tenantId, `%${url}%`, url, url, url, url],
  );
  if (refs.length) return;
  const assets = await rows("SELECT id, storageProvider, storageKey FROM media_assets WHERE tenantId = ? AND publicUrl = ? AND status = 'active'", [tenantId, url]);
  await exec("UPDATE media_assets SET status = 'deleted', deletedAt = NOW() WHERE tenantId = ? AND publicUrl = ? AND status = 'active'", [tenantId, url]);
  for (const asset of assets) await deleteStoredAsset(asset.storageProvider, asset.storageKey).catch(() => undefined);
  if (!url.startsWith('/uploads/')) return;
  const relativeParts = url.split('?')[0].split('/').filter(Boolean).slice(1).map(decodeURIComponent);
  const root = localUploadsRoot();
  const target = path.resolve(root, ...relativeParts);
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return;
  await fsp.unlink(target).catch(() => undefined);
}

async function registerMediaAsset(ctx: Ctx, data: any, stored: any, category: string, suffix = '') {
  const ownerType = category === 'avatar' ? 'user' : category.startsWith('agency') ? 'agency' : category === 'logo' ? 'client' : category === 'audio' ? 'client' : 'post';
  const ownerId = String(data.ownerId || data.targetUserId || data.clientId || ctx.userUid || ctx.tenantId);
  const id = randomBytes(24).toString('hex');
  await exec(
    `INSERT INTO media_assets
     (id, tenantId, clientId, ownerType, ownerId, category, storageProvider, storageKey, publicUrl, mimeType, sizeBytes, width, height, originalName, checksum, status, createdBy)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
    [id, ctx.tenantId, data.clientId || null, ownerType, ownerId, category + suffix, stored.provider, stored.storageKey, stored.url || null, stored.mimeType || data.mimeType || 'application/octet-stream', Number(stored.sizeBytes || data.size || 0), stored.width || null, stored.height || null, String(stored.originalName || data.fileName || 'asset').slice(0, 255), stored.checksum || null, ctx.userUid],
  );
  return id;
}

function tablePayload(data: any, tenantId?: string) {
  const out: Record<string, any> = { ...data };
  for (const key of Object.keys(out)) {
    if (Array.isArray(out[key]) || (out[key] && typeof out[key] === 'object')) out[key] = JSON.stringify(out[key]);
  }
  if (tenantId) out.tenant_id = tenantId;
  return out;
}

function clientOwnerIds(value: any): string[] {
  const parsed = Array.isArray(value) ? value : parseJson(value, []);
  return Array.from(new Set<string>(parsed.map((owner: any) => String(typeof owner === 'string' ? owner : owner?.uid || owner?.id || '')).filter(Boolean))); 
}

function publicClient(client: any) {
  return { ...client, owners: clientOwnerIds(client.owners), socialLinks: parseJson(client.socialLinks, {}), instagramStats: parseJson(client.instagramStats, {}), config: parseJson(client.config, {}) };
}

async function getPermissionMapForUser(user: any): Promise<Record<string, boolean>> {
  const defaults = Object.fromEntries((ROLE_PERMISSIONS[user.role] || []).map(permission => [permission, true]));
  const custom = await rows('SELECT permissions FROM custom_roles WHERE id = ? AND tenant_id = ?', [user.role, user.tenant_id]);
  return { ...defaults, ...parseJson(custom[0]?.permissions, {}) };
}
async function getContextForUser(user: any): Promise<Permission[]> {
  const defaults = ROLE_PERMISSIONS[user.role] || [];
  const custom = await rows('SELECT permissions FROM custom_roles WHERE id = ? AND tenant_id = ?', [user.role, user.tenant_id]);
  const overrides = parseJson(custom[0]?.permissions, {});
  const merged = { ...Object.fromEntries(defaults.map(permission => [permission, true])), ...overrides };
  return Object.entries(merged).filter(([, enabled]) => enabled === true).map(([permission]) => permission as Permission);
}
async function enrichUser(user: any) {
  const agency = (await rows('SELECT name, slogan, logo_url, logo_dark_url, theme_config FROM agencies WHERE id = ? LIMIT 1', [user.tenant_id]))[0] || {};
  return {
    ...user,
    agencyName: agency.name || '',
    agencySlogan: agency.slogan || '',
    agencyLogo: agency.logo_url || '',
    agencyLogoDark: agency.logo_dark_url || '',
    theme_config: parseJson(agency.theme_config, null),
    ui_preferences: parseJson(user.ui_preferences, {}),
    permissions: await getPermissionMapForUser(user)
  };
}

let activePdfJobs = 0;
function resolveChromiumExecutable() {
  const configured = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  if (configured && existsSync(configured)) return configured;
  const candidates = process.platform === 'win32'
    ? [
        path.join(process.env.PROGRAMFILES || '', 'Google/Chrome/Application/chrome.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google/Chrome/Application/chrome.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
      ]
    : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  return candidates.find(candidate => candidate && existsSync(candidate));
}

async function renderPdf(url: string) {
  if (activePdfJobs >= 2) throw new Error('PDF_BUSY');
  activePdfJobs += 1;
  const { chromium } = await import('playwright-core');
  let browser: any;
  try {
    if (process.env.VERCEL && !process.env.BROWSERLESS_URL) throw new Error('BROWSERLESS_URL_REQUIRED');
    browser = process.env.BROWSERLESS_URL
      ? await chromium.connectOverCDP(process.env.BROWSERLESS_URL)
      : await chromium.launch({ headless: true, executablePath: resolveChromiumExecutable() });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(async () => {
      const style = document.createElement('style');
      style.textContent = `
        html, body { margin: 0 !important; overflow: visible !important; }
        *, *::before, *::after { animation: none !important; transition: none !important; }
        .print-main [style] { opacity: 1 !important; transform: none !important; }
        .print-hide { display: none !important; }
      `;
      document.head.appendChild(style);
      const images = Array.from(document.images);
      await Promise.all(images.map((image) => image.complete ? Promise.resolve() : new Promise<void>((resolve) => {
        image.addEventListener('load', () => resolve(), { once: true });
        image.addEventListener('error', () => resolve(), { once: true });
      })));
    });
    let dimensions = await page.evaluate(() => ({
      width: Math.max(
        document.documentElement.scrollWidth,
        document.body.scrollWidth,
        document.documentElement.offsetWidth,
        document.body.offsetWidth,
      ),
      height: Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
        document.documentElement.offsetHeight,
        document.body.offsetHeight,
      ),
    }));
    const captureWidth = Math.min(Math.max(Math.ceil(dimensions.width) + 2, 1440), 19000);
    await page.setViewportSize({ width: captureWidth, height: 1200 });
    dimensions = await page.evaluate(() => ({
      width: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      height: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
    }));
    const captureHeight = Math.max(Math.ceil(dimensions.height) + 2, 1200);
    const maxPdfPixels = 18000;
    const pdfScale = Math.min(1, maxPdfPixels / captureWidth, maxPdfPixels / captureHeight);
    const pdfWidth = Math.max(1, Math.floor(captureWidth * pdfScale));
    const pdfHeight = Math.max(1, Math.floor(captureHeight * pdfScale));
    const screenshot = await page.screenshot({ fullPage: true, type: 'png' });
    const imagePage = await browser.newPage({ viewport: { width: pdfWidth, height: 1200 }, deviceScaleFactor: 1 });
    await imagePage.setContent(`<!doctype html><html><head><style>*{box-sizing:border-box}html,body{margin:0;padding:0;background:white}img{display:block;width:${pdfWidth}px;height:auto}</style></head><body><img src="data:image/png;base64,${screenshot.toString('base64')}" /></body></html>`, { waitUntil: 'load' });
    return await imagePage.pdf({
      width: `${pdfWidth}px`,
      height: `${pdfHeight}px`,
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
  } finally {
    if (browser) await browser.close().catch(() => {});
    activePdfJobs -= 1;
  }
}

function internalAppOrigin(req: NextRequest) {
  const configured = process.env.APP_URL || process.env.INTERNAL_APP_URL;
  if (configured) {
    const origin = new URL(configured).origin;
    if (!/^https?:\/\//.test(origin)) throw new Error('APP_URL_INVALID');
    return origin;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.VERCEL) throw new Error('APP_URL_REQUIRED');
  return `http://127.0.0.1:${process.env.PORT || 3006}`;
}

async function sendWAMessage(to: string, text: string) {
  if (!to || !text) return;
  const apiKey = process.env.EVOLUTION_API_KEY;
  if (!apiKey || apiKey === 'SUA_API_KEY_AQUI') return;
  const apiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
  const instance = process.env.EVOLUTION_INSTANCE || 'main';
  await axios.post(`${apiUrl}/message/sendText/${instance}`, { number: to, text }, { headers: { apikey: apiKey, 'Content-Type': 'application/json' } });
}

function imageDimensions(buffer: Buffer, mime: string) {
  if (mime === 'image/png' && buffer.length >= 24) return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  if (mime === 'image/webp' && buffer.length >= 30) {
    const kind = buffer.subarray(12, 16).toString();
    if (kind === 'VP8X') return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
    if (kind === 'VP8 ') return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  }
  if (mime === 'image/jpeg') {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue; }
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (length < 2) break;
      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      offset += length + 2;
    }
  }
  return null;
}

async function uploadBase64(data: any, audio = false, tenantId = 'default_agency') {
  const { base64, subfolder = audio ? 'audio' : 'profiles', clientName = 'Geral', postDate, designerName, fileName } = data;
  if (!base64) throw new Error(audio ? 'Nenhum Ã¡udio enviado' : 'Nenhuma imagem enviada');
  const match = String(base64).match(/^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\r\n]+)$/i);
  if (!match) throw new Error('Arquivo base64 invÃ¡lido.');
  const allowed = audio
    ? new Map([['audio/mpeg', 'mp3'], ['audio/wav', 'wav'], ['audio/ogg', 'ogg'], ['audio/webm', 'webm']])
    : new Map([['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp']]);
  const ext = allowed.get(match[1].toLowerCase());
  if (!ext) throw new Error('Tipo de arquivo nÃ£o permitido.');
  const payload = match[2];
  let buffer = Buffer.from(payload, 'base64');
  const limits: Record<string, number> = { avatars: 5, profiles: 5, logos: 10, branding: 10, posts: 25, audio: 25 };
  const maxBytes = (process.env.VERCEL ? Math.min(3, limits[String(subfolder)] || 10) : (limits[String(subfolder)] || (audio ? 25 : 10))) * 1024 * 1024;
  if (!buffer.length || buffer.length > maxBytes) throw new Error('Arquivo vazio ou acima do limite permitido.');
  const signatureOk = matchesFileSignature(buffer.subarray(0, 32), match[1].toLowerCase());
  if (!signatureOk) throw new Error('ConteÃºdo nÃ£o corresponde ao tipo declarado.');
  if (!audio) {
    const dimensions = imageDimensions(buffer, match[1].toLowerCase());
    if (!dimensions) throw new Error('Imagem corrompida ou formato nao suportado.');
    const minSide = ['avatars', 'profiles', 'logos', 'branding'].includes(String(subfolder)) ? 32 : 100;
    if (dimensions.width < minSide || dimensions.height < minSide) throw new Error('Imagem com dimensoes menores que o permitido.');
    if (dimensions.width > 12000 || dimensions.height > 12000 || dimensions.width * dimensions.height > 64_000_000) throw new Error('Imagem com dimensoes excessivas.');
    if (['avatars', 'profiles'].includes(String(subfolder))) {
      buffer = await sharp(buffer, { limitInputPixels: 64_000_000, failOn: 'error' }).rotate().resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true }).webp({ quality: 84 }).toBuffer();
    } else if (['logos', 'branding'].includes(String(subfolder))) {
      const pipeline = sharp(buffer, { limitInputPixels: 64_000_000, failOn: 'error' }).rotate();
      buffer = match[1].toLowerCase() === 'image/png'
        ? await pipeline.png({ compressionLevel: 9 }).toBuffer()
        : match[1].toLowerCase() === 'image/webp'
          ? await pipeline.webp({ quality: 92, alphaQuality: 100 }).toBuffer()
          : await pipeline.jpeg({ quality: 94 }).toBuffer();
    }
  }
  const folderAliases: Record<string, string> = { audio: 'audio', profiles: 'profiles', avatars: 'profiles', logos: 'client-logos', branding: 'branding', posts: 'posts' };
  const folder = folderAliases[String(subfolder)] || (audio ? 'audio' : 'profiles');
  const outputMime = !audio && ['avatars', 'profiles'].includes(String(subfolder)) ? 'image/webp' : match[1].toLowerCase();
  const outputExt = outputMime === 'image/webp' ? 'webp' : ext;
  const cleanName = `${String(fileName || randomBytes(12).toString('hex')).replace(/[^a-zA-Z0-9._-]/g, '_')}.${outputExt}`;
  const stored = await storeAssetBuffer({ buffer, tenantId, folder, fileName: cleanName, mimeType: outputMime, requireRemote: audio });
  let thumbnail: Awaited<ReturnType<typeof storeAssetBuffer>> | null = null;
  if (!audio && ['logos', 'branding', 'posts'].includes(String(subfolder))) {
    const thumbBuffer = await sharp(buffer, { limitInputPixels: 64_000_000, failOn: 'error' }).rotate().resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
    thumbnail = await storeAssetBuffer({ buffer: thumbBuffer, tenantId, folder: `${folder}-thumbnails`, fileName: `${cleanName}.webp`, mimeType: 'image/webp' });
  }
  const metadata = audio ? null : await sharp(buffer, { limitInputPixels: 64_000_000 }).metadata();
  return { ...stored, mimeType: outputMime, sizeBytes: buffer.length, width: metadata?.width || null, height: metadata?.height || null, checksum: createHash('sha256').update(buffer).digest('hex'), originalName: String(fileName || 'asset'), thumbnail };
}

export async function handleApi(method: string, route: string, req: NextRequest, params: Params = {}) {
  try {
    const ctx = await getContext(req);
    const permission = requiredPermission(method, route);
    if (!isPublic(route) && !ctx.isAuthenticated) return err('Acesso nÃ£o autorizado. FaÃ§a login para continuar.', 401);
    if (permission && !ctx.permissions.has(permission)) return err('PermissÃ£o insuficiente.', 403);
    const url = new URL(req.url);

    if (route === '/health' && method === 'GET') return ok({ ok: true });

    if (route === '/health/db' && method === 'GET') {
      const result = await rows('SELECT 1 AS ok');
      return ok({ ok: true, db: 'connected', result: result[0] });
    }

    if (route === '/cron/deadlines' && method === 'GET') {
      if (!validCronSecret(req)) return err('NÃƒÂ£o autorizado.', 401);
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: process.env.APP_TIMEZONE || 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(new Date());
      const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
      const day = Number(values.day);
      const dateKey = `${values.year}-${values.month}-${values.day}`;
      const agencies = await rows(
        'SELECT id, name, deadline_pre, deadline_final FROM agencies WHERE deadline_pre = ? OR deadline_final = ?',
        [day, day],
      );
      let notifications = 0;
      for (const agency of agencies) {
        const kinds = [
          ...(Number(agency.deadline_pre) === day ? ['pre'] : []),
          ...(Number(agency.deadline_final) === day ? ['final'] : []),
        ];
        for (const kind of kinds) {
          const inserted = await exec(
            'INSERT IGNORE INTO deadline_alert_log (tenant_id, alert_date, alert_kind) VALUES (?, ?, ?)',
            [agency.id, dateKey, kind],
          );
          if (!inserted.affectedRows) continue;
          const clients = await rows(
            'SELECT name, whatsappGroupId FROM clients WHERE tenant_id = ? AND whatsappGroupId IS NOT NULL AND whatsappGroupId <> ?',
            [agency.id, ''],
          );
          const message = kind === 'pre'
            ? `Alerta de prÃƒÂ©-calendÃƒÂ¡rio: hoje ÃƒÂ© o prazo de preparaÃƒÂ§ÃƒÂ£o da agÃƒÂªncia ${agency.name}.`
            : `Alerta de prazo final: hoje ÃƒÂ© o fechamento do calendÃƒÂ¡rio da agÃƒÂªncia ${agency.name}.`;
          for (const client of clients) {
            await sendWAMessage(client.whatsappGroupId, `${message} Cliente: ${client.name}.`).catch(() => undefined);
            notifications += 1;
          }
        }
      }
      return ok({ success: true, notifications });
    }

    if (route === '/auth/login' && method === 'POST') {
      const loginIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
      if (await rateLimited(`login:${loginIp}`, 10, 15 * 60_000)) return err('Muitas tentativas. Aguarde antes de tentar novamente.', 429);
      const data = await body(req);
      const email = data.email || data.username;
      const password = data.password;
      const found = await rows('SELECT * FROM users WHERE email = ? OR displayName = ?', [email, email]);
      const user = found[0];
      if (!user || !user.password || !(await bcrypt.compare(password, user.password))) return err('Credenciais invÃ¡lidas.', 401);
      const sessionToken = randomBytes(32).toString('hex');
      const sessionHours = data.rememberMe === false ? 12 : 24 * 30;
      const sessionIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local';
      const approximateLocation = {
        city: req.headers.get('x-vercel-ip-city') || null,
        region: req.headers.get('x-vercel-ip-country-region') || null,
        country: req.headers.get('x-vercel-ip-country') || null,
      };
      await exec('UPDATE users SET session_token = ?, session_expires_at = DATE_ADD(NOW(), INTERVAL ? HOUR), session_started_at = NOW(), last_activity_at = NOW(), foreground_seconds = 0, last_ip = ?, last_location = ? WHERE uid = ?', [sessionToken, sessionHours, sessionIp, JSON.stringify(approximateLocation), user.uid]);
      delete user.password;
      const response = ok({ success: true, user: await enrichUser(user) });
      response.cookies.set('cp_session', sessionToken, { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true', path: '/', ...(data.rememberMe === false ? {} : { maxAge: sessionHours * 60 * 60 }) });
      return response;
    }

    if (route === '/auth/validate-token' && method === 'POST') {
      const suppliedToken = req.cookies.get('cp_session')?.value;
      const found = await rows('SELECT * FROM users WHERE session_token = ? AND session_expires_at > NOW()', [suppliedToken]);
      const user = found[0];
      if (!user) return err('Token invÃ¡lido.', 401);
      delete user.password;
      return ok({ success: true, user: await enrichUser(user) });
    }

    if (route === '/auth/activity' && method === 'POST') {
      if (!ctx.userUid) return err('NÃ£o autenticado.', 401);
      const data = await body(req);
      const seconds = Math.max(0, Math.min(Number(data.foregroundSeconds) || 0, 120));
      const activityIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local';
      const location = JSON.stringify({
        city: req.headers.get('x-vercel-ip-city') || null,
        region: req.headers.get('x-vercel-ip-country-region') || null,
        country: req.headers.get('x-vercel-ip-country') || null,
        timezone: String(data.timezone || '').slice(0, 100),
        locale: String(data.locale || '').slice(0, 30),
      });
      await exec('UPDATE users SET last_activity_at = NOW(), foreground_seconds = foreground_seconds + ?, last_ip = ?, last_location = ? WHERE uid = ? AND tenant_id = ?', [seconds, activityIp, location, ctx.userUid, ctx.tenantId]);
      return ok();
    }

    if (route === '/auth/logout' && method === 'POST') {
      if (ctx.userUid) await exec('UPDATE users SET session_token = NULL, session_expires_at = NULL, last_activity_at = NOW() WHERE uid = ? AND tenant_id = ?', [ctx.userUid, ctx.tenantId]);
      const response = ok();
      response.cookies.set('cp_session', '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false', path: '/', maxAge: 0 });
      return response;
    }

    if (route === '/clients' && method === 'GET') {
      const result = await rows('SELECT * FROM clients WHERE tenant_id = ?', [ctx.tenantId]);
      if (['admin', 'gerente', 'atendimento'].includes(ctx.userRole || '')) return ok(result.map(publicClient));
      const assigned = await rows('SELECT DISTINCT clientId FROM posts WHERE tenant_id = ? AND (currentAssigneeId = ? OR actionAssigneeId = ? OR assigneeId = ?)', [ctx.tenantId, ctx.userUid, ctx.userUid, ctx.userUid]);
      const assignedIds = new Set(assigned.map((item: any) => String(item.clientId)));
      const ownUser = (await rows('SELECT clientId FROM users WHERE uid = ? AND tenant_id = ? LIMIT 1', [ctx.userUid, ctx.tenantId]))[0];
      if (ownUser?.clientId) assignedIds.add(String(ownUser.clientId));
      return ok(result.filter((client: any) => clientOwnerIds(client.owners).includes(String(ctx.userUid)) || assignedIds.has(String(client.id))).map(publicClient));
    }

    if (route === '/clients' && method === 'POST') {
      const incoming = await body(req);
      const previous = incoming.id ? (await rows('SELECT logoUrl FROM clients WHERE id = ? AND tenant_id = ?', [incoming.id, ctx.tenantId]))[0] : null;
      const data = tablePayload(incoming, ctx.tenantId);
      await exec('INSERT INTO clients SET ? ON DUPLICATE KEY UPDATE ?', [data, data]);
      if (previous?.logoUrl && previous.logoUrl !== data.logoUrl) await removeLocalAssetIfUnreferenced(previous.logoUrl, ctx.tenantId);
      void rows("SELECT uid FROM users WHERE tenant_id=? AND role IN ('admin','gerente')", [ctx.tenantId]).then(users => createNotificationEvent({ tenantId: ctx.tenantId, actorUserId: ctx.userUid, type: previous ? 'client_updated' : 'client_created', category: 'clients', entityType: 'client', entityId: data.id, clientId: data.id, title: previous ? 'Cliente atualizado' : 'Novo cliente', body: previous ? 'Dados importantes do cliente foram atualizados.' : 'Um novo cliente foi adicionado à agência.', route: '/?screen=client_management', recipientUserIds: users.map(user => user.uid), dedupeKey: `client:${data.id}` })).catch(() => {});
      return ok({ id: data.id });
    }

    if (route === '/clients/[id]' && method === 'GET') {
      const result = await rows('SELECT * FROM clients WHERE id = ? AND tenant_id = ?', [params.id, ctx.tenantId]);
      return result[0] ? ok(publicClient(result[0])) : err('Cliente nÃ£o encontrado.', 404);
    }

    if (route === '/clients/[id]' && method === 'DELETE') {
      const clientAssets = await rows('SELECT logoUrl FROM clients WHERE id = ? AND tenant_id = ?', [params.id, ctx.tenantId]);
      const postAssets = await rows('SELECT feedImages, storyImage, coverImage, linkedinCover, videoUrl FROM posts WHERE clientId = ? AND tenant_id = ?', [params.id, ctx.tenantId]);
      await exec('DELETE FROM approval_tokens WHERE clientId = ? AND tenant_id = ?', [params.id, ctx.tenantId]);
      await exec('DELETE FROM posts WHERE clientId = ? AND tenant_id = ?', [params.id, ctx.tenantId]);
      await exec('DELETE FROM clients WHERE id = ? AND tenant_id = ?', [params.id, ctx.tenantId]);
      for (const url of assetUrls([...clientAssets.flatMap(item => Object.values(item)), ...postAssets.flatMap(item => Object.values(item))])) await removeLocalAssetIfUnreferenced(url, ctx.tenantId);
      return ok();
    }

    if (route === '/clients/[id]/meta-account' && method === 'POST') {
      const data = await body(req);
      if (!ctx.userUid) return err('NÃ£o autenticado.', 401);
      return ok(await selectMetaAccount({ connectionId: String(data.connectionId || data.token || ''), pageId: String(data.pageId || ''), clientId: params.id, tenantId: ctx.tenantId, userUid: ctx.userUid }));
    }

    if (route === '/posts' && method === 'GET') {
      const result = await rows("SELECT *, DATE_FORMAT(date, '%Y-%m-%d') AS date FROM posts WHERE tenant_id = ? ORDER BY date ASC", [ctx.tenantId]);
      return ok(result.map((p) => ({ ...p, feedImages: parseJson(p.feedImages, []) })));
    }

    if (route === '/posts/[clientId]' && method === 'GET') {
      const result = await rows("SELECT *, DATE_FORMAT(date, '%Y-%m-%d') AS date FROM posts WHERE clientId = ? AND tenant_id = ? ORDER BY date ASC", [params.clientId, ctx.tenantId]);
      return ok(result.map((p) => ({ ...p, feedImages: parseJson(p.feedImages, []) })));
    }

    if (route === '/posts' && method === 'POST') {
      const bodyData = await body(req);
      const previousPost = bodyData.id ? (await rows('SELECT * FROM posts WHERE id = ? AND tenant_id = ?', [bodyData.id, ctx.tenantId]))[0] : null;
      const filteredData: Record<string, any> = {};
      const POST_COLUMNS = [
        'id', 'clientId', 'date', 'type', 'head', 'subhead', 'subtitle', 'objective', 
        'channel', 'title', 'centralIdea', 'caption', 'artHeadline', 'artText', 
        'cta', 'hashtags', 'visualBriefing', 'internalNotes', 'theme', 'script', 
        'feedImages', 'storyImage', 'coverImage', 'linkedinCover', 'funnelStage', 'status', 'tenant_id', 'deadline', 'assigneeId', 'videoUrl',
        'createdByUserId', 'currentAssigneeId', 'currentStage', 'workflowStatus', 'assignedAt', 'dueDate', 'priority', 'workVersion', 'stageEnteredAt', 'lastActivityAt', 'artworkCurrentVersion'
      ];
      for (const key of POST_COLUMNS) {
        if (bodyData[key] !== undefined) {
          filteredData[key] = bodyData[key];
        }
      }
      filteredData.date = assertPostDate(filteredData.date);
      if (!filteredData.clientId) return err('Cliente obrigatorio.', 400);
      if (!(await tenantOwnsClient(filteredData.clientId, ctx.tenantId))) return err('Cliente nÃ£o pertence Ã  sua agÃªncia.', 403);
      if (previousPost && bodyData.workVersion !== undefined && Number(bodyData.workVersion) !== Number(previousPost.workVersion || 1)) return err('A postagem foi alterada por outro colaborador.', 409, 'POST_VERSION_CONFLICT');
      if (!previousPost) {
        filteredData.createdByUserId = ctx.userUid;
        const socialResponsible = (await clientResponsible(db(), ctx.tenantId, filteredData.clientId, 'social_media')).user;
        const assignee = socialResponsible?.uid ? socialResponsible : (ctx.userUid ? { uid: ctx.userUid } : null);
        if (!assignee) return err('Este cliente está sem Social Media responsável. Configure a equipe antes de criar postagens.', 422, 'MISSING_SOCIAL_MEDIA');
        filteredData.currentAssigneeId = assignee.uid;
        filteredData.assigneeId = assignee.uid;
        filteredData.currentStage = 'copy'; filteredData.workflowStatus = 'in_progress';
        filteredData.assignedAt = filteredData.currentAssigneeId ? new Date() : null; filteredData.stageEnteredAt = new Date(); filteredData.lastActivityAt = new Date(); filteredData.workVersion = 1;
      } else filteredData.workVersion = Number(previousPost.workVersion || 1) + 1;
      const data = tablePayload(filteredData, ctx.tenantId);
      const result = await exec('INSERT INTO posts SET ? ON DUPLICATE KEY UPDATE ?', [data, data]);
      if (previousPost) {
        const oldUrls = assetUrls(Object.values(previousPost));
        const currentUrls = new Set(assetUrls(Object.values(data)));
        for (const url of oldUrls.filter(item => !currentUrls.has(item))) await removeLocalAssetIfUnreferenced(url, ctx.tenantId);
      }
      const postId = data.id || result.insertId;
      if (!previousPost) {
        const actor = (await rows('SELECT displayName FROM users WHERE uid=? AND tenant_id=? LIMIT 1', [ctx.userUid, ctx.tenantId]))[0];
        const assignee = data.currentAssigneeId ? (await rows('SELECT displayName FROM users WHERE uid=? AND tenant_id=? LIMIT 1', [data.currentAssigneeId, ctx.tenantId]))[0] : null;
        await recordPostActivity(db(), { tenantId: ctx.tenantId, postId: Number(postId), actorUserId: ctx.userUid, eventType: 'post_created', summary: assignee ? `${actor?.displayName || 'Um colaborador'} criou esta postagem e atribuiu a tarefa a ${assignee.displayName}.` : `${actor?.displayName || 'Um colaborador'} criou esta postagem.` });
        if (data.currentAssigneeId) await exec('INSERT INTO post_assignments(tenantId,postId,assignedByUserId,assignedToUserId,stage) VALUES(?,?,?,?,?)', [ctx.tenantId, postId, ctx.userUid, data.currentAssigneeId, data.currentStage]);
        void resolvePostRecipients(ctx.tenantId, data.clientId, data.currentAssigneeId).then(recipients => createNotificationEvent({ tenantId: ctx.tenantId, actorUserId: ctx.userUid, type: 'post_created', category: 'assignments', entityType: 'post', entityId: postId, clientId: data.clientId, title: 'Nova postagem', body: 'Uma nova postagem relacionada a você foi criada.', route: `/?clientId=${encodeURIComponent(data.clientId)}&postId=${postId}`, recipientUserIds: recipients, dedupeKey: `post-created:${postId}` })).catch(() => {});
      } else if (ctx.userUid) {
        const changed = ['head','subhead','caption','objective','visualBriefing','deadline'].filter(key => bodyData[key] !== undefined && String(bodyData[key] ?? '') !== String(previousPost[key] ?? ''));
        if (changed.length) { const actor = (await rows('SELECT displayName FROM users WHERE uid=? AND tenant_id=? LIMIT 1', [ctx.userUid, ctx.tenantId]))[0]; await recordAutosaveActivity({ tenantId: ctx.tenantId, postId: Number(postId), actorUserId: ctx.userUid, actorName: actor?.displayName || 'Um colaborador', fields: changed }); }
      }
      return ok({ id: postId, date: data.date, workVersion: data.workVersion });
    }

    if (route === '/posts/[clientId]/[date]' && method === 'DELETE') {
      const removedPosts = await rows('SELECT feedImages, storyImage, coverImage, linkedinCover, videoUrl FROM posts WHERE clientId = ? AND date = ? AND tenant_id = ?', [params.clientId, assertPostDate(params.date), ctx.tenantId]);
      await exec('DELETE FROM posts WHERE clientId = ? AND date = ? AND tenant_id = ?', [params.clientId, assertPostDate(params.date), ctx.tenantId]);
      for (const url of assetUrls(removedPosts.flatMap(post => Object.values(post)))) await removeLocalAssetIfUnreferenced(url, ctx.tenantId);
      return ok();
    }

    if (route === '/posts-bulk/[clientId]' && method === 'POST') {
      const data = await body(req);
      if (Array.isArray(data.dates) && data.dates.length) await exec('DELETE FROM posts WHERE clientId = ? AND date IN (?) AND tenant_id = ?', [params.clientId, data.dates.map(assertPostDate), ctx.tenantId]);
      return ok();
    }

    if (route === '/posts/[postId]/comments' && method === 'GET') {
      const owned = (await rows('SELECT id FROM posts WHERE id=? AND tenant_id=? LIMIT 1', [params.postId, ctx.tenantId]))[0];
      if (!owned) return err('Postagem não encontrada.', 404, 'POST_NOT_FOUND');
      return ok(await rows('SELECT * FROM post_comments WHERE postId=? AND (tenantId=? OR tenantId IS NULL) ORDER BY createdAt ASC', [params.postId, ctx.tenantId]));
    }
    if (route === '/posts/[postId]/comments' && method === 'POST') {
      const post = (await rows('SELECT id,clientId,currentAssigneeId FROM posts WHERE id=? AND tenant_id=? LIMIT 1', [params.postId, ctx.tenantId]))[0];
      if (!post) return err('Postagem não encontrada.', 404, 'POST_NOT_FOUND');
      const data = await body(req); const content = String(data.content || '').trim();
      if (!content || content.length > 4000) return err('Comentário inválido.', 422, 'INVALID_COMMENT');
      const author = ctx.userUid ? await rows('SELECT displayName,role FROM users WHERE uid=? AND tenant_id=?', [ctx.userUid,ctx.tenantId]) : [];
      const result = await exec('INSERT INTO post_comments(postId,tenantId,authorUserId,authorName,authorRole,content,revisionId,artworkVersionId,commentType,mentionsJson) VALUES(?,?,?,?,?,?,?,?,?,?)',[params.postId,ctx.tenantId,ctx.userUid,author[0]?.displayName||'Equipe',author[0]?.role||'interno',content,data.revisionId||null,data.artworkVersionId||null,data.commentType==='change_request'?'change_request':'comment',JSON.stringify(Array.isArray(data.mentions)?data.mentions.slice(0,20):[])]);
      await recordPostActivity(db(),{tenantId:ctx.tenantId,postId:Number(params.postId),actorUserId:ctx.userUid,eventType:data.commentType==='change_request'?'changes_requested':'comment_added',entityType:data.artworkVersionId?'artwork_version':data.revisionId?'revision':'comment',entityId:data.artworkVersionId||data.revisionId||result.insertId,summary:`${author[0]?.displayName||'Um colaborador'} ${data.commentType==='change_request'?'solicitou alterações':'adicionou um comentário'}.`});
      return ok({id:result.insertId});
    }

    if (route === '/tokens' && method === 'POST') {
      const payload = await body(req);
      payload.expiresAt = toMysqlDateTime(payload.expiresAt);
      if (!payload.expiresAt) return err('ExpiraÃ§Ã£o do token invÃ¡lida.', 400);
      const data = tablePayload(payload, ctx.tenantId);
      await exec('REPLACE INTO approval_tokens SET ?', [data]);
      return ok({ id: data.id });
    }
    if (route === '/tokens/[id]' && method === 'GET') {
      const result = await rows('SELECT * FROM approval_tokens WHERE id = ? AND tenant_id = ?', [params.id, ctx.tenantId]);
      return result[0] ? ok(result[0]) : err('Token nÃ£o encontrado.', 404);
    }
    if (route === '/tokens' && method === 'GET') {
      const where: string[] = ['tenant_id = ?'];
      const vals: any[] = [ctx.tenantId];
      for (const key of ['clientId', 'month', 'status']) {
        const val = url.searchParams.get(key);
        if (val) { where.push(`${key} = ?`); vals.push(val); }
      }
      return ok(await rows(`SELECT * FROM approval_tokens WHERE ${where.join(' AND ')}`, vals));
    }
    if (route === '/tokens/[id]' && method === 'PATCH') {
      const patch = await body(req);
      delete patch.tenant_id; delete patch.clientId; delete patch.id;
      await exec('UPDATE approval_tokens SET ? WHERE id = ? AND tenant_id = ?', [patch, params.id, ctx.tenantId]);
      return ok();
    }

    if (route === '/public/review/[token]' && method === 'GET') {
      const data = await getReviewData(params.token);
      return isReviewDataError(data) ? err(data.error, data.status) : ok(data);
    }
    if (route === '/public/review/[token]/action' && method === 'POST') {
      const tokenData = await validateReviewToken(params.token);
      if (isReviewDataError(tokenData)) return err(tokenData.error, tokenData.status);
      const data = await body(req);
      if (data.action !== 'approve' && data.action !== 'request_changes') {
        return err('AÃ§Ã£o de revisÃ£o invÃ¡lida.', 400);
      }
      const status = data.action === 'approve' ? 'approved' : 'waiting';
      await exec('UPDATE approval_tokens SET status = ?, clientNote = ? WHERE id = ?', [status, data.note || null, params.token]);
      return ok();
    }
    if (route === '/public/review/[token]/posts/[postId]/comments' && method === 'GET') {
      const tokenData = await validateReviewPost(params.token, params.postId);
      if (isReviewDataError(tokenData)) return err(tokenData.error, tokenData.status);
      return ok(await rows('SELECT * FROM post_comments WHERE postId = ? ORDER BY createdAt ASC', [params.postId]));
    }
    if (route === '/public/review/[token]/posts/[postId]/comments' && method === 'POST') {
      const tokenData = await validateReviewPost(params.token, params.postId);
      if (isReviewDataError(tokenData)) return err(tokenData.error, tokenData.status);
      const data = await body(req);
      if (!String(data.content || '').trim()) return err('ComentÃ¡rio vazio.', 400);
      await exec('INSERT INTO post_comments (postId, authorName, authorRole, content) VALUES (?, ?, ?, ?)', [params.postId, data.authorName || 'Cliente', 'cliente', data.content]);
      return ok();
    }
    if (route === '/public/review/[token]/send-whatsapp' && method === 'POST') {
      const tokenData = await validateReviewToken(params.token);
      if (isReviewDataError(tokenData)) return err(tokenData.error, tokenData.status);
      const client = (await rows('SELECT whatsappGroupId FROM clients WHERE id = ?', [tokenData.clientId]))[0];
      if (!client?.whatsappGroupId) return err('Grupo de WhatsApp nÃ£o configurado para este cliente.', 400);
      await sendWAMessage(client.whatsappGroupId, `${url.origin}/review/${params.token}`);
      return ok();
    }

    if (route === '/review/[token]/export-pdf' && method === 'GET') {
      const requestIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
      if (await rateLimited(`pdf:${requestIp}`, 5, 60_000)) return err('Limite de geraÃ§Ã£o de PDF excedido.', 429);
      const tokenData = await validateReviewToken(params.token);
      if (isReviewDataError(tokenData)) return err(tokenData.error, tokenData.status);
      const data = await getReviewData(params.token);
      if (isReviewDataError(data)) return err(data.error, data.status);
      const internalOrigin = internalAppOrigin(req);
      const pdf = await renderPdf(`${internalOrigin}/review/${encodeURIComponent(params.token)}/export`);
      if (process.env.VERCEL) {
        const stored = await storeAssetBuffer({
          buffer: Buffer.from(pdf),
          tenantId: tokenData.tenant_id,
          folder: 'pdfs',
          fileName: `planejamento-${params.token}.pdf`,
          mimeType: 'application/pdf',
        });
        return ok({ downloadUrl: stored.url });
      }
      return new Response(pdf, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="planejamento.pdf"' } });
    }
    if (route === '/presentation/[clientId]/[month]/export-pdf' && method === 'GET') {
      if (!(await tenantOwnsClient(params.clientId, ctx.tenantId))) return err('Cliente invÃ¡lido.', 403);
      if (await rateLimited(`pdf:${ctx.userUid}`, 10, 60_000)) return err('Limite de geraÃ§Ã£o de PDF excedido.', 429);
      const data = await getPresentationData(params.clientId, params.month);
      if (isReviewDataError(data)) return err(data.error, data.status);
      const internalOrigin = internalAppOrigin(req);
      const pdf = await renderPdf(`${internalOrigin}/presentation/${encodeURIComponent(params.clientId)}/${encodeURIComponent(params.month)}/export`);
      if (process.env.VERCEL) {
        const stored = await storeAssetBuffer({
          buffer: Buffer.from(pdf),
          tenantId: ctx.tenantId,
          folder: 'pdfs',
          fileName: `planejamento-${params.clientId}-${params.month}.pdf`,
          mimeType: 'application/pdf',
        });
        return ok({ downloadUrl: stored.url });
      }
      return new Response(pdf, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="planejamento.pdf"' } });
    }

    if (route === '/production-gallery' && method === 'GET') {
      const posts = await rows("SELECT *, DATE_FORMAT(date, '%Y-%m-%d') AS date FROM posts WHERE tenant_id = ? ORDER BY date DESC", [ctx.tenantId]);
      const clients = await rows('SELECT id,name,logoUrl FROM clients WHERE tenant_id = ? ORDER BY name', [ctx.tenantId]);
      const members = await rows('SELECT uid,displayName,email,photoURL,role FROM users WHERE tenant_id = ? ORDER BY displayName,email', [ctx.tenantId]);
      return ok({ posts: posts.map(post => ({ ...post, feedImages: parseJson(post.feedImages, []) })), clients, members });
    }
    if (route === '/team/members' && method === 'GET') return ok(await rows('SELECT uid, displayName, email, photoURL, role FROM users WHERE tenant_id = ? ORDER BY displayName, email', [ctx.tenantId]));
    if (route === '/users/me' && method === 'GET') {
      const result = await rows('SELECT uid,email,displayName,photoURL,role,tenant_id,birthday,githubUsername,portfolioUrl FROM users WHERE uid = ? AND tenant_id = ? LIMIT 1', [ctx.userUid, ctx.tenantId]);
      return result[0] ? ok(result[0]) : err('Usuário não encontrado.', 404, 'PROFILE_NOT_FOUND');
    }
    if (route === '/users/me' && method === 'PATCH') {
      if (!ctx.userUid) return err('Sessão expirada.', 401, 'UNAUTHORIZED');
      const incoming = await body(req);
      const allowed = new Set(['displayName', 'birthday', 'githubUsername', 'portfolioUrl', 'photoURL', 'photoAssetId']);
      const unknown = Object.keys(incoming || {}).filter(key => !allowed.has(key));
      if (unknown.length) return err('O perfil contém campos não permitidos.', 400, 'INVALID_PROFILE_DATA');
      const displayName = String(incoming.displayName ?? '').trim();
      if (!displayName || displayName.length > 255) return err('Informe um nome de exibição válido.', 422, 'INVALID_PROFILE_DATA', { displayName: 'Nome obrigatório, com até 255 caracteres.' });
      const birthdayValue = incoming.birthday === null || incoming.birthday === '' || incoming.birthday === undefined ? null : String(incoming.birthday);
      if (birthdayValue) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdayValue)) return err('Data de nascimento inválida.', 422, 'INVALID_BIRTH_DATE', { birthday: 'Use o formato YYYY-MM-DD.' });
        const [year, month, day] = birthdayValue.split('-').map(Number);
        const parsed = new Date(Date.UTC(year, month - 1, day));
        if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return err('Data de nascimento inválida.', 422, 'INVALID_BIRTH_DATE', { birthday: 'Informe uma data existente.' });
      }
      const githubUsername = incoming.githubUsername == null ? null : String(incoming.githubUsername).trim().replace(/^@/, '') || null;
      if (githubUsername && !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(githubUsername)) return err('Usuário do GitHub inválido.', 422, 'INVALID_PROFILE_DATA', { githubUsername: 'Use apenas letras, números e hífens.' });
      let portfolioUrl: string | null = incoming.portfolioUrl == null ? null : String(incoming.portfolioUrl).trim() || null;
      if (portfolioUrl && !/^[a-z][a-z0-9+.-]*:/i.test(portfolioUrl)) portfolioUrl = `https://${portfolioUrl}`;
      if (portfolioUrl) {
        try { const parsed = new URL(portfolioUrl); if (parsed.protocol !== 'https:') throw new Error(); portfolioUrl = parsed.toString(); }
        catch { return err('URL do portfólio inválida.', 422, 'INVALID_PORTFOLIO_URL', { portfolioUrl: 'Informe uma URL HTTPS válida.' }); }
      }
      const previous = (await rows('SELECT photoURL FROM users WHERE uid = ? AND tenant_id = ? LIMIT 1', [ctx.userUid, ctx.tenantId]))[0];
      let photoURL: string | null = incoming.photoURL === undefined ? (previous?.photoURL || null) : (String(incoming.photoURL || '').trim() || null);
      if (photoURL && !photoURL.startsWith('/uploads/')) return err('A referência da foto é inválida.', 422, 'INVALID_PROFILE_DATA', { photoURL: 'Use uma imagem enviada pelo aplicativo.' });
      if (incoming.photoAssetId) {
        const ownedAsset = (await rows("SELECT id,publicUrl FROM media_assets WHERE id=? AND tenantId=? AND ownerType='user' AND ownerId=? AND category IN ('avatar','avatar_thumbnail') AND status='active' LIMIT 1", [String(incoming.photoAssetId), ctx.tenantId, ctx.userUid]))[0];
        if (!ownedAsset || ownedAsset.publicUrl !== photoURL) return err('A foto não pertence ao usuário autenticado.', 403, 'FORBIDDEN');
      }
      await exec('UPDATE users SET displayName=?,birthday=?,githubUsername=?,portfolioUrl=?,photoURL=? WHERE uid=? AND tenant_id=?', [displayName, birthdayValue, githubUsername, portfolioUrl, photoURL, ctx.userUid, ctx.tenantId]);
      const updated = (await rows('SELECT uid,email,displayName,photoURL,role,tenant_id,birthday,githubUsername,portfolioUrl FROM users WHERE uid=? AND tenant_id=? LIMIT 1', [ctx.userUid, ctx.tenantId]))[0];
      if (previous?.photoURL && previous.photoURL !== photoURL) await removeLocalAssetIfUnreferenced(previous.photoURL, ctx.tenantId);
      return ok(updated);
    }
    if (route === '/users' && method === 'GET') return ok(await rows('SELECT uid, email, displayName, photoURL, role, tenant_id, whatsapp, clientId, birthday FROM users WHERE tenant_id = ?', [ctx.tenantId]));
    if (route === '/users/[uid]' && method === 'GET') {
      const result = await rows('SELECT uid, email, displayName, photoURL, role, tenant_id, whatsapp, clientId, birthday FROM users WHERE uid = ? AND tenant_id = ?', [params.uid, ctx.tenantId]);
      return result[0] ? ok(result[0]) : err('UsuÃ¡rio nÃ£o encontrado.', 404);
    }
    if (route === '/users' && method === 'POST') {
      const incoming = await body(req);
      const previous = incoming.uid ? (await rows('SELECT uid, photoURL FROM users WHERE uid = ? AND tenant_id = ?', [incoming.uid, ctx.tenantId]))[0] : null;
      if (!previous && (typeof incoming.password !== 'string' || incoming.password.length < 8)) {
        return err('Defina uma senha com pelo menos 8 caracteres.', 400);
      }
      if (incoming.password !== undefined && incoming.password !== '' && String(incoming.password).length < 8) {
        return err('A senha deve possuir pelo menos 8 caracteres.', 400);
      }
      if (incoming.password === '') delete incoming.password;
      const allowedUserFields = ['uid', 'email', 'displayName', 'photoURL', 'role', 'whatsapp', 'clientId', 'birthday', 'password'];
      const filteredUser = Object.fromEntries(allowedUserFields.filter(key => incoming[key] !== undefined).map(key => [key, incoming[key]]));
      const data = tablePayload(filteredUser, ctx.tenantId);
      if (data.password) data.password = await bcrypt.hash(data.password, 10);
      await exec('INSERT INTO users SET ? ON DUPLICATE KEY UPDATE ?', [data, data]);
      await ensureNotificationPreferences(ctx.tenantId, data.uid);
      if (previous?.photoURL && previous.photoURL !== data.photoURL) await removeLocalAssetIfUnreferenced(previous.photoURL, ctx.tenantId);
      return ok();
    }
    if (route === '/users/[uid]' && method === 'DELETE') {
      const previous = (await rows('SELECT photoURL FROM users WHERE uid = ? AND tenant_id = ?', [params.uid, ctx.tenantId]))[0];
      await exec('DELETE FROM users WHERE uid = ? AND tenant_id = ?', [params.uid, ctx.tenantId]);
      if (previous?.photoURL) await removeLocalAssetIfUnreferenced(previous.photoURL, ctx.tenantId);
      return ok();
    }
    if (route === '/users/change-password' && method === 'POST') {
      const data = await body(req);
      if (!ctx.userUid) return err('NÃ£o autenticado.', 401);
      const found = await rows('SELECT password FROM users WHERE uid = ?', [ctx.userUid]);
      if (!found[0] || !(await bcrypt.compare(data.currentPassword, found[0].password))) return err('Senha atual invÃ¡lida.', 401);
      await exec('UPDATE users SET password = ? WHERE uid = ?', [await bcrypt.hash(data.newPassword, 10), ctx.userUid]);
      return ok();
    }

    if (route === '/custom-roles' && method === 'GET') return ok(await rows('SELECT * FROM custom_roles WHERE tenant_id = ?', [ctx.tenantId]));
    if (route === '/custom-roles' && method === 'POST') { const data = tablePayload(await body(req), ctx.tenantId); await exec('REPLACE INTO custom_roles SET ?', [data]); return ok(); }
    if (route === '/custom-roles/[id]' && method === 'DELETE') { await exec('DELETE FROM custom_roles WHERE id = ? AND tenant_id = ?', [params.id, ctx.tenantId]); return ok(); }

    if (route === '/settings/[id]' && method === 'GET') {
      const scopedId = `${ctx.tenantId}:${params.id}`;
      const result = await rows('SELECT data FROM settings WHERE id IN (?, ?) ORDER BY id = ? DESC LIMIT 1', [scopedId, params.id, scopedId]);
      return ok(parseJson(result[0]?.data, {}));
    }
    if (route === '/settings/[id]' && method === 'POST') {
      await exec('REPLACE INTO settings SET ?', [{ id: `${ctx.tenantId}:${params.id}`, data: JSON.stringify(await body(req)) }]);
      return ok();
    }
    if (route === '/users/preferences' && method === 'GET') {
      const result = await rows('SELECT ui_preferences FROM users WHERE uid = ? AND tenant_id = ? LIMIT 1', [ctx.userUid, ctx.tenantId]);
      return ok(parseJson(result[0]?.ui_preferences, {}));
    }
    if (route === '/users/preferences' && method === 'POST') {
      const incoming = await body(req);
      const allowedKeys = new Set(['theme', 'density', 'language', 'notifications', 'widgetLayouts', 'dashboardLayoutVersion', 'companion', 'sidebarPinned']);
      const widgetIds = new Set(['my_work','deadlines','production_bi','workload','productivity','recent_activity','client_grid','companion']);
      const widgetSizes = new Set(['compact','medium','wide']);
      if (incoming?.widgetLayouts && typeof incoming.widgetLayouts === 'object') {
        const own = incoming.widgetLayouts[ctx.userUid || ''];
        if (Array.isArray(own)) {
          const seen = new Set<string>();
          incoming.widgetLayouts[ctx.userUid || ''] = own.filter((item:any) => item && widgetIds.has(String(item.id)) && !seen.has(String(item.id)) && seen.add(String(item.id))).slice(0, widgetIds.size).map((item:any,index:number) => ({ id:String(item.id), position:index, size:widgetSizes.has(item.size)?item.size:'medium', isHidden:Boolean(item.isHidden), zIndex:1 }));
        }
      }
      const current = parseJson((await rows('SELECT ui_preferences FROM users WHERE uid = ? AND tenant_id = ? LIMIT 1', [ctx.userUid, ctx.tenantId]))[0]?.ui_preferences, {});
      if (incoming?.expectedDashboardLayoutVersion != null && Number(incoming.expectedDashboardLayoutVersion) !== Number(current.dashboardLayoutVersion || 1)) return err('O layout foi alterado em outra sess?o. Recarregue antes de salvar.', 409, 'DASHBOARD_LAYOUT_CONFLICT');
      for (const [key, value] of Object.entries(incoming || {})) if (allowedKeys.has(key)) current[key] = value;
      const serialized = JSON.stringify(current);
      if (serialized.length > 100_000) return err('PreferÃªncias acima do limite.', 413);
      await exec('UPDATE users SET ui_preferences = ? WHERE uid = ? AND tenant_id = ?', [serialized, ctx.userUid, ctx.tenantId]);
      return ok(current);
    }
    if (route === '/agency/settings' && method === 'POST') {
      const incoming = await body(req);
      const normalizeDeadlineDay = (value: unknown) => {
        if (value === '' || value === null || value === undefined) return null;
        const day = Number(value);
        if (!Number.isInteger(day) || day < 1 || day > 31) throw new Error('O prazo deve ser um dia entre 1 e 31.');
        return day;
      };
      const planningMonth = String(incoming.planning_month || '').trim();
      const existing = (await rows('SELECT * FROM agencies WHERE id = ? LIMIT 1', [ctx.tenantId]))[0] || {};
      const preserveBlank = incoming._deferredPreLogin === true;
      const textValue = (key: string, nullable = false) => {
        const value = String(incoming[key] ?? '').trim();
        if (preserveBlank && !value) return existing[key] ?? (nullable ? null : '');
        return value || (nullable ? null : '');
      };
      const data = tablePayload({
        id: ctx.tenantId,
        name: textValue('name'),
        slogan: textValue('slogan', true),
        logo_url: textValue('logo_url', true),
        logo_dark_url: textValue('logo_dark_url', true),
        planning_month: /^\d{4}-\d{2}$/.test(planningMonth) ? planningMonth : null,
        deadline_pre: normalizeDeadlineDay(incoming.deadline_pre),
        deadline_final: normalizeDeadlineDay(incoming.deadline_final),
        theme_config: incoming.theme_config || null
      });
      await exec('INSERT INTO agencies SET ? ON DUPLICATE KEY UPDATE ?', [data, data]);
      for (const oldUrl of [existing.logo_url, existing.logo_dark_url]) {
        if (oldUrl && oldUrl !== data.logo_url && oldUrl !== data.logo_dark_url) await removeLocalAssetIfUnreferenced(oldUrl, ctx.tenantId);
      }
      return ok();
    }
    if (route === '/agency/settings/[id]' && method === 'GET') { if (params.id !== ctx.tenantId) return err('AgÃªncia invÃ¡lida.', 403); const result = await rows('SELECT * FROM agencies WHERE id = ?', [ctx.tenantId]); return ok(result[0] || {}); }
    if (route === '/agencies' && method === 'GET') return ok(await rows('SELECT * FROM agencies WHERE id = ?', [ctx.tenantId]));

    if ((route === '/upload-base64' || route === '/upload-audio') && method === 'POST') {
      if (await rateLimited(`asset:${ctx.userUid}`, 30, 60_000)) return err('Limite de uploads excedido.', 429);
      const data = await body(req);
      const folder = String(data.subfolder || (route === '/upload-audio' ? 'audio' : 'profiles'));
      const clientId = String(data.clientId || '');
      if (['posts', 'logos', 'audio'].includes(folder) && (!clientId || !(await tenantOwnsClient(clientId, ctx.tenantId)))) return err('Cliente invalido.', 403);
      if (folder === 'posts' && !ctx.permissions.has('canCreatePosts')) return err('Permissao insuficiente.', 403);
      if (['logos', 'audio'].includes(folder) && !ctx.permissions.has('canConfigClients')) return err('Permissao insuficiente.', 403);
      if (folder === 'branding' && !ctx.permissions.has('canManageBrandSystem')) return err('Permissao insuficiente.', 403);
      if (['avatars', 'profiles'].includes(folder) && String(data.targetUserId || ctx.userUid) !== ctx.userUid && !ctx.permissions.has('canManageRoles')) return err('Permissao insuficiente.', 403);
      const stored = await uploadBase64(data, route === '/upload-audio', ctx.tenantId);
      const categoryMap: Record<string, string> = { avatars: 'avatar', profiles: 'avatar', logos: 'logo', branding: 'agency_logo', posts: 'post_art', audio: 'audio' };
      const category = categoryMap[folder] || folder;
      const assetId = await registerMediaAsset(ctx, data, stored, category);
      let thumbnailAssetId: string | null = null;
      if (stored.thumbnail) {
        thumbnailAssetId = await registerMediaAsset(ctx, data, { ...stored.thumbnail, mimeType: 'image/webp', originalName: stored.originalName }, category, '_thumbnail');
      }
      return ok({ url: stored.url, assetId, thumbnailUrl: stored.thumbnail?.url || null, thumbnailAssetId });
    }
    if (route === '/uploads/media/init' && method === 'POST') {
      if (await rateLimited(`media-init:${ctx.userUid}`, 20, 60_000)) return err('Limite de uploads excedido.', 429);
      const data = await body(req);
      const clientId = String(data.clientId || '');
      if (!clientId || !(await tenantOwnsClient(clientId, ctx.tenantId))) return err('Cliente invÃƒÂ¡lido.', 403);
      const intentId = randomBytes(24).toString('hex');
      const initialized = await initDirectNextcloudUpload({
        intentId,
        tenantId: ctx.tenantId,
        clientId,
        postDate: data.postDate,
        fileName: String(data.fileName || 'media'),
        mimeType: String(data.mimeType || '').toLowerCase(),
        size: Number(data.size || 0),
      });
      await exec(
        'INSERT INTO upload_intents (id, tenant_id, user_uid, client_id, remote_path, stored_name, mime_type, size_bytes, upload_share_id, owner_type, owner_id, category, original_name, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY))',
        [intentId, ctx.tenantId, ctx.userUid, clientId, initialized.remotePath, initialized.storedName, String(data.mimeType || '').toLowerCase(), Number(data.size || 0), initialized.uploadShareId, 'post', String(data.ownerId || clientId), String(data.category || 'media'), String(data.fileName || 'media').slice(0, 255)],
      );
      return ok({ intentId, uploadUrl: initialized.uploadUrl });
    }
    if (route === '/uploads/media/finalize' && method === 'POST') {
      const data = await body(req);
      const intent = (await rows(
        'SELECT * FROM upload_intents WHERE id = ? AND tenant_id = ? AND user_uid = ? AND finalized_at IS NULL AND expires_at > NOW() LIMIT 1',
        [String(data.intentId || ''), ctx.tenantId, ctx.userUid],
      ))[0];
      if (!intent) return err('Upload invÃƒÂ¡lido ou expirado.', 404);
      const finalized = await finalizeDirectNextcloudUpload({
        remotePath: intent.remote_path,
        uploadShareId: intent.upload_share_id,
        mimeType: intent.mime_type,
        expectedSize: Number(intent.size_bytes),
      });
      await exec('UPDATE upload_intents SET finalized_at = NOW(), final_url = ? WHERE id = ?', [finalized.url, intent.id]);
      const assetId = await registerMediaAsset(ctx, { clientId: intent.client_id, ownerId: intent.owner_id, fileName: intent.original_name, mimeType: intent.mime_type, size: intent.size_bytes }, { ...finalized, mimeType: intent.mime_type, sizeBytes: intent.size_bytes, originalName: intent.original_name }, intent.category || 'media');
      return ok({ ...finalized, assetId });
    }
    if (route === '/uploads/media' && method === 'PUT') {
      if (process.env.VERCEL) return err('Use o fluxo de upload direto.', 409);
      if (!req.body) return err('Arquivo obrigatÃ³rio.', 400);
      if (await rateLimited(`media:${ctx.userUid}`, 20, 60_000)) return err('Limite de uploads excedido.', 429);
      const clientId = String(req.headers.get('x-client-id') || '');
      if (!clientId || !(await tenantOwnsClient(clientId, ctx.tenantId))) return err('Cliente invÃ¡lido.', 403);
      const size = Number(req.headers.get('content-length') || 0);
      const result = await storeMedia({
        body: req.body,
        tenantId: ctx.tenantId,
        clientId,
        postDate: req.headers.get('x-post-date') || undefined,
        fileName: decodeURIComponent(req.headers.get('x-file-name') || 'media'),
        mimeType: String(req.headers.get('content-type') || '').split(';')[0].toLowerCase(),
        size
      });
      const assetId = await registerMediaAsset(ctx, { clientId, ownerId: req.headers.get('x-owner-id') || clientId, fileName: decodeURIComponent(req.headers.get('x-file-name') || 'media'), mimeType: String(req.headers.get('content-type') || '').split(';')[0].toLowerCase(), size }, { ...result, sizeBytes: size }, req.headers.get('x-category') || 'media');
      return ok({ ...result, assetId });
    }

    if (route === '/holidays/[year]' && method === 'GET') {
      const r = await axios.get(`https://brasilapi.com.br/api/feriados/v1/${params.year}`).catch(() => ({ data: [] }));
      return ok(r.data);
    }
    if (route === '/geolocate' && method === 'GET') {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';
      return ok({ ip });
    }

    if (route === '/analytics/[clientId]' && method === 'GET') { if (!(await tenantOwnsClient(params.clientId, ctx.tenantId))) return err('Cliente invÃ¡lido.', 403); const url = new URL(req.url); const start = url.searchParams.get('startDate') || new Date(Date.now() - 1095 * 86400000).toISOString().slice(0, 10); const end = url.searchParams.get('endDate') || new Date().toISOString().slice(0, 10); return ok(await rows('SELECT * FROM client_analytics WHERE clientId = ? AND date BETWEEN ? AND ? ORDER BY date ASC', [params.clientId, start, end])); }
    if (route === '/analytics/[clientId]/posts' && method === 'GET') { const url = new URL(req.url); const start = url.searchParams.get('startDate') || new Date(Date.now() - 1095 * 86400000).toISOString().slice(0, 10); const end = url.searchParams.get('endDate') || new Date().toISOString().slice(0, 10); return ok(await rows('SELECT p.*, pa.* FROM posts p LEFT JOIN post_analytics pa ON p.id = pa.postId WHERE p.clientId = ? AND p.tenant_id = ? AND p.date BETWEEN ? AND ? ORDER BY p.date ASC', [params.clientId, ctx.tenantId, start, end])); }
    if (route === '/analytics/[clientId]/sync' && method === 'POST') return ok({ success: true, synced: [], errors: [{ message: 'Sync externo ainda nÃ£o migrado para Route Handler.' }] });
    if (route === '/admin/dashboard-stats' && method === 'GET') {
      const clients = await rows('SELECT COUNT(*) as total FROM clients WHERE tenant_id = ?', [ctx.tenantId]);
      const posts = await rows('SELECT COUNT(*) as total FROM posts WHERE tenant_id = ?', [ctx.tenantId]);
      const users = await rows('SELECT COUNT(*) as total FROM users WHERE tenant_id = ?', [ctx.tenantId]);
      return ok({ clients: clients[0]?.total || 0, posts: posts[0]?.total || 0, users: users[0]?.total || 0 });
    }
    if (route === '/admin/workload-stats' && method === 'GET') return ok(await rows('SELECT u.uid, u.displayName, COUNT(p.id) as total FROM users u LEFT JOIN posts p ON p.assigneeId = u.uid AND p.tenant_id = u.tenant_id WHERE u.tenant_id = ? GROUP BY u.uid, u.displayName', [ctx.tenantId]));
    if (route === '/admin/trigger-deadline-alerts' && method === 'POST') return ok();
    if (route === '/notify-whatsapp' && method === 'POST') { const data = await body(req); await sendWAMessage(data.to, data.text); return ok(); }
    if (route === '/clients/[id]/send-for-review' && method === 'POST') {
      const found = await rows('SELECT name, whatsappGroupId FROM clients WHERE id = ? AND tenant_id = ?', [params.id, ctx.tenantId]);
      const client = found[0];
      if (!client) return err('Cliente nÃ£o encontrado.', 404);
      const requestData = await body(req);
      const month = /^\d{4}-\d{2}$/.test(requestData.month || '') ? requestData.month : new Date().toISOString().slice(0, 7);
      const reviewToken = randomBytes(32).toString('hex');
      await exec('INSERT INTO approval_tokens (id, clientId, month, status, expiresAt, createdAt, tenant_id) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY), ?, ?)', [reviewToken, params.id, month, 'pending', Date.now(), ctx.tenantId]);
      const reviewUrl = `${process.env.APP_URL || url.origin}/review/${reviewToken}`;
      if (client.whatsappGroupId) await sendWAMessage(client.whatsappGroupId, `Planejamento disponÃ­vel: ${reviewUrl}`);
      return ok({ token: reviewToken, url: reviewUrl });
    }
    if (route === '/meta/sync/[clientId]' && method === 'POST') return err('Sync Meta ainda nÃ£o migrado para Route Handler.', 501);

    if (route === '/leia/chat' && method === 'POST') {
      const data = await body(req);
      const message = String(data.message || '').trim().slice(0, 8000);
      if (!message) return err('Mensagem obrigatÃ³ria.', 400);
      if (await rateLimited(`leia:${ctx.userUid}`, 30, 60_000)) return err('A LeIA recebeu muitas solicitaÃ§Ãµes. Aguarde um instante.', 429);

      let clientContext: Record<string, unknown> | null = null;
      const clientId = String(data.clientId || '');
      if (clientId) {
        if (!(await tenantOwnsClient(clientId, ctx.tenantId))) return err('Cliente nÃ£o encontrado.', 404);
        clientContext = (await rows(
          'SELECT name, segment, voiceTone, targetAudience, contentColumns, brandNotes, postFrequency, networks, visualInfo FROM clients WHERE id = ? AND tenant_id = ? LIMIT 1',
          [clientId, ctx.tenantId]
        ))[0] || null;
      }

      const history = Array.isArray(data.history) ? data.history.slice(-20) : [];
      try {
        const response = await completeWithLeia({
          messages: [
            {
              role: 'system',
              content: `VocÃª Ã© a LeIA, assistente interna de uma agÃªncia de social media e marketing digital. Seu nome Ã© um trocadilho com a colaboradora Leia, conhecida por resolver tudo. Responda em portuguÃªs do Brasil, de forma prÃ¡tica, estratÃ©gica e profissional. Ajude com ideias, calendÃ¡rios, legendas, briefings, funil, campanhas e revisÃ£o de conteÃºdo. Use o contexto do cliente sem inventar dados. Contexto: ${JSON.stringify(clientContext || {})}`
            },
            ...history.map((item: any) => ({
              role: item?.sender === 'leia' ? 'assistant' as const : 'user' as const,
              content: String(item?.text || '').slice(0, 8000)
            })).filter((item: any) => item.content),
            { role: 'user', content: message }
          ],
          temperature: 0.6,
          maxCompletionTokens: 2048
        });
        return ok({ response });
      } catch (error: any) {
        if (error?.message === 'LEIA_NOT_CONFIGURED') return err('LeIA nÃ£o configurada.', 503);
        return err('A LeIA nÃ£o conseguiu responder agora.', 502);
      }
    }
    if (route === '/generate-objective' && method === 'POST') {
      const data = await body(req);
      const clientId = String(data.clientId || '');
      if (!clientId || !(await tenantOwnsClient(clientId, ctx.tenantId))) return err('Cliente nÃ£o encontrado.', 404);
      const incoming = Array.isArray(data.posts) ? data.posts : [data.post || data];
      const posts = incoming.slice(0, 100).map((post: any) => ({
        date: String(post.date || ''), type: String(post.type || ''), channel: String(post.channel || ''),
        title: String(post.title || ''), centralIdea: String(post.centralIdea || ''), caption: String(post.caption || post.subtitle || ''),
        subhead: String(post.subhead || ''), cta: String(post.cta || ''), hashtags: String(post.hashtags || ''),
        head: String(post.head || post.artHeadline || ''), objective: String(post.objective || ''), funnelStage: String(post.funnelStage || ''),
        theme: String(post.theme || ''), script: String(post.script || ''), postNumber: Number(post.postNumber) || 0
      }));
      if (!posts.length) return err('Nenhuma postagem informada.', 400);
      const fallbacks = posts.map((post: any, index: number) => ruleGeneratedFields(post, index, posts.length));
      if (!process.env.GROQ_API_KEY) return ok({ results: fallbacks, source: 'rules' });
      const clients = await rows('SELECT name, segment, voiceTone, targetAudience, contentColumns, brandNotes FROM clients WHERE id = ? AND tenant_id = ? LIMIT 1', [clientId, ctx.tenantId]);
      const client = clients[0] || {};
      const generationInputs = posts.map((post: any) => ({
        ...post,
        missingFields: [...['title', 'subhead', 'caption', 'objective', 'cta', 'hashtags'].filter((field) => !String(post[field] || '').trim()), 'funnelStage']
      }));
      const prompt = `VocÃª Ã© estrategista de conteÃºdo. Leia todos os campos existentes de cada postagem e gere exatamente um objeto por postagem, em JSON vÃ¡lido, sem markdown, no formato {"results":[{"date":"YYYY-MM-DD","title":"...","head":"...","subhead":"...","caption":"...","objective":"...","cta":"...","hashtags":"...","funnelStage":"topo|meio|fundo"}]}.
Regras: use os campos preenchidos como contexto e devolva-os sem alteraÃ§Ãµes; crie conteÃºdo somente para os campos em missingFields; title Ã© o tÃ­tulo interno e deve ser exatamente "Post N â€” explicaÃ§Ã£o extremamente breve do assunto", usando postNumber como N; title nunca Ã© a head; nunca crie, complete ou altere head â€” devolva a head original exatamente como recebida ou uma string vazia se ela estiver vazia; objetivo deve ter uma frase; sempre reclassifique funnelStage usando todos os campos preenchidos da postagem como contexto, mesmo que funnelStage jÃ¡ tenha valor; no lote distribua de forma estratÃ©gica entre topo, meio e fundo e nÃ£o repita tÃ­tulos. NÃ£o use, nÃ£o gere e nÃ£o mencione briefing para a arte, visualBriefing ou artText. Preserve a ordem e a date recebida.
Cliente: ${JSON.stringify(client)}
Postagens: ${JSON.stringify(generationInputs)}`;
      try {
        const content = await completeWithLeia({
          temperature: 0.4,
          maxCompletionTokens: 4096,
          responseFormat: {
            type: 'json_schema',
            json_schema: {
              name: 'generated_post_fields',
              strict: true,
              schema: {
                type: 'object',
                additionalProperties: false,
                required: ['results'],
                properties: {
                  results: {
                    type: 'array',
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      required: ['date', 'title', 'head', 'subhead', 'caption', 'objective', 'cta', 'hashtags', 'funnelStage'],
                      properties: {
                        date: { type: 'string' },
                        title: { type: 'string' },
                        head: { type: 'string' },
                        subhead: { type: 'string' },
                        caption: { type: 'string' },
                        objective: { type: 'string' },
                        cta: { type: 'string' },
                        hashtags: { type: 'string' },
                        funnelStage: { type: 'string', enum: ['topo', 'meio', 'fundo'] }
                      }
                    }
                  }
                }
              }
            }
          },
          messages: [
            { role: 'system', content: 'VocÃª Ã© a LeIA, estrategista de conteÃºdo para redes sociais. Responda somente no JSON solicitado, em portuguÃªs do Brasil.' },
            { role: 'user', content: prompt }
          ]
        });
        const generated = extractGeneratedJson(content);
        if (!generated || generated.length !== posts.length) return ok({ results: fallbacks, source: 'rules' });
        const results = generated.map((item: any, index: number) => {
          const fallback = fallbacks[index];
          const original = posts[index];
          const stage = ['topo', 'meio', 'fundo'].includes(item?.funnelStage) ? item.funnelStage : fallback.funnelStage;
          return {
            date: original.date,
            title: String(String(original.title || '').trim() ? original.title : item?.title || fallback.title).trim().slice(0, 120),
            head: String(original.head || '').slice(0, 78),
            subhead: String(original.subhead || item?.subhead || '').trim().slice(0, 180),
            caption: String(original.caption || item?.caption || '').trim().slice(0, 5000),
            objective: String(original.objective || item?.objective || fallback.objective).trim().slice(0, 240),
            cta: String(original.cta || item?.cta || '').trim().slice(0, 180),
            hashtags: String(original.hashtags || item?.hashtags || '').trim().slice(0, 500),
            funnelStage: stage,
            source: 'leia'
          };
        });
        return ok({ results, source: 'leia' });
      } catch {
        return ok({ results: fallbacks, source: 'rules' });
      }
    }

    if (route === '/auth/social/login/[platform]' && method === 'GET') {
      if (!ctx.isAuthenticated || !ctx.userUid) return err('NÃ£o autenticado.', 401);
      if (!['instagram', 'facebook', 'meta'].includes(params.platform)) return err('IntegraÃ§Ã£o nÃ£o suportada.', 400);
      const clientId = new URL(req.url).searchParams.get('clientId') || '';
      const origin = process.env.APP_URL || `${req.headers.get('x-forwarded-proto') || new URL(req.url).protocol.replace(':', '')}://${req.headers.get('x-forwarded-host') || req.headers.get('host') || new URL(req.url).host}`;
      return NextResponse.redirect(await createMetaOAuth({ tenantId: ctx.tenantId, userUid: ctx.userUid, clientId, origin }));
    }
    if (route === '/auth/callback/[platform]' && method === 'GET') {
      const url = new URL(req.url);
      const origin = process.env.APP_URL || `${req.headers.get('x-forwarded-proto') || url.protocol.replace(':', '')}://${req.headers.get('x-forwarded-host') || req.headers.get('host') || url.host}`;
      const result = await finishMetaOAuth({ state: url.searchParams.get('state') || '', code: url.searchParams.get('code') || '', origin });
      const payload = JSON.stringify({ platform: 'instagram', connectionId: result.connectionId, token: result.connectionId, accounts: result.accounts, diagnostic: result.diagnostic }).replace(/</g, '\\u003c');
      return new NextResponse(`<!doctype html><meta charset="utf-8"><script>window.opener&&window.opener.postMessage('oauth-payload:'+${JSON.stringify(payload)},${JSON.stringify(origin)});window.close()</script><p>ConexÃ£o concluÃ­da. Esta janela pode ser fechada.</p>`, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
    }

    return err(`Endpoint nÃ£o migrado: ${method} ${route}`, 404);
  } catch (e: any) {
    if (String(e?.message || '').includes('REMOTE_STORAGE') || String(e?.message || '').startsWith('NEXTCLOUD_')) {
      console.warn('[storage] remote operation unavailable');
      return err('Storage remoto indisponivel. Tente novamente sem reenviar os itens concluidos.', 503);
    }
    console.error(e);
    if (e?.message === 'PDF_BUSY') return err('ServiÃ§o de PDF ocupado. Tente novamente em instantes.', 503);
    return err('Erro interno.', 500);
  }
}

