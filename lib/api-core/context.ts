import { NextRequest } from "next/server";
import { exec, parseJson, rows } from "../db";
import { timingSafeEqual } from "crypto";
import { ApiContext as Ctx, Permission } from "../api-types";

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [
    "canCreatePosts",
    "canEditAssignedPosts",
    "canEditCalendar",
    "canReviewAndSend",
    "canConfigClients",
    "canManageBrandSystem",
    "canManageRoles",
    "canViewPresentation",
    "canViewProductionGallery",
    "canComment",
  ],
  gerente: [
    "canCreatePosts",
    "canEditAssignedPosts",
    "canEditCalendar",
    "canReviewAndSend",
    "canConfigClients",
    "canManageBrandSystem",
    "canViewPresentation",
    "canViewProductionGallery",
    "canComment",
  ],
  atendimento: [
    "canReviewAndSend",
    "canConfigClients",
    "canViewPresentation",
    "canViewProductionGallery",
    "canComment",
  ],
  designer: [
    "canCreatePosts",
    "canEditAssignedPosts",
    "canEditCalendar",
    "canConfigClients",
    "canViewPresentation",
    "canViewProductionGallery",
  ],
  estagiario: [
    "canEditAssignedPosts",
    "canViewPresentation",
    "canViewProductionGallery",
  ],
  analista: ["canViewPresentation", "canViewProductionGallery"],
  socialmedia: [
    "canCreatePosts",
    "canEditAssignedPosts",
    "canEditCalendar",
    "canViewPresentation",
    "canViewProductionGallery",
    "canComment",
  ],
  copywriter: [
    "canCreatePosts",
    "canEditAssignedPosts",
    "canEditCalendar",
    "canViewPresentation",
    "canViewProductionGallery",
    "canComment",
  ],
  revisor: [
    "canReviewAndSend",
    "canEditAssignedPosts",
    "canViewPresentation",
    "canViewProductionGallery",
    "canComment",
  ],
  cliente: ["canViewPresentation", "canComment"],
};

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export async function rateLimited(key: string, limit: number, windowMs: number) {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));
    await exec(
      "INSERT INTO rate_limits (bucket_key, hit_count, reset_at) VALUES (?, 1, DATE_ADD(NOW(), INTERVAL ? SECOND)) ON DUPLICATE KEY UPDATE hit_count = IF(reset_at <= NOW(), 1, hit_count + 1), reset_at = IF(reset_at <= NOW(), DATE_ADD(NOW(), INTERVAL ? SECOND), reset_at)",
      [key.slice(0, 190), windowSeconds, windowSeconds],
    );
    const bucket = (
      await rows(
        "SELECT hit_count FROM rate_limits WHERE bucket_key = ? LIMIT 1",
        [key.slice(0, 190)],
      )
    )[0];
    return Number(bucket?.hit_count || 0) > limit;
  }
  const now = Date.now();
  const current = rateBuckets.get(key);
  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  return ++current.count > limit;
}

export async function body(req: NextRequest) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export function toMysqlDateTime(value: any): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export async function getPermissionMapForUser(
  user: any,
): Promise<Record<string, boolean>> {
  const defaults = Object.fromEntries(
    (ROLE_PERMISSIONS[user.role] || []).map((permission) => [permission, true]),
  );
  const custom = await rows(
    "SELECT permissions FROM custom_roles WHERE id = ?",
    [user.role],
  );
  return { ...defaults, ...parseJson(custom[0]?.permissions, {}) };
}

export async function enrichUser(user: any) {
  const agency =
    (
      await rows(
        "SELECT name, slogan, logo_url, logo_dark_url, theme_config FROM agencies ORDER BY id LIMIT 1",
      )
    )[0] || {};
  return {
    ...user,
    agencyName: agency.name || "",
    agencySlogan: agency.slogan || "",
    agencyLogo: agency.logo_url || "",
    agencyLogoDark: agency.logo_dark_url || "",
    theme_config: parseJson(agency.theme_config, null),
    ui_preferences: parseJson(user.ui_preferences, {}),
    permissions: await getPermissionMapForUser(user),
  };
}

export async function getContext(req: NextRequest): Promise<Ctx> {
  const token = req.cookies.get("cp_session")?.value || null;
  if (!token)
    return {
      userUid: null,
      userRole: null,
      isAuthenticated: false,
      permissions: new Set(),
    };
  const users = await rows(
    "SELECT uid, role FROM users WHERE session_token = ? AND session_expires_at > NOW()",
    [token],
  );
  const user = users[0];
  if (!user?.uid)
    return {
      userUid: null,
      userRole: null,
      isAuthenticated: false,
      permissions: new Set(),
    };
  const permissionMap = await getPermissionMapForUser(user);
  const permissions = Object.entries(permissionMap)
    .filter(([, value]) => value === true)
    .map(([key]) => key as Permission);
  return {
    userUid: user.uid,
    userRole: user.role,
    isAuthenticated: true,
    permissions: new Set(permissions),
  };
}

export function isPublic(route: string) {
  if (route === "/health" || route === "/health/db") return true;
  if (route === "/cron/deadlines") return true;
  if (route === "/meta/jobs/run") return true;
  if (route === "/auth/login" || route === "/auth/validate-token") return true;
  if (
    route.startsWith("/auth/social/login") ||
    route.startsWith("/auth/callback")
  )
    return true;
  if (route.startsWith("/public/") || route.startsWith("/review/")) return true;
  return false;
}

export function validCronSecret(req: NextRequest) {
  const secret = process.env.CRON_SECRET || "";
  const supplied = (req.headers.get("authorization") || "").replace(
    /^Bearer\s+/i,
    "",
  );
  const expectedBuffer = Buffer.from(secret);
  const suppliedBuffer = Buffer.from(supplied);
  return (
    Boolean(secret) &&
    expectedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(expectedBuffer, suppliedBuffer)
  );
}

export function requiredPermission(method: string, route: string): Permission | null {
  if (isPublic(route)) return null;
  if (route === "/users/preferences" || route === "/users/me") return null;
  if (route.startsWith("/uploads/media")) return "canCreatePosts";
  if (route.startsWith("/agency/settings")) return "canManageBrandSystem";
  if (
    route.startsWith("/admin/") ||
    route === "/agencies" ||
    route.startsWith("/users") ||
    route.startsWith("/custom-roles")
  )
    return "canManageRoles";
  if (route.startsWith("/presentation/"))
    return "canViewPresentation";
  if (route === "/production-gallery") return "canViewProductionGallery";
  if (/\/posts\/[^/]+\/comments/.test(route)) return "canComment";
  if (
    route.startsWith("/tokens") ||
    route.endsWith("/send-for-review") ||
    route === "/notify-whatsapp"
  )
    return "canReviewAndSend";
  if (route.startsWith("/settings"))
    return method === "GET" ? null : "canConfigClients";
  if (route.startsWith("/clients"))
    return method === "GET" ? null : "canConfigClients";
  if (
    (route.startsWith("/posts") || route.startsWith("/posts-bulk")) &&
    method !== "GET"
  )
    return route === "/posts" && method === "POST" ? null : "canEditCalendar";
  if (route === "/generate-objective") return "canCreatePosts";
  return null;
}
