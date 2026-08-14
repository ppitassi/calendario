import { exec, parseJson, rows } from "../db";
import { decryptSecret } from "../secret-box";

const apiVersion = () => process.env.META_GRAPH_VERSION || "v22.0";
const graphUrl = (path: string) => `https://graph.facebook.com/${apiVersion()}/${path.replace(/^\//, "")}`;

async function graph(path: string, token: string, init: RequestInit = {}, timeoutMs = 25_000) {
  const url = new URL(graphUrl(path));
  if ((init.method || "GET") === "GET") url.searchParams.set("access_token", token);
  const response = await fetch(url, { ...init, headers: init.body ? { "content-type": "application/x-www-form-urlencoded", ...init.headers } : init.headers, signal: AbortSignal.timeout(timeoutMs) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) throw new Error(data?.error?.message || "Falha na comunicação com a Meta.");
  return data;
}

function form(values: Record<string, unknown>) {
  const result = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => value !== null && value !== undefined && result.set(key, String(value)));
  return result;
}

export async function disconnectMeta(clientId: string) {
  await exec(`UPDATE clients SET meta_access_token = NULL, facebook_page_id = NULL, meta_account_id = NULL, meta_page_name = NULL, meta_ig_username = NULL, meta_connection_status = 'disconnected', meta_last_error = NULL WHERE id = ?`, [clientId]);
}

function mediaUrl(value: string) {
  if (/^https:\/\//i.test(value || "")) return value;
  if (!process.env.APP_URL || !/^https:\/\//i.test(process.env.APP_URL)) throw new Error("META_REQUIRES_PUBLIC_HTTPS_URL");
  return new URL(value, process.env.APP_URL).toString();
}

async function publishInstagram(post: any, token: string) {
  const images = Array.isArray(post.feedImages) ? post.feedImages : parseJson(post.feedImages, []);
  const caption = [post.caption || post.subtitle || "", post.hashtags || ""].filter(Boolean).join("\n\n").slice(0, 2200);
  let creationId = "";
  if (post.videoUrl) {
    creationId = (await graph(`/${post.meta_account_id}/media`, token, { method: "POST", body: form({ media_type: "REELS", video_url: mediaUrl(post.videoUrl), caption }) })).id;
    for (let attempt = 0; attempt < 12; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      const status = await graph(`/${creationId}?fields=status_code,status`, token);
      if (status.status_code === "FINISHED") break;
      if (status.status_code === "ERROR" || attempt === 11) throw new Error(status.status || "A Meta não concluiu o vídeo.");
    }
  } else if (images.length > 1) {
    const children: string[] = [];
    for (const image of images.slice(0, 10)) children.push((await graph(`/${post.meta_account_id}/media`, token, { method: "POST", body: form({ image_url: mediaUrl(typeof image === "string" ? image : image.url), is_carousel_item: true }) })).id);
    creationId = (await graph(`/${post.meta_account_id}/media`, token, { method: "POST", body: form({ media_type: "CAROUSEL", children: children.join(","), caption }) })).id;
  } else {
    if (!images[0]) throw new Error("POST_WITHOUT_MEDIA");
    creationId = (await graph(`/${post.meta_account_id}/media`, token, { method: "POST", body: form({ image_url: mediaUrl(typeof images[0] === "string" ? images[0] : images[0].url), caption }) })).id;
  }
  return (await graph(`/${post.meta_account_id}/media_publish`, token, { method: "POST", body: form({ creation_id: creationId }) })).id;
}

async function publishFacebook(post: any, token: string) {
  if (!post.facebook_page_id) throw new Error("FACEBOOK_PAGE_NOT_CONNECTED");
  const images = Array.isArray(post.feedImages) ? post.feedImages : parseJson(post.feedImages, []);
  const message = [post.caption || post.subtitle || "", post.hashtags || ""].filter(Boolean).join("\n\n");
  if (post.videoUrl) return (await graph(`/${post.facebook_page_id}/videos`, token, { method: "POST", body: form({ file_url: mediaUrl(post.videoUrl), description: message }) })).id;
  if (images[0]) { const result = await graph(`/${post.facebook_page_id}/photos`, token, { method: "POST", body: form({ url: mediaUrl(typeof images[0] === "string" ? images[0] : images[0].url), caption: message }) }); return result.post_id || result.id; }
  return (await graph(`/${post.facebook_page_id}/feed`, token, { method: "POST", body: form({ message }) })).id;
}

export async function enqueueMetaPublication(input: { postId: number; scheduledFor?: string; platform?: string }) {
  const post = (await rows("SELECT p.*, c.meta_access_token FROM posts p JOIN clients c ON c.id = p.clientId WHERE p.id = ? LIMIT 1", [input.postId]))[0];
  if (!post) throw new Error("POST_NOT_FOUND");
  if (!post.meta_access_token) throw new Error("META_NOT_CONNECTED");
  if (!["aprovado", "approved", "concluido", "concluído"].includes(String(post.status || "").toLowerCase())) throw new Error("POST_NOT_APPROVED");
  const platform = input.platform || (/facebook/i.test(post.channel || "") ? "facebook" : "instagram");
  const scheduled = input.scheduledFor && !Number.isNaN(new Date(input.scheduledFor).getTime()) ? new Date(input.scheduledFor) : new Date();
  const result = await exec(`INSERT INTO publication_jobs (post_id, client_id, platform, scheduled_for, status, next_attempt_at) VALUES (?, ?, ?, ?, 'queued', ?)`, [post.id, post.clientId, platform, scheduled, scheduled]);
  return { id: result.insertId, queued: true, scheduledFor: scheduled.toISOString() };
}

export async function processMetaJobs(limit = 3) {
  const jobs = await rows(`SELECT * FROM publication_jobs WHERE status IN ('queued','retry') AND next_attempt_at <= NOW() AND attempts < 5 ORDER BY scheduled_for ASC LIMIT ?`, [Math.max(1, Math.min(limit, 10))]);
  const results: any[] = [];
  for (const job of jobs) {
    const claimed = await exec(`UPDATE publication_jobs SET status = 'processing', attempts = attempts + 1 WHERE id = ? AND status IN ('queued','retry')`, [job.id]);
    if (!claimed.affectedRows) continue;
    try {
      const post = (await rows("SELECT p.*, c.meta_access_token, c.meta_account_id, c.facebook_page_id FROM posts p JOIN clients c ON c.id = p.clientId WHERE p.id = ? LIMIT 1", [job.post_id]))[0];
      if (!post?.meta_access_token) throw new Error("META_NOT_CONNECTED");
      const token = decryptSecret(post.meta_access_token);
      const externalId = job.platform === "facebook" ? await publishFacebook(post, token) : await publishInstagram(post, token);
      await exec(`UPDATE publication_jobs SET status = 'published', external_id = ?, published_at = NOW(), error = NULL WHERE id = ?`, [externalId, job.id]);
      results.push({ id: job.id, status: "published", externalId });
    } catch (error: any) {
      const final = Number(job.attempts) + 1 >= 5;
      await exec(`UPDATE publication_jobs SET status = ?, error = ?, next_attempt_at = DATE_ADD(NOW(), INTERVAL POW(2, attempts) MINUTE) WHERE id = ?`, [final ? "failed" : "retry", String(error.message || "Falha na publicação").slice(0, 1000), job.id]);
      results.push({ id: job.id, status: final ? "failed" : "retry" });
    }
  }
  return results;
}
