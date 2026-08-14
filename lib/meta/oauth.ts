import { createHash, randomBytes } from "crypto";
import { exec, rows } from "../db";
import { decryptSecret, encryptSecret } from "../secret-box";

const apiVersion = () => process.env.META_GRAPH_VERSION || "v22.0";
const graphUrl = (path: string) => `https://graph.facebook.com/${apiVersion()}/${path.replace(/^\//, "")}`;

async function ensureOAuthTables() {
  await exec(`CREATE TABLE IF NOT EXISTS meta_oauth_states (state_hash VARCHAR(64) PRIMARY KEY, user_uid VARCHAR(191) NOT NULL, client_id VARCHAR(191) NOT NULL, expires_at DATETIME NOT NULL, used_at DATETIME NULL, INDEX idx_meta_oauth_state_expiry (expires_at))`);
  await exec(`CREATE TABLE IF NOT EXISTS meta_oauth_connections (id VARCHAR(64) PRIMARY KEY, user_uid VARCHAR(191) NOT NULL, client_id VARCHAR(191) NOT NULL, encrypted_accounts LONGTEXT NULL, expires_at DATETIME NOT NULL, used_at DATETIME NULL, INDEX idx_meta_oauth_connection_expiry (expires_at))`);
}

async function graph(path: string, token: string, init: RequestInit = {}, timeoutMs = 25_000) {
  const url = new URL(graphUrl(path));
  if ((init.method || "GET") === "GET") url.searchParams.set("access_token", token);
  const response = await fetch(url, {
    ...init,
    headers: init.body ? { "content-type": "application/x-www-form-urlencoded", ...init.headers } : init.headers,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) throw new Error(data?.error?.message || "Falha na comunicação com a Meta.");
  return data;
}

export async function createMetaOAuth(input: { userUid: string; clientId: string; origin: string }) {
  await ensureOAuthTables();
  if (!process.env.META_CLIENT_ID || !process.env.META_CLIENT_SECRET) throw new Error("META_NOT_CONFIGURED");
  if (!(await rows("SELECT 1 FROM clients WHERE id = ? LIMIT 1", [input.clientId]))[0]) throw new Error("CLIENT_NOT_FOUND");
  const state = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(state).digest("hex");
  await exec("DELETE FROM meta_oauth_states WHERE expires_at < NOW() OR used_at IS NOT NULL");
  await exec("INSERT INTO meta_oauth_states (state_hash, user_uid, client_id, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))", [hash, input.userUid, input.clientId]);
  const callback = `${input.origin}/api/auth/callback/meta`;
  const url = new URL(`https://www.facebook.com/${apiVersion()}/dialog/oauth`);
  url.searchParams.set("client_id", process.env.META_CLIENT_ID);
  url.searchParams.set("redirect_uri", callback);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "pages_show_list,pages_read_engagement,instagram_basic,instagram_manage_insights");
  return url.toString();
}

export async function finishMetaOAuth(input: { state: string; code: string; origin: string }) {
  await ensureOAuthTables();
  const hash = createHash("sha256").update(input.state).digest("hex");
  const state = (await rows("SELECT * FROM meta_oauth_states WHERE state_hash = ? AND used_at IS NULL AND expires_at > NOW() LIMIT 1", [hash]))[0];
  if (!state) throw new Error("OAUTH_STATE_INVALID");
  await exec("UPDATE meta_oauth_states SET used_at = NOW() WHERE state_hash = ?", [hash]);
  const callback = `${input.origin}/api/auth/callback/meta`;
  const tokenUrl = new URL(graphUrl("/oauth/access_token"));
  tokenUrl.searchParams.set("client_id", process.env.META_CLIENT_ID || "");
  tokenUrl.searchParams.set("client_secret", process.env.META_CLIENT_SECRET || "");
  tokenUrl.searchParams.set("redirect_uri", callback);
  tokenUrl.searchParams.set("code", input.code);
  const tokenResponse = await fetch(tokenUrl, { signal: AbortSignal.timeout(25_000) });
  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenData.access_token) throw new Error(tokenData?.error?.message || "OAUTH_TOKEN_FAILED");
  const longUrl = new URL(graphUrl("/oauth/access_token"));
  longUrl.searchParams.set("grant_type", "fb_exchange_token");
  longUrl.searchParams.set("client_id", process.env.META_CLIENT_ID || "");
  longUrl.searchParams.set("client_secret", process.env.META_CLIENT_SECRET || "");
  longUrl.searchParams.set("fb_exchange_token", tokenData.access_token);
  const longResponse = await fetch(longUrl, { signal: AbortSignal.timeout(25_000) });
  const longData = await longResponse.json();
  const userToken = longData.access_token || tokenData.access_token;
  const appToken = `${process.env.META_CLIENT_ID}|${process.env.META_CLIENT_SECRET}`;
  const [pages, permissions, identity, tokenDebug] = await Promise.all([
    graph("/me/accounts?fields=id,name,access_token,tasks&limit=100", userToken),
    graph("/me/permissions", userToken),
    graph("/me?fields=id,name", userToken),
    graph(`/debug_token?input_token=${encodeURIComponent(userToken)}`, appToken),
  ]);
  const granted = (permissions.data || []).filter((item: any) => item.status === "granted");
  const debugScopes = tokenDebug.data?.granular_scopes || [];
  const permissionScopes = granted.flatMap((item: any) => item.granular_scopes || []);
  const scopes = [...permissionScopes, ...debugScopes];
  const pageTargets = scopes
    .filter((scope: any) => String(scope.scope || scope.permission || "").startsWith("pages_"))
    .flatMap((scope: any) => scope.target_ids || []);
  const pageIds = [...new Set([...(pages.data || []).map((page: any) => page.id), ...pageTargets])];
  const detailedPages: any[] = [];
  for (const pageId of pageIds) {
    const listed = (pages.data || []).find((page: any) => page.id === pageId);
    try {
      const detail = await graph(`/${pageId}?fields=id,name,access_token,tasks,instagram_business_account{id,username,name,profile_picture_url,followers_count,media_count}`, userToken);
      detailedPages.push({ ...listed, ...detail });
    } catch {
      if (listed?.access_token) {
        try {
          const detail = await graph(`/${pageId}?fields=id,name,access_token,tasks,instagram_business_account{id,username,name,profile_picture_url,followers_count,media_count}`, listed.access_token);
          detailedPages.push({ ...listed, ...detail });
        } catch {}
      }
    }
  }
  const accounts = detailedPages.map((page: any) => ({
    pageId: String(page.id),
    pageName: String(page.name || "Página Facebook"),
    pageAccessToken: String(page.access_token || ""),
    instagram: page.instagram_business_account ? {
      id: String(page.instagram_business_account.id),
      username: String(page.instagram_business_account.username || ""),
      name: String(page.instagram_business_account.name || ""),
      profilePictureUrl: String(page.instagram_business_account.profile_picture_url || ""),
      followersCount: Number(page.instagram_business_account.followers_count || 0),
      mediaCount: Number(page.instagram_business_account.media_count || 0),
    } : null,
  }));
  const connectionId = randomBytes(32).toString("hex");
  await exec("INSERT INTO meta_oauth_connections (id, user_uid, client_id, encrypted_accounts, expires_at) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE))", [connectionId, state.user_uid, state.client_id, encryptSecret(JSON.stringify({ userToken, accounts }))]);
  return {
    connectionId,
    accounts: accounts.map((item) => ({ pageId: item.pageId, pageName: item.pageName, instagram: item.instagram })),
    diagnostic: {
      user: identity.name || identity.id,
      grantedPermissions: granted.map((item: any) => item.permission),
      targetsDetected: { pages: pageIds },
    },
  };
}

export async function selectMetaAccount(input: { connectionId: string; pageId: string; clientId: string; userUid: string }) {
  await ensureOAuthTables();
  const conn = (await rows("SELECT * FROM meta_oauth_connections WHERE id = ? AND client_id = ? AND used_at IS NULL AND expires_at > NOW() LIMIT 1", [input.connectionId, input.clientId]))[0];
  if (!conn) throw new Error("CONNECTION_INVALID");
  const payload = JSON.parse(decryptSecret(conn.encrypted_accounts) || "{}");
  const account = (payload.accounts || []).find((item: any) => item.pageId === input.pageId);
  if (!account) throw new Error("PAGE_NOT_FOUND");
  await exec("UPDATE meta_oauth_connections SET used_at = NOW() WHERE id = ?", [input.connectionId]);
  const config = JSON.stringify({
    facebookPageId: account.pageId,
    facebookPageName: account.pageName,
    instagramAccountId: account.instagram?.id || null,
    instagramUsername: account.instagram?.username || null,
    instagramName: account.instagram?.name || null,
    instagramProfilePictureUrl: account.instagram?.profilePictureUrl || null,
    userAccessToken: encryptSecret(payload.userToken),
    pageAccessToken: encryptSecret(account.pageAccessToken),
    connectedAt: new Date().toISOString(),
    connectedBy: input.userUid,
  });
  await exec("UPDATE clients SET meta_config = ? WHERE id = ?", [config, input.clientId]);
  return {
    success: true,
    pageId: account.pageId,
    pageName: account.pageName,
    instagram: account.instagram,
  };
}
