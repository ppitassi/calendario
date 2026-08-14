import { NextRequest } from "next/server";
import { exec, rows } from "./db";
import { timingSafeEqual } from "crypto";
import { processMetaJobs } from "./meta";
import { ApiParams as Params } from "./api-types";
import { err, ok } from "./api-response";
import { clientOwnerIds, handleClientsApi, publicClient } from "./api-clients";
import { handleProductionGalleryApi } from "./api-production-gallery";
import { getContext, isPublic, requiredPermission, validCronSecret } from "./api-core/context";
import { handleAuthApi } from "./api-core/auth";
import { handlePostsApi } from "./api-core/posts";
import { handleAdminApi } from "./api-core/admin";
import { handleDashboardApi } from "./api-core/dashboard";
import { handleMediaApi } from "./api-core/media";
import { handlePublicReviewApi } from "./api-core/public-review";
import { handleLeiaChatApi } from "./api-core/leia-chat";
import { removeLocalAssetIfUnreferenced } from "./api-core/media-utils";
import { pdfRendererHealth } from "./api-core/pdf";

export { clientOwnerIds, publicClient };
export { getContext, isPublic, requiredPermission, ROLE_PERMISSIONS } from "./api-core/context";

async function sendWAMessage(to: string, text: string) {
  if (process.env.NODE_ENV === "test") return;
  const endpoint = process.env.WHATSAPP_API_ENDPOINT;
  if (!endpoint) return;
  await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, text }),
  }).catch(() => undefined);
}

export async function handleApi(
  method: string,
  route: string,
  req: NextRequest,
  params: Params = {},
) {
  try {
    const ctx = await getContext(req);
    const permission = requiredPermission(method, route);
    if (!isPublic(route) && !ctx.isAuthenticated)
      return err("Acesso não autorizado. Faça login para continuar.", 401);
    if (permission && !ctx.permissions.has(permission))
      return err("Permissão insuficiente.", 403);

    const clientResponse = await handleClientsApi(
      method,
      route,
      req,
      params,
      ctx,
      removeLocalAssetIfUnreferenced,
    );
    if (clientResponse) return clientResponse;

    const galleryResponse = await handleProductionGalleryApi(
      method,
      route,
      req,
    );
    if (galleryResponse) return galleryResponse;

    if (route === "/health" && method === "GET") { const pdf=pdfRendererHealth(); return ok({ ok: true, pdf: { configured: pdf.configured, mode: pdf.mode } }); }

    if (route === "/health/db" && method === "GET") {
      const result = await rows("SELECT 1 AS ok");
      return ok({ ok: true, db: "connected", result: result[0] });
    }

    if (route === "/meta/jobs/run" && method === "POST") {
      const expected = String(process.env.META_JOB_SECRET || "");
      const supplied = String(req.headers.get("x-meta-job-secret") || "");
      if (
        !expected ||
        expected.length !== supplied.length ||
        !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))
      )
        return err("Não autorizado.", 401);
      return ok({ jobs: await processMetaJobs(3) });
    }

    if (route === "/cron/deadlines" && method === "GET") {
      if (!validCronSecret(req)) return err("Não autorizado.", 401);
      const dueItems=await rows(`SELECT wi.id,wi.title,wi.due_at,a.user_id,DATEDIFF(wi.due_at,CURRENT_DATE) days_left FROM work_items wi JOIN work_item_assignees a ON a.work_item_id=wi.id AND a.removed_at IS NULL WHERE wi.deleted_at IS NULL AND wi.archived_at IS NULL AND wi.status NOT IN ('DONE','CANCELLED') AND wi.due_at IS NOT NULL AND wi.due_at<DATE_ADD(CURRENT_DATE,INTERVAL 3 DAY)`);let created=0;for(const item of dueItems){const type=Number(item.days_left)<0?"WORK_ITEM_OVERDUE":"WORK_ITEM_DUE_SOON",dedupe=`deadline:${item.id}:${item.user_id}:${new Date().toISOString().slice(0,10)}`,result=await exec("INSERT IGNORE INTO notifications (id,recipient_user_id,type,work_item_id,data_json,deduplication_key) VALUES (UUID(),?,?,?,?,?)",[item.user_id,type,item.id,JSON.stringify({title:item.title,dueAt:item.due_at,daysLeft:Number(item.days_left)}),dedupe]);created+=Number(result.affectedRows||0);}return ok({success:true,notifications:created,itemsChecked:dueItems.length});
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: process.env.APP_TIMEZONE || "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date());
      const values = Object.fromEntries(
        parts.map((part) => [part.type, part.value]),
      );
      const day = Number(values.day);
      const dateKey = `${values.year}-${values.month}-${values.day}`;
      const agencies = await rows(
        "SELECT id, name, deadline_pre, deadline_final FROM agencies WHERE deadline_pre = ? OR deadline_final = ?",
        [day, day],
      );
      let notifications = 0;
      for (const agency of agencies) {
        const kinds = [
          ...(Number(agency.deadline_pre) === day ? ["pre"] : []),
          ...(Number(agency.deadline_final) === day ? ["final"] : []),
        ];
        for (const kind of kinds) {
          const inserted = await exec(
            "INSERT IGNORE INTO deadline_alert_log (alert_date, alert_kind) VALUES (?, ?)",
            [dateKey, kind],
          );
          if (!inserted.affectedRows) continue;
          const clients = await rows(
            "SELECT name, whatsappGroupId FROM clients WHERE whatsappGroupId IS NOT NULL AND whatsappGroupId <> ?",
            [""],
          );
          const message =
            kind === "pre"
              ? `Alerta de pré-calendário: hoje é o prazo de preparação da agência ${agency.name}.`
              : `Alerta de prazo final: hoje é o fechamento do calendário da agência ${agency.name}.`;
          for (const client of clients) {
            await sendWAMessage(
              client.whatsappGroupId,
              `${message} Cliente: ${client.name}.`,
            ).catch(() => undefined);
            notifications += 1;
          }
        }
      }
      return ok({ success: true, notifications });
    }

    const authRes = await handleAuthApi(method, route, req, params, ctx);
    if (authRes) return authRes;

    const postsRes = await handlePostsApi(method, route, req, params, ctx, removeLocalAssetIfUnreferenced);
    if (postsRes) return postsRes;

    const adminRes = await handleAdminApi(method, route, req, params, ctx);
    if (adminRes) return adminRes;

    const dashRes = await handleDashboardApi(method, route, req, params, ctx);
    if (dashRes) return dashRes;

    const mediaRes = await handleMediaApi(method, route, req, ctx);
    if (mediaRes) return mediaRes;

    const pubRes = await handlePublicReviewApi(method, route, req, params, ctx);
    if (pubRes) return pubRes;

    const leiaRes = await handleLeiaChatApi(method, route, req, ctx);
    if (leiaRes) return leiaRes;

    return err(`Endpoint não migrado: ${method} ${route}`, 404);
  } catch (e: any) {
    const mediaErrors: Record<string, { status: number; message: string }> = {
      MEDIA_TYPE_NOT_ALLOWED: {
        status: 415,
        message: "Formato de mídia não permitido.",
      },
      MEDIA_EXTENSION_INVALID: {
        status: 422,
        message: "A extensão não corresponde ao formato informado.",
      },
      MEDIA_SIZE_EXCEEDED: {
        status: 413,
        message: "Tamanho do arquivo excede o limite permitido.",
      },
      MEDIA_CORRUPTED: {
        status: 422,
        message: "O arquivo enviado está corrompido.",
      },
      MEDIA_CATEGORY_INVALID: {
        status: 422,
        message: "Categoria de mídia inválida.",
      },
    };

    if (e?.code && mediaErrors[e.code]) {
      const errDef = mediaErrors[e.code];
      return err(e.message || errDef.message, errDef.status, e.code);
    }
    console.error("[api] unhandled error", {
      method,
      route,
      code: e?.code,
      message: e instanceof Error ? e.message : String(e),
    });
    return err("Erro interno no servidor.", 500, "INTERNAL_ERROR");
  }
}
