import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getDbPool, rows, exec } from './db';
import { encryptSecret } from './secret-box';

type Provider = 'facebook' | 'instagram';
type StateData = { state: string; provider: Provider; clientId: string; userUid: string; returnOrigin: string; expiresAt: number };
const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN || process.env.APP_URL || 'http://localhost:3006';

const env = (name: string, fallback?: string) => process.env[name] || (fallback ? process.env[fallback] : '') || '';
const cookieName = (provider: Provider) => `cp_oauth_${provider}`;
const graphVersion = () => env('META_GRAPH_API_VERSION', 'META_GRAPH_VERSION') || 'v22.0';
const redirectUri = (provider: Provider) => env(provider === 'facebook' ? 'META_FACEBOOK_REDIRECT_URI' : 'META_INSTAGRAM_REDIRECT_URI') || `${PUBLIC_ORIGIN}/api/integrations/meta/${provider}/callback`;
const facebookAppId = () => env('META_FACEBOOK_APP_ID') || env('META_APP_ID') || env('META_CLIENT_ID');
const facebookAppSecret = () => env('META_FACEBOOK_APP_SECRET') || env('META_APP_SECRET') || env('META_CLIENT_SECRET');
const signingKey = (provider: Provider) => env('OAUTH_STATE_SECRET') || env('TOKEN_ENCRYPTION_KEY') || (provider === 'facebook' ? facebookAppSecret() : env('META_INSTAGRAM_APP_SECRET'));
const missingResponse = (provider: Provider, missing: string[]) => NextResponse.json(
  process.env.NODE_ENV === 'production' ? { error: `${provider === 'facebook' ? 'Facebook' : 'Instagram'} OAuth não configurado.` } : { error: `${provider === 'facebook' ? 'Facebook' : 'Instagram'} OAuth não configurado.`, missing },
  { status: 503 }
);



async function ensureConnectionsTable() {
  await exec(`CREATE TABLE IF NOT EXISTS oauth_integration_states (
    state_hash VARCHAR(64) PRIMARY KEY, provider VARCHAR(32) NOT NULL,
    user_uid VARCHAR(191) NOT NULL, client_id VARCHAR(191) NOT NULL, return_origin VARCHAR(500) NOT NULL,
    expires_at DATETIME NOT NULL, used_at DATETIME NULL, INDEX idx_oauth_integration_expiry (expires_at)
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS social_connections (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    client_id VARCHAR(191) NOT NULL,
    provider VARCHAR(32) NOT NULL, external_account_id VARCHAR(191) NOT NULL,
    account_name VARCHAR(255) NULL, access_token_encrypted LONGTEXT NOT NULL,
    token_expires_at DATETIME NULL, scopes TEXT NULL, page_id VARCHAR(191) NULL,
    linked_account_id VARCHAR(191) NULL, metadata_json LONGTEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_social_connection (provider, external_account_id),
    INDEX idx_social_connection_client (client_id, provider)
  )`);
  try { await exec('ALTER TABLE oauth_integration_states ADD COLUMN return_origin VARCHAR(500) NOT NULL DEFAULT \'http://localhost:3006\' AFTER client_id'); } catch {}
}

async function consumeState(provider: Provider, stateValue: string, cookieValue?: string) {
  await ensureConnectionsTable();
  const hash = createHash('sha256').update(stateValue).digest('hex');
  const stored = (await rows('SELECT * FROM oauth_integration_states WHERE state_hash=? AND provider=? AND used_at IS NULL AND expires_at>NOW() LIMIT 1', [hash, provider]))[0];
  if (!stored) return null;
  if (cookieValue && !decodeState(cookieValue, stateValue, provider)) return null;
  const [result]: any = await getDbPool().query('UPDATE oauth_integration_states SET used_at=NOW() WHERE state_hash=? AND used_at IS NULL', [hash]);
  if (!result?.affectedRows) return null;
  return { state: stateValue, provider, clientId: stored.client_id, userUid: stored.user_uid, returnOrigin: stored.return_origin, expiresAt: new Date(stored.expires_at).getTime() } as StateData;
}

function encodeState(data: StateData) {
  const secret = signingKey(data.provider);
  if (!secret) throw new Error('OAUTH_STATE_SECRET_NOT_CONFIGURED');
  const body = Buffer.from(JSON.stringify(data)).toString('base64url');
  const signature = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function decodeState(value: string | undefined, expectedState: string, provider: Provider): StateData | null {
  if (!value) return null;
  const [body, signature] = value.split('.');
  if (!body || !signature) return null;
  const expected = createHmac('sha256', signingKey(provider)).update(body).digest();
  const supplied = Buffer.from(signature, 'base64url');
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as StateData;
  return data.provider === provider && data.state === expectedState && data.expiresAt > Date.now() ? data : null;
}

async function session(req: NextRequest) {
  const token = req.cookies.get('cp_session')?.value;
  if (!token) return null;
  return (await rows('SELECT uid FROM users WHERE session_token = ? AND session_expires_at > NOW() LIMIT 1', [token]))[0] || null;
}

function cookieOptions(maxAge: number) {
  return { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true', path: '/', maxAge };
}

async function jsonFetch(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(25_000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) throw new Error(data?.error?.message || 'OAUTH_PROVIDER_ERROR');
  return data;
}

async function upsertConnection(input: { state: StateData; provider: Provider; externalId: string; name?: string; token: string; expiresIn?: number; scopes?: string[]; pageId?: string | null; linkedId?: string | null; metadata?: any }) {
  await ensureConnectionsTable();
  const expiry = input.expiresIn ? new Date(Date.now() + input.expiresIn * 1000) : null;
  await exec(`INSERT INTO social_connections (client_id, provider, external_account_id, account_name, access_token_encrypted, token_expires_at, scopes, page_id, linked_account_id, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE client_id=VALUES(client_id), account_name=VALUES(account_name), access_token_encrypted=VALUES(access_token_encrypted), token_expires_at=VALUES(token_expires_at), scopes=VALUES(scopes), page_id=VALUES(page_id), linked_account_id=VALUES(linked_account_id), metadata_json=VALUES(metadata_json), updated_at=NOW()`,
    [input.state.clientId, input.provider, input.externalId, input.name || null, encryptSecret(input.token), expiry, JSON.stringify(input.scopes || []), input.pageId || null, input.linkedId || null, JSON.stringify(input.metadata || {})]);
}

function resultResponse(req: NextRequest, provider: Provider, status: 'success' | 'cancelled' | 'error', clientId: string, message?: string, returnOrigin?: string, statusCode = 200) {
  const appOrigin = returnOrigin || process.env.FRONTEND_URL || process.env.APP_URL || new URL(req.url).origin;
  const target = new URL(appOrigin);
  target.searchParams.set('screen', 'client_setup'); target.searchParams.set('tab', 'integrations');
  target.searchParams.set('clientId', clientId); target.searchParams.set('oauth_provider', provider); target.searchParams.set('oauth_status', status);
  if (message) target.searchParams.set('oauth_message', message.slice(0, 120));
  const safeTarget = target.toString().replace(/</g, '\\u003c');
  const payload = JSON.stringify({ provider, status, clientId, message: message || '' }).replace(/</g, '\\u003c');
  const response = new NextResponse(`<!doctype html><meta charset="utf-8"><script>try{window.opener&&window.opener.postMessage('oauth-result:'+${JSON.stringify(payload)},${JSON.stringify(appOrigin)})}catch(e){}setTimeout(()=>location.replace(${JSON.stringify(safeTarget)}),250)</script>`, { status: statusCode, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  response.cookies.set(cookieName(provider), '', cookieOptions(0));
  return response;
}

export async function startOAuth(req: NextRequest, provider: Provider) {
  const user = await session(req);
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  const clientId = new URL(req.url).searchParams.get('clientId') || '';
  if (!(await rows('SELECT 1 FROM clients WHERE id = ? LIMIT 1', [clientId]))[0]) return NextResponse.json({ error: 'Cliente inválido.' }, { status: 403 });
  const state = randomBytes(32).toString('base64url');
  const requestedOrigin = new URL(req.url).origin;
  const allowedOrigins = new Set(['http://localhost:3006', PUBLIC_ORIGIN, process.env.APP_URL, process.env.FRONTEND_URL].filter(Boolean));
  const returnOrigin = allowedOrigins.has(requestedOrigin) ? requestedOrigin : (process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3006');
  const stateData: StateData = { state, provider, clientId, userUid: user.uid, returnOrigin, expiresAt: Date.now() + 10 * 60_000 };
  await ensureConnectionsTable();
  await exec('DELETE FROM oauth_integration_states WHERE expires_at < NOW() OR used_at IS NOT NULL');
  await exec('INSERT INTO oauth_integration_states (state_hash, provider, user_uid, client_id, return_origin, expires_at) VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))', [createHash('sha256').update(state).digest('hex'), provider, user.uid, clientId, returnOrigin]);
  let authorization: URL;
  if (provider === 'facebook') {
    const appId = facebookAppId(); const appSecret = facebookAppSecret(); const configId = env('META_FACEBOOK_CONFIG_ID');
    const missing = [...(!appId ? ['META_FACEBOOK_APP_ID ou META_APP_ID'] : []), ...(!appSecret ? ['META_FACEBOOK_APP_SECRET ou META_APP_SECRET'] : [])];
    if (missing.length) return missingResponse(provider, missing);
    authorization = new URL(`https://www.facebook.com/${graphVersion()}/dialog/oauth`);
    authorization.searchParams.set('client_id', appId);
    if (configId) { authorization.searchParams.set('config_id', configId); authorization.searchParams.set('override_default_response_type', 'true'); }
    else authorization.searchParams.set('scope', 'pages_show_list,pages_read_engagement,instagram_basic,instagram_manage_insights');
    authorization.searchParams.set('redirect_uri', redirectUri(provider)); authorization.searchParams.set('response_type', 'code');
    authorization.searchParams.set('state', state);
  } else {
    const appId = env('META_INSTAGRAM_APP_ID'); const appSecret = env('META_INSTAGRAM_APP_SECRET');
    const missing = [...(!appId ? ['META_INSTAGRAM_APP_ID'] : []), ...(!appSecret ? ['META_INSTAGRAM_APP_SECRET'] : []), ...(!env('META_INSTAGRAM_REDIRECT_URI') ? ['META_INSTAGRAM_REDIRECT_URI'] : [])];
    if (missing.length) return missingResponse(provider, missing);
    authorization = new URL('https://www.instagram.com/oauth/authorize');
    authorization.searchParams.set('client_id', appId); authorization.searchParams.set('redirect_uri', redirectUri(provider));
    authorization.searchParams.set('response_type', 'code'); authorization.searchParams.set('state', state);
    authorization.searchParams.set('scope', process.env.META_INSTAGRAM_SCOPES || 'instagram_business_basic');
    authorization.searchParams.set('enable_fb_login', '0'); authorization.searchParams.set('force_authentication', '1');
  }
  const response = NextResponse.redirect(authorization);
  response.cookies.set(cookieName(provider), encodeState(stateData), cookieOptions(10 * 60));
  return response;
}

export async function finishOAuth(req: NextRequest, provider: Provider) {
  const url = new URL(req.url); const stateValue = url.searchParams.get('state') || '';
  let state: StateData | null = null;
  try { state = await consumeState(provider, stateValue, req.cookies.get(cookieName(provider))?.value); } catch {}
  if (!state) return resultResponse(req, provider, 'error', '', 'State inválido ou expirado.', undefined, 400);
  if (url.searchParams.get('error')) return resultResponse(req, provider, 'cancelled', state.clientId, 'Autorização cancelada.', state.returnOrigin);
  const code = url.searchParams.get('code');
  if (!code) return resultResponse(req, provider, 'error', state.clientId, 'Código de autorização ausente.', state.returnOrigin);
  try {
    if (provider === 'facebook') {
      const appId = facebookAppId(); const appSecret = facebookAppSecret();
      const tokenUrl = new URL(`https://graph.facebook.com/${graphVersion()}/oauth/access_token`);
      tokenUrl.searchParams.set('client_id', appId); tokenUrl.searchParams.set('client_secret', appSecret); tokenUrl.searchParams.set('redirect_uri', redirectUri(provider)); tokenUrl.searchParams.set('code', code);
      const tokenData = await jsonFetch(tokenUrl.toString());
      const pages = await jsonFetch(`https://graph.facebook.com/${graphVersion()}/me/accounts?fields=id,name,access_token,tasks,instagram_business_account{id,username,name}&limit=100&access_token=${encodeURIComponent(tokenData.access_token)}`);
      for (const page of pages.data || []) await upsertConnection({ state, provider, externalId: String(page.id), name: page.name, token: page.access_token || tokenData.access_token, expiresIn: tokenData.expires_in, scopes: page.tasks || [], pageId: page.id, linkedId: page.instagram_business_account?.id, metadata: { instagramUsername: page.instagram_business_account?.username || null } });
      const first = pages.data?.[0];
      if (first) await exec(`UPDATE clients SET meta_access_token=?, facebook_page_id=?, meta_account_id=?, meta_page_name=?, meta_ig_username=?, meta_connection_status='connected' WHERE id=?`, [encryptSecret(first.access_token || tokenData.access_token), first.id, first.instagram_business_account?.id || null, first.name || null, first.instagram_business_account?.username || null, state.clientId]);
    } else {
      const form = new URLSearchParams({ client_id: env('META_INSTAGRAM_APP_ID'), client_secret: env('META_INSTAGRAM_APP_SECRET'), grant_type: 'authorization_code', redirect_uri: redirectUri(provider), code });
      const tokenData = await jsonFetch('https://api.instagram.com/oauth/access_token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form });
      const profile = await jsonFetch(`https://graph.instagram.com/me?fields=user_id,username,name,account_type,media_count&access_token=${encodeURIComponent(tokenData.access_token)}`);
      const externalId = String(profile.user_id || profile.id || tokenData.user_id);
      await upsertConnection({ state, provider, externalId, name: profile.username || profile.name, token: tokenData.access_token, expiresIn: tokenData.expires_in, scopes: (process.env.META_INSTAGRAM_SCOPES || 'instagram_business_basic').split(','), linkedId: externalId, metadata: { accountType: profile.account_type, mediaCount: profile.media_count } });
      await exec(`UPDATE clients SET meta_access_token=?, meta_account_id=?, meta_ig_username=?, meta_connection_status='connected' WHERE id=?`, [encryptSecret(tokenData.access_token), externalId, profile.username || null, state.clientId]);
    }
    return resultResponse(req, provider, 'success', state.clientId, undefined, state.returnOrigin);
  } catch { return resultResponse(req, provider, 'error', state.clientId, 'Não foi possível concluir a conexão.', state.returnOrigin); }
}
