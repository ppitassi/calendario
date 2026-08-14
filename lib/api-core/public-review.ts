import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { exec, rows } from "../db";
import { ApiContext, ApiParams } from "../api-types";
import { err, ok } from "../api-response";
import { body, rateLimited, toMysqlDateTime } from "./context";
import { getPresentationData, getReviewData, isReviewDataError, validateReviewPost, validateReviewToken } from "../review-data";
import { canAccessPresentationClient } from "../presentation-access";
import { createPdfJob, pdfJob, resolvePresentationMedia } from "../presentation-pdf-jobs";
import { buildPresentationViewModel } from "../presentation-model";

async function clientExists(clientId: string) {
  const result = await rows("SELECT id FROM clients WHERE id = ? LIMIT 1", [clientId]);
  return Boolean(result[0]);
}

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

function tablePayload(data: Record<string, any>) {
  const out: Record<string, any> = { ...data };
  for (const key of Object.keys(out)) {
    if (Array.isArray(out[key]) || (out[key] && typeof out[key] === "object"))
      out[key] = JSON.stringify(out[key]);
  }
  return out;
}

export async function handlePublicReviewApi(
  method: string,
  route: string,
  req: NextRequest,
  params: ApiParams,
  ctx: ApiContext,
): Promise<NextResponse | null> {
  const url = new URL(req.url);

  if (route === "/presentation/[clientId]/[month]" && method === "GET") {
    if (!(await canAccessPresentationClient(ctx, params.clientId))) return err("Cliente não encontrado.",404);
    const data=await getPresentationData(params.clientId,params.month); if(isReviewDataError(data))return err(data.error,data.status);
    const model=buildPresentationViewModel(data); await resolvePresentationMedia(model); return ok(model);
  }

  if (route === "/presentation/[clientId]/[month]/pdf-jobs" && method === "POST") {
    if (!(await canAccessPresentationClient(ctx, params.clientId))) return err("Cliente não encontrado.", 404);
    if (await rateLimited(`pdf-job:${ctx.userUid}`, 10, 60_000)) return err("Limite de geração de PDF excedido.", 429);
    const job = await createPdfJob({ clientId: params.clientId, month: params.month, userUid: ctx.userUid });
    return ok(job, job.status === "ready" ? 200 : 202);
  }

  if (route === "/presentation/pdf-jobs/[jobId]" && method === "GET") {
    const job = await pdfJob(params.jobId);
    if (!job || !(await canAccessPresentationClient(ctx, job.clientId))) return err("Trabalho não encontrado.", 404);
    return ok({ jobId: job.id, snapshotId: job.snapshotId, status: job.status, progress: job.progress, version: job.version, warnings: typeof job.warnings === "string" ? JSON.parse(job.warnings) : job.warnings || [], error: job.lastError || null, downloadUrl: job.status === "ready" ? `/api/presentation/pdf-jobs/${job.id}/download` : null });
  }

  if (route === "/presentation/pdf-jobs/[jobId]/download" && method === "GET") {
    const job = await pdfJob(params.jobId);
    if (!job || job.status !== "ready" || !(await canAccessPresentationClient(ctx, job.clientId))) return err("PDF não encontrado ou ainda não concluído.", 404);
    return NextResponse.redirect(new URL(job.outputUrl, url.origin));
  }

  if (route === "/public/review/[token]/pdf-jobs" && method === "POST") {
    const tokenData = await validateReviewToken(params.token); if (isReviewDataError(tokenData)) return err(tokenData.error, tokenData.status);
    const job = await createPdfJob({ clientId: tokenData.clientId, month: tokenData.month, reviewToken: params.token });
    return ok(job, job.status === "ready" ? 200 : 202);
  }

  if (route === "/public/review/[token]/pdf-jobs/[jobId]" && method === "GET") {
    const tokenData = await validateReviewToken(params.token); if (isReviewDataError(tokenData)) return err(tokenData.error, tokenData.status);
    const job = await pdfJob(params.jobId); if (!job || job.reviewTokenId !== params.token) return err("Trabalho não encontrado.", 404);
    return ok({ jobId: job.id, snapshotId: job.snapshotId, status: job.status, progress: job.progress, version: job.version, warnings: typeof job.warnings === "string" ? JSON.parse(job.warnings) : job.warnings || [], error: job.lastError || null, downloadUrl: job.status === "ready" ? `/api/public/review/${encodeURIComponent(params.token)}/pdf-jobs/${job.id}/download` : null });
  }

  if (route === "/public/review/[token]/pdf-jobs/[jobId]/download" && method === "GET") {
    const tokenData = await validateReviewToken(params.token); if (isReviewDataError(tokenData)) return err(tokenData.error, tokenData.status);
    const job = await pdfJob(params.jobId); if (!job || job.status !== "ready" || job.reviewTokenId !== params.token) return err("PDF não encontrado ou ainda não concluído.", 404);
    return NextResponse.redirect(new URL(job.outputUrl, url.origin));
  }

  if (route === "/tokens" && method === "POST") {
    const payload = await body(req);
    if (!payload.clientId || !(await clientExists(String(payload.clientId))))
      return err("Cliente invalido.", 403);
    payload.id = randomBytes(32).toString("hex");
    payload.expiresAt = toMysqlDateTime(payload.expiresAt);
    if (!payload.expiresAt)
      return err("ExpiraÃ§Ã£o do token invÃ¡lida.", 400);
    const data = tablePayload(payload);
    await exec("INSERT INTO approval_tokens SET ?", [data]);
    return ok({ id: data.id });
  }

  if (route === "/tokens/[id]" && method === "GET") {
    const result = await rows(
      "SELECT * FROM approval_tokens WHERE id = ?",
      [params.id],
    );
    return result[0] ? ok(result[0]) : err("Token nÃ£o encontrado.", 404);
  }

  if (route === "/tokens" && method === "GET") {
    const where: string[] = [];
    const vals: any[] = [];
    for (const key of ["clientId", "month", "status"]) {
      const val = url.searchParams.get(key);
      if (val) {
        where.push(`${key} = ?`);
        vals.push(val);
      }
    }
    return ok(
      await rows(
        `SELECT * FROM approval_tokens${where.length ? ` WHERE ${where.join(" AND ")}` : ""}`,
        vals,
      ),
    );
  }

  if (route === "/tokens/[id]" && method === "PATCH") {
    const patch = await body(req);
    delete patch.clientId;
    delete patch.id;
    await exec(
      "UPDATE approval_tokens SET ? WHERE id = ?",
      [patch, params.id],
    );
    return ok();
  }

  if (route === "/public/review/[token]" && method === "GET") {
    const data = await getReviewData(params.token);
    return isReviewDataError(data) ? err(data.error, data.status) : ok(data);
  }

  if (route === "/public/review/[token]/action" && method === "POST") {
    const tokenData = await validateReviewToken(params.token);
    if (isReviewDataError(tokenData))
      return err(tokenData.error, tokenData.status);
    const data = await body(req);
    if (data.action !== "approve" && data.action !== "request_changes") {
      return err("AÃ§Ã£o de revisÃ£o invÃ¡lida.", 400);
    }
    const status = data.action === "approve" ? "approved" : "waiting";
    await exec(
      "UPDATE approval_tokens SET status = ?, clientNote = ? WHERE id = ?",
      [status, data.note || null, params.token],
    );
    return ok();
  }

  if (
    route === "/public/review/[token]/posts/[postId]/comments" &&
    method === "GET"
  ) {
    const tokenData = await validateReviewPost(params.token, params.postId);
    if (isReviewDataError(tokenData))
      return err(tokenData.error, tokenData.status);
    return ok(
      await rows(
        "SELECT id,postId,authorName,authorRole,content,createdAt FROM post_comments WHERE postId = ? AND authorRole = 'cliente' ORDER BY createdAt ASC",
        [params.postId],
      ),
    );
  }

  if (route === "/public/review/[token]/posts/[postId]/comments" && method === "POST") {
    const tokenData = await validateReviewPost(params.token, params.postId);
    if (isReviewDataError(tokenData)) return err(tokenData.error, tokenData.status);
    if (await rateLimited(`review-comment:${params.token}`, 20, 60_000)) return err("Limite de comentários excedido.", 429);
    const data=await body(req); const content=String(data.content||"").trim(); const authorName=String(data.authorName||"Cliente").trim().slice(0,120)||"Cliente";
    if(!content)return err("Comentário obrigatório.",400); if(content.length>5000)return err("Comentário muito extenso.",400);
    const result:any=await exec("INSERT INTO post_comments (postId,authorName,authorRole,content,commentType,createdAt) VALUES (?,?,'cliente',?,'comment',NOW())",[params.postId,authorName,content]);
    return ok({id:result.insertId});
  }

  if (
    route === "/public/review/[token]/export-pdf" &&
    method === "GET"
  ) {
    const tokenData = await validateReviewToken(params.token);
    if (isReviewDataError(tokenData))
      return err(tokenData.error, tokenData.status);
    if (await rateLimited(`pdf:${params.token}`, 10, 60_000))
      return err("Limite de geraÃ§Ã£o de PDF excedido.", 429);
    return ok(await createPdfJob({ clientId: tokenData.clientId, month: tokenData.month, reviewToken: params.token }), 202);
  }

  if (
    route === "/presentation/[clientId]/[month]/export-pdf" &&
    method === "GET"
  ) {
    if (!(await canAccessPresentationClient(ctx, params.clientId))) return err("Cliente não encontrado.", 404);
    if (await rateLimited(`pdf:${ctx.userUid}`, 10, 60_000))
      return err("Limite de geraÃ§Ã£o de PDF excedido.", 429);
    return ok(await createPdfJob({ clientId: params.clientId, month: params.month, userUid: ctx.userUid }), 202);
  }

  if (route === "/clients/[id]/send-for-review" && method === "POST") {
    const found = await rows(
      "SELECT name, whatsappGroupId FROM clients WHERE id = ?",
      [params.id],
    );
    const client = found[0];
    if (!client) return err("Cliente nÃ£o encontrado.", 404);
    const requestData = await body(req);
    const month = /^\d{4}-\d{2}$/.test(requestData.month || "")
      ? requestData.month
      : new Date().toISOString().slice(0, 7);
    const reviewToken = randomBytes(32).toString("hex");
    await exec(
      "INSERT INTO approval_tokens (id, clientId, month, status, expiresAt, createdAt) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY), NOW())",
      [reviewToken, params.id, month, "pending"],
    );
    const reviewUrl = `${process.env.APP_URL || url.origin}/review/${reviewToken}`;
    if (client.whatsappGroupId)
      await sendWAMessage(
        client.whatsappGroupId,
        `Planejamento disponÃ­vel: ${reviewUrl}`,
      );
    return ok({ token: reviewToken, url: reviewUrl });
  }

  if (route === "/notify-whatsapp" && method === "POST") {
    const data = await body(req);
    await sendWAMessage(data.to, data.text);
    return ok();
  }

  return null;
}
