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
      "SELECT settings_json ui_preferences FROM user_settings WHERE user_id = ? LIMIT 1",
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
          "SELECT settings_json ui_preferences FROM user_settings WHERE user_id = ? LIMIT 1",
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
      "INSERT INTO user_settings (user_id,settings_json) VALUES (?,?) ON DUPLICATE KEY UPDATE settings_json=VALUES(settings_json)",
      [ctx.userUid, JSON.stringify(currentPrefs)],
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
          "SELECT settings_json ui_preferences FROM user_settings WHERE user_id = ? LIMIT 1",
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
      "INSERT INTO user_settings (user_id,settings_json) VALUES (?,?) ON DUPLICATE KEY UPDATE settings_json=VALUES(settings_json)",
      [ctx.userUid, JSON.stringify(currentPrefs)],
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
    const [clients,posts,users,work,throughput,time,photos,externals] = await Promise.all([
      rows("SELECT COUNT(*) total FROM clients WHERE archived_at IS NULL"),
      rows("SELECT COUNT(*) total FROM content_items"),
      rows("SELECT COUNT(*) total FROM users WHERE active=TRUE AND deleted_at IS NULL"),
      rows(`SELECT SUM(type='PROJECT' AND status NOT IN ('DONE','CANCELLED')) activeProjects,SUM(type='DEMAND' AND status NOT IN ('DONE','CANCELLED')) openDemands,SUM(type='TASK' AND status NOT IN ('DONE','CANCELLED')) openTasks,SUM(status='BLOCKED') blocked,SUM(due_at<NOW() AND status NOT IN ('DONE','CANCELLED')) overdue FROM work_items WHERE deleted_at IS NULL AND archived_at IS NULL`),
      rows("SELECT COUNT(*) completedMonth FROM work_items WHERE completed_at>=DATE_FORMAT(CURRENT_DATE,'%Y-%m-01') AND completed_at<DATE_ADD(LAST_DAY(CURRENT_DATE),INTERVAL 1 DAY)"),
      rows("SELECT COALESCE(SUM(duration_seconds),0) trackedSeconds FROM work_item_time_entries WHERE started_at>=DATE_FORMAT(CURRENT_DATE,'%Y-%m-01')"),
      rows("SELECT COALESCE(SUM(edited_count),0) edited,COALESCE(SUM(exported_count),0) exported FROM photo_jobs"),
      rows("SELECT COUNT(*) total,COALESCE(AVG(TIMESTAMPDIFF(MINUTE,actual_start,actual_end)),0) averageMinutes FROM external_operations WHERE status='COMPLETED'"),
    ]);
    return ok({
      clients: clients[0]?.total || 0,
      posts: posts[0]?.total || 0,
      users: users[0]?.total || 0,
      work: work[0]||{},throughput:Number(throughput[0]?.completedMonth||0),trackedHours:Math.round(Number(time[0]?.trackedSeconds||0)/36)/100,photos:photos[0]||{},externalOperations:externals[0]||{},
    });
  }

  if (route === "/admin/workload-stats" && method === "GET")
    return ok(
      await rows(
        `SELECT u.id uid,u.name displayName,COUNT(DISTINCT CASE WHEN wi.status NOT IN ('DONE','CANCELLED') THEN wi.id END) total,COUNT(DISTINCT CASE WHEN wi.status='BLOCKED' THEN wi.id END) blocked,COUNT(DISTINCT CASE WHEN wi.due_at<NOW() AND wi.status NOT IN ('DONE','CANCELLED') THEN wi.id END) overdue,COALESCE(SUM(te.duration_seconds),0) trackedSeconds FROM users u LEFT JOIN work_item_assignees a ON a.user_id=u.id AND a.removed_at IS NULL LEFT JOIN work_items wi ON wi.id=a.work_item_id AND wi.deleted_at IS NULL LEFT JOIN work_item_time_entries te ON te.work_item_id=wi.id AND te.user_id=u.id AND te.started_at>=DATE_FORMAT(CURRENT_DATE,'%Y-%m-01') WHERE u.active=TRUE AND u.deleted_at IS NULL GROUP BY u.id,u.name ORDER BY total DESC,u.name`,
      ),
    );

  if (route === "/admin/trigger-deadline-alerts" && method === "POST")
    return ok();

  return null;
}
