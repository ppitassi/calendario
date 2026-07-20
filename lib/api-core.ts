import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from './db';
import bcrypt from 'bcryptjs';
import axios from 'axios';
import path from 'path';
import { randomBytes } from 'crypto';
import { promises as fsp } from 'fs';
import { completeWithLeia } from './leia';
import { storeMedia } from './storage';
import {
  getPresentationData,
  getReviewData,
  isReviewDataError,
  validateReviewPost,
  validateReviewToken,
} from './review-data';

function db() {
  return getDbPool();
}

type Params = Record<string, string>;
type Permission = 'canCreatePosts' | 'canEditAssignedPosts' | 'canEditCalendar' | 'canReviewAndSend' | 'canConfigClients' | 'canManageRoles' | 'canViewPresentation' | 'canComment';
type Ctx = { userUid: string | null; userRole: string | null; tenantId: string; isAuthenticated: boolean; permissions: Set<Permission> };

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: ['canCreatePosts', 'canEditAssignedPosts', 'canEditCalendar', 'canReviewAndSend', 'canConfigClients', 'canManageRoles', 'canViewPresentation', 'canComment'],
  gerente: ['canCreatePosts', 'canEditAssignedPosts', 'canEditCalendar', 'canReviewAndSend', 'canConfigClients', 'canViewPresentation', 'canComment'],
  atendimento: ['canReviewAndSend', 'canConfigClients', 'canViewPresentation', 'canComment'],
  designer: ['canCreatePosts', 'canEditAssignedPosts', 'canEditCalendar', 'canConfigClients', 'canViewPresentation'],
  estagiario: ['canEditAssignedPosts', 'canViewPresentation'], analista: ['canViewPresentation'],
  socialmedia: ['canCreatePosts', 'canEditAssignedPosts', 'canEditCalendar', 'canReviewAndSend', 'canConfigClients', 'canViewPresentation', 'canComment'],
};
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
function rateLimited(key: string, limit: number, windowMs: number) {
  const now = Date.now(); const current = rateBuckets.get(key);
  if (!current || current.resetAt <= now) { rateBuckets.set(key, { count: 1, resetAt: now + windowMs }); return false; }
  return ++current.count > limit;
}

function ok(data: any = { success: true }, status = 200) {
  return NextResponse.json(data, { status });
}

function err(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
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
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies.get('cp_session')?.value || null;
  if (!token) return { userUid: null, userRole: null, tenantId: '', isAuthenticated: false, permissions: new Set() };
  const users = await rows('SELECT uid, role, tenant_id FROM users WHERE session_token = ? AND session_expires_at > NOW()', [token]);
  const user = users[0];
  if (!user?.tenant_id) return { userUid: null, userRole: null, tenantId: '', isAuthenticated: false, permissions: new Set() };
  let permissions = ROLE_PERMISSIONS[user.role] || [];
  if (!ROLE_PERMISSIONS[user.role]) {
    const custom = await rows('SELECT permissions FROM custom_roles WHERE id = ? AND tenant_id = ?', [user.role, user.tenant_id]);
    permissions = Object.entries(parseJson(custom[0]?.permissions, {})).filter(([, value]) => value === true).map(([key]) => key as Permission);
  }
  return { userUid: user.uid, userRole: user.role, tenantId: user.tenant_id, isAuthenticated: true, permissions: new Set(permissions) };
}

function isPublic(route: string) {
  if (route === '/health' || route === '/health/db') return true;
  if (route === '/auth/login' || route === '/auth/validate-token') return true;
  if (route.startsWith('/auth/social/login') || route.startsWith('/auth/callback')) return true;
  if (route.startsWith('/public/') || route.startsWith('/review/')) return true;
  return false;
}

function requiredPermission(method: string, route: string): Permission | null {
  if (isPublic(route)) return null;
  if (route === '/users/preferences') return null;
  if (route === '/uploads/media') return 'canCreatePosts';
  if (route.startsWith('/admin/') || route === '/agencies' || route.startsWith('/users') || route.startsWith('/custom-roles') || route.startsWith('/agency/settings')) return 'canManageRoles';
  if (route.startsWith('/analytics/') || route.startsWith('/presentation/')) return 'canViewPresentation';
  if (route.includes('/comments')) return 'canComment';
  if (route.startsWith('/tokens') || route.endsWith('/send-for-review') || route === '/notify-whatsapp') return 'canReviewAndSend';
  if (route.startsWith('/clients') || route.startsWith('/settings') || route.startsWith('/upload-')) return 'canConfigClients';
  if ((route.startsWith('/posts') || route.startsWith('/posts-bulk')) && method !== 'GET') return method === 'POST' ? 'canCreatePosts' : 'canEditCalendar';
  if (route === '/generate-objective') return 'canCreatePosts';
  return null;
}

type GeneratedPostFields = { date?: string; head: string; objective: string; funnelStage: 'topo' | 'meio' | 'fundo'; source: 'leia' | 'rules' };

function ruleGeneratedFields(post: any, index = 0, total = 1): GeneratedPostFields {
  const text = [post.title, post.centralIdea, post.caption, post.subtitle, post.visualBriefing, post.artText, post.cta]
    .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  const lower = text.toLowerCase();
  const conversion = /compr|contrat|or[cç]amento|agend|inscrev|cadastre|link|saiba mais|fale conosco|lead|venda|promo[cç][aã]o/.test(lower);
  const nurture = /como|guia|passo|dica|erro|benef[ií]cio|entenda|aprenda|case|resultado|compar|por que|autoridade/.test(lower);
  const target = total > 1 ? index / Math.max(total, 1) : -1;
  const funnelStage: 'topo' | 'meio' | 'fundo' = conversion ? 'fundo' : nurture ? 'meio' : target >= 0.8 ? 'fundo' : target >= 0.5 ? 'meio' : 'topo';
  const clean = text.replace(/[#*_\`]/g, '').split(/[.!?\n]/)[0]?.trim() || 'Conteúdo estratégico';
  const words = clean.split(/\s+/).slice(0, 11).join(' ');
  const head = words.length > 78 ? `${words.slice(0, 75).trim()}...` : words;
  const objectives = {
    topo: 'Ampliar alcance e gerar reconhecimento de marca junto ao público-alvo.',
    meio: 'Educar o público, fortalecer autoridade e estimular consideração pela solução.',
    fundo: 'Estimular uma ação de conversão com uma proposta clara e relevante.'
  };
  return { date: post.date, head, objective: objectives[funnelStage], funnelStage, source: 'rules' };
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

function tablePayload(data: any, tenantId?: string) {
  const out: Record<string, any> = { ...data };
  for (const key of Object.keys(out)) {
    if (Array.isArray(out[key]) || (out[key] && typeof out[key] === 'object')) out[key] = JSON.stringify(out[key]);
  }
  if (tenantId) out.tenant_id = tenantId;
  return out;
}

function publicClient(client: any) {
  return { ...client, owners: parseJson(client.owners, []), socialLinks: parseJson(client.socialLinks, {}), instagramStats: parseJson(client.instagramStats, {}), config: parseJson(client.config, {}) };
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
    ui_preferences: parseJson(user.ui_preferences, {})
  };
}

let activePdfJobs = 0;
async function renderPdf(url: string) {
  if (activePdfJobs >= 2) throw new Error('PDF_BUSY');
  activePdfJobs += 1;
  const { chromium } = await import('playwright');
  let browser: any;
  try {
    browser = await chromium.launch({ headless: true });
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

async function sendWAMessage(to: string, text: string) {
  if (!to || !text) return;
  const apiKey = process.env.EVOLUTION_API_KEY;
  if (!apiKey || apiKey === 'SUA_API_KEY_AQUI') return;
  const apiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
  const instance = process.env.EVOLUTION_INSTANCE || 'main';
  await axios.post(`${apiUrl}/message/sendText/${instance}`, { number: to, text }, { headers: { apikey: apiKey, 'Content-Type': 'application/json' } });
}

async function uploadBase64(data: any, audio = false, tenantId = 'default_agency') {
  const { base64, subfolder = audio ? 'audio' : 'profiles', clientName = 'Geral', postDate, designerName } = data;
  if (!base64) throw new Error(audio ? 'Nenhum áudio enviado' : 'Nenhuma imagem enviada');
  const match = String(base64).match(/^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\r\n]+)$/i);
  if (!match) throw new Error('Arquivo base64 inválido.');
  const allowed = audio
    ? new Map([['audio/mpeg', 'mp3'], ['audio/wav', 'wav'], ['audio/ogg', 'ogg'], ['audio/webm', 'webm']])
    : new Map([['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp'], ['image/gif', 'gif']]);
  const ext = allowed.get(match[1].toLowerCase());
  if (!ext) throw new Error('Tipo de arquivo não permitido.');
  const payload = match[2];
  const buffer = Buffer.from(payload, 'base64');
  if (!buffer.length || buffer.length > (audio ? 25 : 15) * 1024 * 1024) throw new Error('Arquivo vazio ou acima do limite permitido.');
  const signatureOk = ext === 'jpg' ? buffer[0] === 0xff && buffer[1] === 0xd8
    : ext === 'png' ? buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : ext === 'gif' ? buffer.subarray(0, 3).toString() === 'GIF'
    : ext === 'webp' ? buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP'
    : ext === 'wav' ? buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WAVE'
    : ext === 'ogg' ? buffer.subarray(0, 4).toString() === 'OggS'
    : ext === 'webm' ? buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
    : buffer.subarray(0, 3).toString() === 'ID3' || buffer[0] === 0xff;
  if (!signatureOk) throw new Error('Conteúdo não corresponde ao tipo declarado.');
  const tenantFolder = String(tenantId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'default_agency';
  const uploadsRoot = path.join(process.cwd(), 'server', 'uploads', tenantFolder);
  let dir: string;
  let finalFileName: string;
  if (!audio && subfolder === 'posts' && postDate) {
    const clientClean = String(clientName).trim().replace(/[\\/:*?"<>|]/g, '');
    const month = String(postDate).substring(0, 7);
    const designerClean = String(designerName || 'Designer').trim().replace(/[\\/:*?"<>|]/g, '');
    dir = path.join(uploadsRoot, 'posts', clientClean, month);
    finalFileName = `${clientClean} - ${postDate} - ${designerClean}.${ext}`;
    await fsp.mkdir(dir, { recursive: true });
    await fsp.writeFile(path.join(dir, finalFileName), buffer, { flag: 'wx' });
    return `/uploads/${tenantFolder}/posts/${encodeURIComponent(clientClean)}/${month}/${encodeURIComponent(finalFileName)}`;
  }
  const folderAliases: Record<string, string> = { audio: 'audio', profiles: 'profiles', avatars: 'profiles', logos: 'client-logos', branding: 'branding' };
  const safeSubfolder = folderAliases[String(subfolder)] || (audio ? 'audio' : 'profiles');
  dir = path.join(uploadsRoot, safeSubfolder);
  finalFileName = `${randomBytes(16).toString('hex')}.${ext}`;
  await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(path.join(dir, finalFileName), buffer, { flag: 'wx' });
  return `/uploads/${tenantFolder}/${safeSubfolder}/${finalFileName}`;
}

export async function handleApi(method: string, route: string, req: NextRequest, params: Params = {}) {
  try {
    const ctx = await getContext(req);
    const permission = requiredPermission(method, route);
    if (permission && !ctx.permissions.has(permission)) return err('Permissão insuficiente.', 403);
    if (!isPublic(route) && !ctx.isAuthenticated) return err('Acesso não autorizado. Faça login para continuar.', 401);
    const url = new URL(req.url);

    if (route === '/health' && method === 'GET') return ok({ ok: true });

    if (route === '/health/db' && method === 'GET') {
      const result = await rows('SELECT 1 AS ok');
      return ok({ ok: true, db: 'connected', result: result[0] });
    }

    if (route === '/auth/login' && method === 'POST') {
      const loginIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
      if (rateLimited(`login:${loginIp}`, 10, 15 * 60_000)) return err('Muitas tentativas. Aguarde antes de tentar novamente.', 429);
      const data = await body(req);
      const email = data.email || data.username;
      const password = data.password;
      const found = await rows('SELECT * FROM users WHERE email = ? OR displayName = ?', [email, email]);
      const user = found[0];
      if (!user || !user.password || !(await bcrypt.compare(password, user.password))) return err('Credenciais inválidas.', 401);
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
      const response = ok({ success: true, user: await enrichUser({ ...user, session_token: sessionToken }), session_token: sessionToken });
      response.cookies.set('cp_session', sessionToken, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false', path: '/', maxAge: sessionHours * 60 * 60 });
      return response;
    }

    if (route === '/auth/validate-token' && method === 'POST') {
      const data = await body(req);
      const suppliedToken = data.token || req.cookies.get('cp_session')?.value;
      const found = await rows('SELECT * FROM users WHERE session_token = ? AND session_expires_at > NOW()', [suppliedToken]);
      const user = found[0];
      if (!user) return err('Token inválido.', 401);
      delete user.password;
      return ok({ success: true, user: await enrichUser(user) });
    }

    if (route === '/auth/activity' && method === 'POST') {
      if (!ctx.userUid) return err('Não autenticado.', 401);
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
      return ok(result.map(publicClient));
    }

    if (route === '/clients' && method === 'POST') {
      const data = tablePayload(await body(req), ctx.tenantId);
      await exec('INSERT INTO clients SET ? ON DUPLICATE KEY UPDATE ?', [data, data]);
      return ok({ id: data.id });
    }

    if (route === '/clients/[id]' && method === 'GET') {
      const result = await rows('SELECT * FROM clients WHERE id = ? AND tenant_id = ?', [params.id, ctx.tenantId]);
      return result[0] ? ok(publicClient(result[0])) : err('Cliente não encontrado.', 404);
    }

    if (route === '/clients/[id]' && method === 'DELETE') {
      await exec('DELETE FROM approval_tokens WHERE clientId = ? AND tenant_id = ?', [params.id, ctx.tenantId]);
      await exec('DELETE FROM posts WHERE clientId = ? AND tenant_id = ?', [params.id, ctx.tenantId]);
      await exec('DELETE FROM clients WHERE id = ? AND tenant_id = ?', [params.id, ctx.tenantId]);
      return ok();
    }

    if (route === '/clients/[id]/meta-account' && method === 'POST') {
      const data = await body(req);
      await exec('UPDATE clients SET meta_access_token = ?, meta_account_id = ? WHERE id = ? AND tenant_id = ?', [data.token, data.igAccountId || data.pageId || null, params.id, ctx.tenantId]);
      return ok();
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
      const filteredData: Record<string, any> = {};
      const POST_COLUMNS = [
        'id', 'clientId', 'date', 'type', 'head', 'subhead', 'subtitle', 'objective', 
        'channel', 'title', 'centralIdea', 'caption', 'artHeadline', 'artText', 
        'cta', 'hashtags', 'visualBriefing', 'internalNotes', 'theme', 'script', 
        'feedImages', 'funnelStage', 'status', 'tenant_id', 'deadline', 'assigneeId', 'videoUrl'
      ];
      for (const key of POST_COLUMNS) {
        if (bodyData[key] !== undefined) {
          filteredData[key] = bodyData[key];
        }
      }
      filteredData.date = assertPostDate(filteredData.date);
      if (!filteredData.clientId) return err('Cliente obrigatorio.', 400);
      if (!(await tenantOwnsClient(filteredData.clientId, ctx.tenantId))) return err('Cliente não pertence à sua agência.', 403);
      const data = tablePayload(filteredData, ctx.tenantId);
      const result = await exec('INSERT INTO posts SET ? ON DUPLICATE KEY UPDATE ?', [data, data]);
      return ok({ id: data.id || result.insertId, date: data.date });
    }

    if (route === '/posts/[clientId]/[date]' && method === 'DELETE') {
      await exec('DELETE FROM posts WHERE clientId = ? AND date = ? AND tenant_id = ?', [params.clientId, assertPostDate(params.date), ctx.tenantId]);
      return ok();
    }

    if (route === '/posts-bulk/[clientId]' && method === 'POST') {
      const data = await body(req);
      if (Array.isArray(data.dates) && data.dates.length) await exec('DELETE FROM posts WHERE clientId = ? AND date IN (?) AND tenant_id = ?', [params.clientId, data.dates.map(assertPostDate), ctx.tenantId]);
      return ok();
    }

    if (route === '/posts/[postId]/comments' && method === 'GET') return ok(await rows('SELECT * FROM post_comments WHERE postId = ? ORDER BY createdAt ASC', [params.postId]));
    if (route === '/posts/[postId]/comments' && method === 'POST') {
      const data = await body(req);
      const author = ctx.userUid ? await rows('SELECT displayName, role FROM users WHERE uid = ?', [ctx.userUid]) : [];
      await exec('INSERT INTO post_comments (postId, authorName, authorRole, content) VALUES (?, ?, ?, ?)', [params.postId, author[0]?.displayName || 'Equipe', author[0]?.role || 'interno', data.content]);
      return ok();
    }

    if (route === '/tokens' && method === 'POST') {
      const payload = await body(req);
      payload.expiresAt = toMysqlDateTime(payload.expiresAt);
      if (!payload.expiresAt) return err('Expiração do token inválida.', 400);
      const data = tablePayload(payload, ctx.tenantId);
      await exec('REPLACE INTO approval_tokens SET ?', [data]);
      return ok({ id: data.id });
    }
    if (route === '/tokens/[id]' && method === 'GET') {
      const result = await rows('SELECT * FROM approval_tokens WHERE id = ? AND tenant_id = ?', [params.id, ctx.tenantId]);
      return result[0] ? ok(result[0]) : err('Token não encontrado.', 404);
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
        return err('Ação de revisão inválida.', 400);
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
      if (!String(data.content || '').trim()) return err('Comentário vazio.', 400);
      await exec('INSERT INTO post_comments (postId, authorName, authorRole, content) VALUES (?, ?, ?, ?)', [params.postId, data.authorName || 'Cliente', 'cliente', data.content]);
      return ok();
    }
    if (route === '/public/review/[token]/send-whatsapp' && method === 'POST') {
      const tokenData = await validateReviewToken(params.token);
      if (isReviewDataError(tokenData)) return err(tokenData.error, tokenData.status);
      const client = (await rows('SELECT whatsappGroupId FROM clients WHERE id = ?', [tokenData.clientId]))[0];
      if (!client?.whatsappGroupId) return err('Grupo de WhatsApp não configurado para este cliente.', 400);
      await sendWAMessage(client.whatsappGroupId, `${url.origin}/review/${params.token}`);
      return ok();
    }

    if (route === '/review/[token]/export-pdf' && method === 'GET') {
      const requestIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
      if (rateLimited(`pdf:${requestIp}`, 5, 60_000)) return err('Limite de geração de PDF excedido.', 429);
      const data = await getReviewData(params.token);
      if (isReviewDataError(data)) return err(data.error, data.status);
      const internalOrigin = process.env.INTERNAL_APP_URL || `http://127.0.0.1:${process.env.PORT || 3006}`;
      const pdf = await renderPdf(`${internalOrigin}/review/${encodeURIComponent(params.token)}/export`);
      return new Response(pdf, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="planejamento.pdf"' } });
    }
    if (route === '/presentation/[clientId]/[month]/export-pdf' && method === 'GET') {
      if (!(await tenantOwnsClient(params.clientId, ctx.tenantId))) return err('Cliente inválido.', 403);
      if (rateLimited(`pdf:${ctx.userUid}`, 10, 60_000)) return err('Limite de geração de PDF excedido.', 429);
      const data = await getPresentationData(params.clientId, params.month);
      if (isReviewDataError(data)) return err(data.error, data.status);
      const internalOrigin = process.env.INTERNAL_APP_URL || `http://127.0.0.1:${process.env.PORT || 3006}`;
      const pdf = await renderPdf(`${internalOrigin}/presentation/${encodeURIComponent(params.clientId)}/${encodeURIComponent(params.month)}/export`);
      return new Response(pdf, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="planejamento.pdf"' } });
    }

    if (route === '/users' && method === 'GET') return ok(await rows('SELECT uid, email, displayName, photoURL, role, tenant_id, whatsapp, clientId, birthday FROM users WHERE tenant_id = ?', [ctx.tenantId]));
    if (route === '/users/[uid]' && method === 'GET') {
      const result = await rows('SELECT uid, email, displayName, photoURL, role, tenant_id, whatsapp, clientId, birthday FROM users WHERE uid = ? AND tenant_id = ?', [params.uid, ctx.tenantId]);
      return result[0] ? ok(result[0]) : err('Usuário não encontrado.', 404);
    }
    if (route === '/users' && method === 'POST') {
      const data = tablePayload(await body(req), ctx.tenantId);
      if (data.password) data.password = await bcrypt.hash(data.password, 10);
      await exec('INSERT INTO users SET ? ON DUPLICATE KEY UPDATE ?', [data, data]);
      return ok();
    }
    if (route === '/users/[uid]' && method === 'DELETE') { await exec('DELETE FROM users WHERE uid = ? AND tenant_id = ?', [params.uid, ctx.tenantId]); return ok(); }
    if (route === '/users/change-password' && method === 'POST') {
      const data = await body(req);
      if (!ctx.userUid) return err('Não autenticado.', 401);
      const found = await rows('SELECT password FROM users WHERE uid = ?', [ctx.userUid]);
      if (!found[0] || !(await bcrypt.compare(data.currentPassword, found[0].password))) return err('Senha atual inválida.', 401);
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
      const allowedKeys = new Set(['theme', 'density', 'language', 'notifications', 'widgetLayouts', 'companion', 'sidebarPinned']);
      const current = parseJson((await rows('SELECT ui_preferences FROM users WHERE uid = ? AND tenant_id = ? LIMIT 1', [ctx.userUid, ctx.tenantId]))[0]?.ui_preferences, {});
      for (const [key, value] of Object.entries(incoming || {})) if (allowedKeys.has(key)) current[key] = value;
      const serialized = JSON.stringify(current);
      if (serialized.length > 100_000) return err('Preferências acima do limite.', 413);
      await exec('UPDATE users SET ui_preferences = ? WHERE uid = ? AND tenant_id = ?', [serialized, ctx.userUid, ctx.tenantId]);
      return ok(current);
    }
    if (route === '/agency/settings' && method === 'POST') { const data = tablePayload({ ...(await body(req)), id: ctx.tenantId }); await exec('INSERT INTO agencies SET ? ON DUPLICATE KEY UPDATE ?', [data, data]); return ok(); }
    if (route === '/agency/settings/[id]' && method === 'GET') { if (params.id !== ctx.tenantId) return err('Agência inválida.', 403); const result = await rows('SELECT * FROM agencies WHERE id = ?', [ctx.tenantId]); return ok(result[0] || {}); }
    if (route === '/agencies' && method === 'GET') return ok(await rows('SELECT * FROM agencies WHERE id = ?', [ctx.tenantId]));

    if (route === '/upload-base64' && method === 'POST') return ok({ url: await uploadBase64(await body(req), false, ctx.tenantId) });
    if (route === '/upload-audio' && method === 'POST') return ok({ url: await uploadBase64(await body(req), true, ctx.tenantId) });
    if (route === '/uploads/media' && method === 'PUT') {
      if (!req.body) return err('Arquivo obrigatório.', 400);
      if (rateLimited(`media:${ctx.userUid}`, 20, 60_000)) return err('Limite de uploads excedido.', 429);
      const clientId = String(req.headers.get('x-client-id') || '');
      if (!clientId || !(await tenantOwnsClient(clientId, ctx.tenantId))) return err('Cliente inválido.', 403);
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
      return ok(result);
    }

    if (route === '/holidays/[year]' && method === 'GET') {
      const r = await axios.get(`https://brasilapi.com.br/api/feriados/v1/${params.year}`).catch(() => ({ data: [] }));
      return ok(r.data);
    }
    if (route === '/geolocate' && method === 'GET') {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';
      return ok({ ip });
    }

    if (route === '/analytics/[clientId]' && method === 'GET') { if (!(await tenantOwnsClient(params.clientId, ctx.tenantId))) return err('Cliente inválido.', 403); return ok(await rows('SELECT * FROM client_analytics WHERE clientId = ? ORDER BY date ASC', [params.clientId])); }
    if (route === '/analytics/[clientId]/posts' && method === 'GET') return ok(await rows('SELECT p.*, pa.* FROM posts p LEFT JOIN post_analytics pa ON p.id = pa.postId WHERE p.clientId = ? AND p.tenant_id = ? ORDER BY p.date ASC', [params.clientId, ctx.tenantId]));
    if (route === '/analytics/[clientId]/sync' && method === 'POST') return ok({ success: true, synced: [], errors: [{ message: 'Sync externo ainda não migrado para Route Handler.' }] });
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
      if (!client) return err('Cliente não encontrado.', 404);
      const requestData = await body(req);
      const month = /^\d{4}-\d{2}$/.test(requestData.month || '') ? requestData.month : new Date().toISOString().slice(0, 7);
      const reviewToken = randomBytes(32).toString('hex');
      await exec('INSERT INTO approval_tokens (id, clientId, month, status, expiresAt, createdAt, tenant_id) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY), ?, ?)', [reviewToken, params.id, month, 'pending', Date.now(), ctx.tenantId]);
      const reviewUrl = `${process.env.APP_URL || url.origin}/review/${reviewToken}`;
      if (client.whatsappGroupId) await sendWAMessage(client.whatsappGroupId, `Planejamento disponível: ${reviewUrl}`);
      return ok({ token: reviewToken, url: reviewUrl });
    }
    if (route === '/meta/sync/[clientId]' && method === 'POST') return err('Sync Meta ainda não migrado para Route Handler.', 501);

    if (route === '/leia/chat' && method === 'POST') {
      const data = await body(req);
      const message = String(data.message || '').trim().slice(0, 8000);
      if (!message) return err('Mensagem obrigatória.', 400);
      if (rateLimited(`leia:${ctx.userUid}`, 30, 60_000)) return err('A LeIA recebeu muitas solicitações. Aguarde um instante.', 429);

      let clientContext: Record<string, unknown> | null = null;
      const clientId = String(data.clientId || '');
      if (clientId) {
        if (!(await tenantOwnsClient(clientId, ctx.tenantId))) return err('Cliente não encontrado.', 404);
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
              content: `Você é a LeIA, assistente interna de uma agência de social media e marketing digital. Seu nome é um trocadilho com a colaboradora Leia, conhecida por resolver tudo. Responda em português do Brasil, de forma prática, estratégica e profissional. Ajude com ideias, calendários, legendas, briefings, funil, campanhas e revisão de conteúdo. Use o contexto do cliente sem inventar dados. Contexto: ${JSON.stringify(clientContext || {})}`
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
        if (error?.message === 'LEIA_NOT_CONFIGURED') return err('LeIA não configurada.', 503);
        return err('A LeIA não conseguiu responder agora.', 502);
      }
    }
    if (route === '/generate-objective' && method === 'POST') {
      const data = await body(req);
      const clientId = String(data.clientId || '');
      if (!clientId || !(await tenantOwnsClient(clientId, ctx.tenantId))) return err('Cliente não encontrado.', 404);
      const incoming = Array.isArray(data.posts) ? data.posts : [data.post || data];
      const posts = incoming.slice(0, 100).map((post: any) => ({
        date: String(post.date || ''), type: String(post.type || ''), channel: String(post.channel || ''),
        title: String(post.title || ''), centralIdea: String(post.centralIdea || ''), caption: String(post.caption || post.subtitle || ''),
        visualBriefing: String(post.visualBriefing || post.artText || ''), cta: String(post.cta || ''),
        head: String(post.head || post.artHeadline || ''), objective: String(post.objective || ''), funnelStage: String(post.funnelStage || '')
      }));
      if (!posts.length) return err('Nenhuma postagem informada.', 400);
      const fallbacks = posts.map((post: any, index: number) => ruleGeneratedFields(post, index, posts.length));
      if (!process.env.GROQ_API_KEY) return ok({ results: fallbacks, source: 'rules' });
      const clients = await rows('SELECT name, segment, voiceTone, targetAudience, contentColumns, brandNotes FROM clients WHERE id = ? AND tenant_id = ? LIMIT 1', [clientId, ctx.tenantId]);
      const client = clients[0] || {};
      const generationInputs = posts.map(({ head: _head, objective: _objective, funnelStage: _funnelStage, ...post }: any) => post);
      const prompt = `Você é estrategista de conteúdo. Gere exatamente um objeto por postagem, em JSON válido, sem markdown, no formato {"results":[{"date":"YYYY-MM-DD","head":"...","objective":"...","funnelStage":"topo|meio|fundo"}]}.
Regras: crie campos novos com base somente no conteúdo e na estratégia; head curto, específico e utilizável na arte (máximo 78 caracteres); objetivo em uma frase; classifique o funil pelo conteúdo; no lote distribua de forma estratégica entre topo, meio e fundo e nunca repita títulos. Preserve a ordem e a date recebida.
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
                      required: ['date', 'head', 'objective', 'funnelStage'],
                      properties: {
                        date: { type: 'string' },
                        head: { type: 'string' },
                        objective: { type: 'string' },
                        funnelStage: { type: 'string', enum: ['topo', 'meio', 'fundo'] }
                      }
                    }
                  }
                }
              }
            }
          },
          messages: [
            { role: 'system', content: 'Você é a LeIA, estrategista de conteúdo para redes sociais. Responda somente no JSON solicitado, em português do Brasil.' },
            { role: 'user', content: prompt }
          ]
        });
        const generated = extractGeneratedJson(content);
        if (!generated || generated.length !== posts.length) return ok({ results: fallbacks, source: 'rules' });
        const results = generated.map((item: any, index: number) => {
          const fallback = fallbacks[index];
          const stage = ['topo', 'meio', 'fundo'].includes(item?.funnelStage) ? item.funnelStage : fallback.funnelStage;
          return {
            date: posts[index].date, head: String(item?.head || fallback.head).trim().slice(0, 78),
            objective: String(item?.objective || fallback.objective).trim().slice(0, 240), funnelStage: stage, source: 'leia'
          };
        });
        return ok({ results, source: 'leia' });
      } catch {
        return ok({ results: fallbacks, source: 'rules' });
      }
    }

    if (route.startsWith('/auth/social/login') && method === 'GET') return err('OAuth social ainda não migrado para Route Handler.', 501);
    if (route.startsWith('/auth/callback') && method === 'GET') return err('OAuth social ainda não migrado para Route Handler.', 501);

    return err(`Endpoint não migrado: ${method} ${route}`, 404);
  } catch (e: any) {
    console.error(e);
    if (e?.message === 'PDF_BUSY') return err('Serviço de PDF ocupado. Tente novamente em instantes.', 503);
    return err('Erro interno.', 500);
  }
}

