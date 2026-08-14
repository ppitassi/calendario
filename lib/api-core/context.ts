import { createHash, timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";
import { exec, parseJson, rows } from "../db";
import { ApiContext as Ctx, Permission } from "../api-types";

const legacyByPermission: Record<string, Permission[]> = {
  PROJECT_CREATE: ["canCreatePosts"], DEMAND_CREATE: ["canCreatePosts"], TASK_CREATE: ["canCreatePosts"],
  PROJECT_MANAGE: ["canEditCalendar"], DEMAND_MANAGE: ["canEditCalendar"], TASK_MANAGE: ["canEditAssignedPosts", "canEditCalendar"],
  CONTENT_EDIT: ["canCreatePosts", "canEditAssignedPosts", "canEditCalendar"], CONTENT_REVIEW: ["canReviewAndSend"],
  APPROVAL_MANAGE: ["canReviewAndSend"], CLIENT_EDIT: ["canConfigClients"], CLIENT_CREATE: ["canConfigClients"], CLIENT_ARCHIVE: ["canConfigClients"],
  USER_MANAGE: ["canManageRoles"], SYSTEM_SETTINGS_MANAGE: ["canManageBrandSystem"],
};

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: ["canCreatePosts", "canEditAssignedPosts", "canEditCalendar", "canReviewAndSend", "canConfigClients", "canManageBrandSystem", "canManageRoles", "canViewPresentation", "canViewProductionGallery", "canComment"],
};

const rateBuckets = new Map<string, { count: number; resetAt: number }>();
export async function rateLimited(key: string, limit: number, windowMs: number) {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    const seconds = Math.max(1, Math.ceil(windowMs / 1000));
    await exec("INSERT INTO rate_limits (bucket_key,hit_count,reset_at) VALUES (?,1,DATE_ADD(NOW(),INTERVAL ? SECOND)) ON DUPLICATE KEY UPDATE hit_count=IF(reset_at<=NOW(),1,hit_count+1),reset_at=IF(reset_at<=NOW(),DATE_ADD(NOW(),INTERVAL ? SECOND),reset_at)", [key.slice(0, 191), seconds, seconds]);
    const bucket = (await rows("SELECT hit_count FROM rate_limits WHERE bucket_key=?", [key.slice(0, 191)]))[0];
    return Number(bucket?.hit_count || 0) > limit;
  }
  const now = Date.now(); const current = rateBuckets.get(key);
  if (!current || current.resetAt <= now) { rateBuckets.set(key, { count: 1, resetAt: now + windowMs }); return false; }
  current.count += 1; return current.count > limit;
}

export async function body(req: NextRequest) { try { return await req.json(); } catch { return {}; } }
export function toMysqlDateTime(value: unknown): string | null { const date = value instanceof Date ? value : new Date(String(value || "")); return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 19).replace("T", " ") : null; }
export const sessionTokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const legacyRole = (key: string | null | undefined) => ({ ADMIN: "admin", MANAGEMENT: "gerente", ACCOUNT: "atendimento", SOCIAL_MEDIA: "socialmedia", DESIGNER: "designer", COPYWRITER: "copywriter" }[String(key || "").toUpperCase()] || String(key || "").toLowerCase());

export async function getPermissionMapForUser(user: { id?: string; uid?: string; role?: string }): Promise<Record<string, boolean>> {
  const userId = user.id || user.uid;
  if (!userId) return {};
  const result = await rows(`SELECT DISTINCT p.key_name FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=?`, [userId]);
  const keys = new Set<Permission>();
  for (const row of result) { const key = String(row.key_name) as Permission; keys.add(key); for (const alias of legacyByPermission[key] || []) keys.add(alias); }
  keys.add("canViewPresentation"); keys.add("canViewProductionGallery"); keys.add("canComment");
  return Object.fromEntries([...keys].map((key) => [key, true]));
}

export async function enrichUser(user: any) {
  const rolesForUser = await rows(`SELECT r.key_name,r.name FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=? ORDER BY r.system_role DESC,r.name`, [user.id]);
  const agency = (await rows("SELECT name,logo,timezone FROM agency_profile WHERE singleton_id=1"))[0] || {};
  const settings = (await rows("SELECT settings_json FROM user_settings WHERE user_id=?", [user.id]))[0];
  const primaryRole = legacyRole(rolesForUser[0]?.key_name);
  return {
    uid: user.id, id: user.id, email: user.email, displayName: user.name, name: user.name,
    photoURL: user.avatar, avatar: user.avatar, phoneNumber: user.phone, whatsapp: user.phone,
    active: Boolean(user.active), role: primaryRole, roles: rolesForUser,
    agencyName: agency.name || "", agencyLogo: agency.logo || "", agencyTimezone: agency.timezone,
    theme_config: null, ui_preferences: parseJson(settings?.settings_json, {}), permissions: await getPermissionMapForUser(user),
  };
}

const anonymous = (): Ctx => ({ userUid: null, userRole: null, isAuthenticated: false, permissions: new Set() });
export async function getContext(req: NextRequest): Promise<Ctx> {
  const token = req.cookies.get("cp_session")?.value; if (!token) return anonymous();
  const found = await rows(`SELECT u.id,r.key_name role FROM user_sessions s JOIN users u ON u.id=s.user_id AND u.active=TRUE AND u.deleted_at IS NULL LEFT JOIN user_roles ur ON ur.user_id=u.id LEFT JOIN roles r ON r.id=ur.role_id WHERE s.token_hash=? AND s.expires_at>NOW() AND s.revoked_at IS NULL ORDER BY r.system_role DESC LIMIT 1`, [sessionTokenHash(token)]);
  const user = found[0]; if (!user) return anonymous();
  const map = await getPermissionMapForUser(user); const permissions = Object.keys(map).filter((key) => map[key]).map((key) => key as Permission);
  return { userUid: user.id, userRole: legacyRole(user.role), isAuthenticated: true, permissions: new Set(permissions) };
}

export function isPublic(route: string) { return route === "/health" || route === "/health/db" || route === "/cron/deadlines" || route === "/meta/jobs/run" || route === "/auth/login" || route === "/auth/validate-token" || route.startsWith("/auth/callback") || route.startsWith("/public/") || route.startsWith("/review/"); }
export function validCronSecret(req: NextRequest) { const secret=process.env.CRON_SECRET||""; const supplied=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,""); return Boolean(secret)&&secret.length===supplied.length&&timingSafeEqual(Buffer.from(secret),Buffer.from(supplied)); }
export function requiredPermission(method: string, route: string): Permission | null {
  if (isPublic(route) || route === "/users/preferences" || route === "/users/me") return null;
  if (route.startsWith("/work-items")) return method === "GET" ? null : "TASK_MANAGE";
  if (route.startsWith("/clients")) return method === "GET" ? null : "CLIENT_EDIT";
  if (route.startsWith("/users") || route.startsWith("/roles") || route.startsWith("/permissions") || route.startsWith("/admin/")) return "USER_MANAGE";
  if (route.startsWith("/agency/") || route.startsWith("/settings")) return method === "GET" ? null : "SYSTEM_SETTINGS_MANAGE";
  if (route.startsWith("/presentation/")) return "canViewPresentation";
  return null;
}
