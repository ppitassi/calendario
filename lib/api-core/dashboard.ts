import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { exec, parseJson, rows } from "../db";
import { ApiContext, ApiParams } from "../api-types";
import { err, ok } from "../api-response";
import { body } from "./context";

export async function handleDashboardApi(
  method: string,
  route: string,
  req: NextRequest,
  params: ApiParams,
  ctx: ApiContext,
): Promise<NextResponse | null> {
  if (route === "/dashboard/layout" && method === "GET") {
    if (!ctx.userUid) return err("Não autenticado.", 401);
    const result = await rows(
      "SELECT ui_preferences FROM users WHERE uid = ? LIMIT 1",
      [ctx.userUid],
    );
    const preferences = parseJson(result[0]?.ui_preferences, {});
    const layoutJson = preferences.widgetLayouts?.[ctx.userUid];
    const filteredLayout = Array.isArray(layoutJson)
      ? layoutJson.filter((item: any) => {
        if (!item || typeof item !== "object") return false;
        if (
          String(item.id) === "production_bi" &&
          !ctx.permissions.has("canViewProductionGallery")
        )
          return false;
        return true;
      })
      : null;
    return ok({
      layoutVersion: Number(preferences.dashboardLayoutVersion || 1),
      schemaVersion: Number(preferences.dashboardLayoutSchemaVersion || 1),
      layoutJson: filteredLayout,
      updatedAt: preferences.dashboardLayoutUpdatedAt,
    });
  }

  if (route === "/dashboard/layout" && method === "PUT") {
    if (!ctx.userUid) return err("Não autenticado.", 401);
    const incoming = await body(req);
    const currentPrefs = parseJson(
      (
        await rows(
          "SELECT ui_preferences FROM users WHERE uid = ? LIMIT 1",
          [ctx.userUid],
        )
      )[0]?.ui_preferences,
      {},
    );
    const currentVersion = Number(currentPrefs.dashboardLayoutVersion || 1);
    if (
      incoming.expectedLayoutVersion != null &&
      Number(incoming.expectedLayoutVersion) !== currentVersion
    ) {
      return err(
        "O layout da dashboard foi alterado em outra aba ou sessão. Recarregue a página antes de salvar.",
        409,
        "LAYOUT_VERSION_CONFLICT",
      );
    }
    const rawLayout = Array.isArray(incoming.layoutJson)
      ? incoming.layoutJson
      : [];
    const widgetIds = new Set(["workload", "productivity", "companion"]);
    const sizeMap: Record<string, Set<string>> = {
      workload: new Set(["compact", "medium"]),
      productivity: new Set(["compact", "medium"]),
      companion: new Set(["compact", "medium"]),
    };

    const seen = new Set<string>();
    const validatedLayout = rawLayout
      .filter((item: any) => {
        if (!item || typeof item !== "object") return false;
        const id = String(item.id || "");
        if (!widgetIds.has(id) || seen.has(id)) return false;
        if (
          id === "production_bi" &&
          !ctx.permissions.has("canViewProductionGallery")
        )
          return false;
        seen.add(id);
        return true;
      })
      .map((item: any, idx: number) => {
        const id = String(item.id);
        const allowedSizes = sizeMap[id] || new Set(["medium"]);
        const size = allowedSizes.has(String(item.size))
          ? String(item.size)
          : Array.from(allowedSizes)[0];
        return {
          id,
          position: idx,
          size,
          isHidden: Boolean(item.isHidden),
        };
      });

    const nextVersion = currentVersion + 1;
    currentPrefs.widgetLayouts = {
      ...(currentPrefs.widgetLayouts || {}),
      [ctx.userUid]: validatedLayout,
    };
    currentPrefs.dashboardLayoutVersion = nextVersion;
    currentPrefs.dashboardLayoutSchemaVersion = 2;
    currentPrefs.dashboardLayoutUpdatedAt = new Date().toISOString();
    await exec(
      "UPDATE users SET ui_preferences = ? WHERE uid = ?",
      [JSON.stringify(currentPrefs), ctx.userUid],
    );

    return ok({
      success: true,
      layoutVersion: nextVersion,
      schemaVersion: 2,
      layoutJson: validatedLayout,
      updatedAt: currentPrefs.dashboardLayoutUpdatedAt,
    });
  }

  if (route === "/dashboard/layout" && method === "DELETE") {
    if (!ctx.userUid) return err("Não autenticado.", 401);
    const currentPrefs = parseJson(
      (
        await rows(
          "SELECT ui_preferences FROM users WHERE uid = ? LIMIT 1",
          [ctx.userUid],
        )
      )[0]?.ui_preferences,
      {},
    );
    if (
      currentPrefs.widgetLayouts &&
      typeof currentPrefs.widgetLayouts === "object"
    )
      delete currentPrefs.widgetLayouts[ctx.userUid];
    currentPrefs.dashboardLayoutVersion =
      Number(currentPrefs.dashboardLayoutVersion || 1) + 1;
    currentPrefs.dashboardLayoutSchemaVersion = 2;
    currentPrefs.dashboardLayoutUpdatedAt = new Date().toISOString();
    await exec(
      "UPDATE users SET ui_preferences = ? WHERE uid = ?",
      [JSON.stringify(currentPrefs), ctx.userUid],
    );
    return ok({ success: true });
  }

  if (route === "/holidays/[year]" && method === "GET") {
    const r = await axios
      .get(`https://brasilapi.com.br/api/feriados/v1/${params.year}`)
      .catch(() => ({ data: [] }));
    return ok(r.data);
  }

  if (route === "/geolocate" && method === "GET") {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
    return ok({ ip });
  }

  if (route === "/admin/dashboard-stats" && method === "GET") {
    const clients = await rows(
      "SELECT COUNT(*) as total FROM clients",
    );
    const posts = await rows(
      "SELECT COUNT(*) as total FROM posts",
    );
    const users = await rows(
      "SELECT COUNT(*) as total FROM users",
    );
    return ok({
      clients: clients[0]?.total || 0,
      posts: posts[0]?.total || 0,
      users: users[0]?.total || 0,
    });
  }

  if (route === "/admin/workload-stats" && method === "GET")
    return ok(
      await rows(
        "SELECT u.uid, u.displayName, COUNT(p.id) as total FROM users u LEFT JOIN posts p ON p.assigneeId = u.uid GROUP BY u.uid, u.displayName",
      ),
    );

  if (route === "/admin/trigger-deadline-alerts" && method === "POST")
    return ok();

  return null;
}
