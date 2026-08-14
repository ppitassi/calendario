import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { exec, getDbPool, rows } from "./db";
import { buildPresentationViewModel, stablePresentationPayload, PresentationViewModel } from "./presentation-model";
import { getPresentationData, getReviewData, isReviewDataError } from "./review-data";
import { renderPdf } from "./api-core/pdf";
import { deleteStoredAsset, storeAssetBuffer } from "./storage";

export const PDF_RENDERER_VERSION = "2.5.0";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export function presentationDigest(model: PresentationViewModel) { return hash(JSON.stringify(stablePresentationPayload(model))); }
export function safePdfError(error: unknown) {
  const code = error instanceof Error ? error.message : String(error);
  if(code.startsWith("PDF_REQUIRED_MEDIA_MISSING:"))return `Mídias obrigatórias indisponíveis: ${code.slice(code.indexOf(":")+1).slice(0,350)}`;
  if(code.includes("PDF_MEDIA_FAILED"))return "Uma ou mais mídias não puderam ser carregadas durante a exportação.";
  if(code.includes("PDF_MEDIA_TIMEOUT"))return "O carregamento das mídias excedeu o tempo permitido.";
  if(code.includes("PDF_CRITICAL_RESOURCE_FAILED"))return "Os estilos ou scripts da apresentação não carregaram por completo.";
  if(code.includes("PDF_PAGE_COUNT_INVALID"))return "O PDF gerado ficou incompleto e foi rejeitado antes da gravação.";
  if(code.includes("waitForSelector"))return "A apresentação não sinalizou que estava pronta para exportação.";
  const known: Record<string, string> = { CHROMIUM_NOT_CONFIGURED: "O serviço de PDF não está configurado.", PRESENTATION_DATA_INVALID: "Os dados da apresentação são inválidos.", PDF_RENDER_NOT_READY: "A apresentação não terminou de carregar." };
  return (known[code] || "Não foi possível gerar o PDF.").slice(0, 500);
}
export async function resolvePresentationMedia(model: PresentationViewModel) {
  const ids=Array.from(new Set([...model.posts.flatMap(post=>post.midias.map(item=>item.assetId).filter((id):id is string=>Boolean(id))),...(model.cliente.logoAssetId?[model.cliente.logoAssetId]:[])]));
  const configuredOrigins=[process.env.APP_URL,process.env.INTERNAL_APP_URL,process.env.NEXTCLOUD_PUBLIC_BASE_URL,...String(process.env.PDF_MEDIA_ALLOWED_ORIGINS||"").split(",")].filter(Boolean).flatMap(value=>{try{return[new URL(String(value)).origin]}catch{return[]}});
  const allowed=(url:string|null)=>{if(!url)return false;if(url.startsWith("/"))return true;try{return configuredOrigins.includes(new URL(url).origin)}catch{return false}};
  const localExists=async(url:string|null)=>{if(!url?.startsWith("/"))return true;const origin=String(process.env.INTERNAL_APP_URL||process.env.APP_URL||"").replace(/\/$/,"");if(!origin)return false;try{const response=await fetch(`${origin}${url}`,{method:"HEAD",signal:AbortSignal.timeout(5000),redirect:"manual"});return response.ok}catch{return false}};
  for(const post of model.posts)for(const item of post.midias)if(!item.assetId&&item.url&&!allowed(item.url))item.state="unauthorized";
  if(model.cliente.logoUrl&&!model.cliente.logoAssetId&&!allowed(model.cliente.logoUrl))model.cliente.logoState="unauthorized";
  for(const post of model.posts)for(const item of post.midias)if(!item.assetId&&item.url?.startsWith("/")&&!(await localExists(item.url)))item.state="missing";
  if(model.cliente.logoUrl&&!model.cliente.logoAssetId&&model.cliente.logoUrl.startsWith("/")&&!(await localExists(model.cliente.logoUrl)))model.cliente.logoState="missing";
  if(!ids.length)return;
  const assets=await rows("SELECT id,COALESCE(sha256,checksum) checksum,status FROM media_assets WHERE id IN (?)",[ids]);
  const byId=new Map(assets.map(asset=>[String(asset.id),asset]));
  for(const post of model.posts)for(const item of post.midias)if(item.assetId){const asset=byId.get(item.assetId);item.checksum=asset?.checksum?String(asset.checksum):null;item.state=asset?.status==="active"?"ready":"missing";}
  if(model.cliente.logoAssetId){const asset=byId.get(model.cliente.logoAssetId);model.cliente.logoChecksum=asset?.checksum?String(asset.checksum):null;model.cliente.logoState=asset?.status==="active"?"ready":"missing"}
}
export async function createPdfJob(input: { clientId: string; month: string; userUid?: string | null; reviewToken?: string | null }) {
  const raw = input.reviewToken ? await getReviewData(input.reviewToken) : await getPresentationData(input.clientId, input.month);
  if (isReviewDataError(raw)) throw Object.assign(new Error(raw.error), { status: raw.status });
  const model = buildPresentationViewModel(raw);
  await resolvePresentationMedia(model);
  if (input.reviewToken) model.responsaveis = [];
  const source = input.reviewToken ? "review" : "internal";
  const modelDigest=presentationDigest(model);const digest=input.reviewToken?hash(`${modelDigest}:${input.reviewToken}`):modelDigest;
  const existing = await rows(`SELECT j.id jobId,j.snapshotId,j.status,j.progress,s.version FROM presentation_pdf_jobs j JOIN presentation_snapshots s ON s.id=j.snapshotId
    WHERE s.clientId=? AND s.month=? AND s.sourceType=? AND s.contentHash=? AND j.rendererVersion=? AND j.status IN ('queued','processing','ready') ORDER BY j.createdAt DESC LIMIT 1`,
    [input.clientId, input.month, source, digest, PDF_RENDERER_VERSION]);
  const approved=raw.tokenData?.status === "approved";
  if (existing[0]) {if(approved)await exec("UPDATE presentation_snapshots s JOIN presentation_pdf_jobs j ON j.snapshotId=s.id SET s.approvalStatus='approved',j.expiresAt=NULL WHERE j.id=?",[existing[0].jobId]);return existing[0]}
  const connection=await getDbPool().getConnection();const lockName=`pdf:${hash(`${input.clientId}:${input.month}:${source}`).slice(0,48)}`;
  try{
    const [locks]:any=await connection.query("SELECT GET_LOCK(?,10) acquired",[lockName]);if(Number(locks[0]?.acquired)!==1)throw new Error("PDF_SNAPSHOT_LOCK_TIMEOUT");
    const [rechecked]:any=await connection.query(`SELECT j.id jobId,j.snapshotId,j.status,j.progress,s.version FROM presentation_pdf_jobs j JOIN presentation_snapshots s ON s.id=j.snapshotId WHERE s.clientId=? AND s.month=? AND s.sourceType=? AND s.contentHash=? AND j.rendererVersion=? AND j.status IN ('queued','processing','ready') ORDER BY j.createdAt DESC LIMIT 1`,[input.clientId,input.month,source,digest,PDF_RENDERER_VERSION]);
    if(rechecked[0]){if(approved)await connection.query("UPDATE presentation_snapshots s JOIN presentation_pdf_jobs j ON j.snapshotId=s.id SET s.approvalStatus='approved',j.expiresAt=NULL WHERE j.id=?",[rechecked[0].jobId]);return rechecked[0]}
    await connection.beginTransaction();
    const [snapshots]:any=await connection.query("SELECT id,version FROM presentation_snapshots WHERE clientId=? AND month=? AND sourceType=? AND contentHash=? LIMIT 1",[input.clientId,input.month,source,digest]);
    let snapshotId=String(snapshots[0]?.id||""),version=Number(snapshots[0]?.version||0);const jobId=randomUUID();
    if(!snapshotId){const [latest]:any=await connection.query("SELECT COALESCE(MAX(version),0) version FROM presentation_snapshots WHERE clientId=? AND month=? AND sourceType=?",[input.clientId,input.month,source]);snapshotId=randomUUID();version=Number(latest[0]?.version||0)+1;await connection.query(`INSERT INTO presentation_snapshots (id,clientId,month,version,sourceType,sourceTokenId,contentHash,payload,createdByUserId,approvalStatus) VALUES (?,?,?,?,?,?,?,?,?,?)`,[snapshotId,input.clientId,input.month,version,source,input.reviewToken||null,digest,JSON.stringify(model),input.userUid||null,approved?"approved":"draft"])}else if(approved){await connection.query("UPDATE presentation_snapshots SET approvalStatus='approved' WHERE id=?",[snapshotId])}
    await connection.query(`INSERT INTO presentation_pdf_jobs (id,snapshotId,requestedByUserId,reviewTokenId,status,progress,rendererVersion,expiresAt) VALUES (?,?,?,?, 'queued',0,?,IF(?,NULL,DATE_ADD(NOW(),INTERVAL ? DAY)))`,[jobId,snapshotId,input.userUid||null,input.reviewToken||null,PDF_RENDERER_VERSION,approved?1:0,Math.max(1,Number(process.env.PDF_DRAFT_RETENTION_DAYS||30))]);
    await connection.commit();return{jobId,snapshotId,status:"queued",progress:0,version};
  }catch(error){await connection.rollback().catch(()=>undefined);throw error}finally{await connection.query("SELECT RELEASE_LOCK(?)",[lockName]).catch(()=>undefined);connection.release()}
}
export async function pdfJob(jobId: string) { return (await rows(`SELECT j.*,s.clientId,s.month,s.version,s.sourceType FROM presentation_pdf_jobs j JOIN presentation_snapshots s ON s.id=j.snapshotId WHERE j.id=? LIMIT 1`, [jobId]))[0] || null; }
export async function snapshotModel(snapshotId: string): Promise<PresentationViewModel | null> { const item = (await rows("SELECT payload FROM presentation_snapshots WHERE id=? LIMIT 1", [snapshotId]))[0]; return item ? (typeof item.payload === "string" ? JSON.parse(item.payload) : item.payload) : null; }
export function validRenderToken(job: any, token: string) {
  if (!job?.renderTokenHash || !token || new Date(job.renderTokenExpiresAt).getTime() < Date.now()) return false;
  const a = Buffer.from(job.renderTokenHash, "hex"), b = Buffer.from(hash(token), "hex"); return a.length === b.length && timingSafeEqual(a, b);
}
export async function maintainPdfJobs() {
  const expired=await rows("SELECT id,outputProvider,outputStorageKey FROM presentation_pdf_jobs WHERE status='ready' AND expiresAt IS NOT NULL AND expiresAt<=NOW() ORDER BY expiresAt LIMIT 5");
  for(const job of expired){try{if(job.outputProvider&&job.outputStorageKey)await deleteStoredAsset(String(job.outputProvider),String(job.outputStorageKey));await exec("UPDATE presentation_pdf_jobs SET status='expired',progress=0,outputUrl=NULL,outputStorageKey=NULL WHERE id=? AND status='ready'",[job.id])}catch(error){console.error("[pdf-retention]",{jobId:job.id,message:error instanceof Error?error.message:String(error)})}}
  return expired.length;
}
export async function processNextPdfJob() {
  await maintainPdfJobs();
  const candidates = await rows("SELECT id,status FROM presentation_pdf_jobs WHERE (status='queued' AND availableAt<=NOW()) OR (status='processing' AND startedAt<DATE_SUB(NOW(),INTERVAL 10 MINUTE)) ORDER BY createdAt LIMIT 1");
  if (!candidates[0]) return null;
  const id = String(candidates[0].id);
  const maxAttempts=Math.max(1,Number(process.env.PDF_JOB_MAX_ATTEMPTS||3));
  const claimed: any = await exec("UPDATE presentation_pdf_jobs SET status='processing',progress=10,attempts=attempts+1,startedAt=NOW(),lastError=NULL WHERE id=? AND attempts<? AND ((status='queued' AND availableAt<=NOW()) OR (status='processing' AND startedAt<DATE_SUB(NOW(),INTERVAL 10 MINUTE)))", [id,maxAttempts]);
  if (!claimed.affectedRows) return null;
  const token = randomBytes(32).toString("hex");
  await exec("UPDATE presentation_pdf_jobs SET renderTokenHash=?,renderTokenExpiresAt=DATE_ADD(NOW(),INTERVAL 5 MINUTE),progress=25 WHERE id=?", [hash(token), id]);
  try {
    const claimedJob=await pdfJob(id); const claimedModel=await snapshotModel(claimedJob.snapshotId); const missing=claimedModel?.posts.flatMap(post=>post.midias.filter(item=>item.required&&item.state!=="ready").map(item=>`${post.id}/peça-${item.ordem}`))||[];
    if(missing.length)throw new Error(`PDF_REQUIRED_MEDIA_MISSING:${missing.join(", ")}`);
    const origin = String(process.env.INTERNAL_APP_URL || process.env.APP_URL || "").replace(/\/$/, ""); if (!origin) throw new Error("PDF_APP_URL_NOT_CONFIGURED");
    const progressByStage={browser:35,document:45,assets:60,pdf:70} as const;
    const pdf = await renderPdf(`${origin}/presentation/render/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`,async stage=>{await exec("UPDATE presentation_pdf_jobs SET progress=? WHERE id=? AND status='processing'",[progressByStage[stage],id])});
    const checksum = createHash("sha256").update(pdf).digest("hex"); const job = await pdfJob(id); const model = await snapshotModel(job.snapshotId);
    const pageCount=Math.max(1,(pdf.toString("latin1").match(/\/Type\s*\/Page\b/g)||[]).length);const minimumPages=(model?.posts.length||0)+3;if(pageCount<minimumPages)throw new Error(`PDF_PAGE_COUNT_INVALID:${pageCount}/${minimumPages}`);
    const name = `Planejamento - ${model?.cliente.nome || "Cliente"} - ${model?.competenciaLabel || job.month} - versão ${job.version}.pdf`;
    const stored = await storeAssetBuffer({ buffer: pdf, folder: "pdfs", fileName: name, mimeType: "application/pdf" });
    await exec("UPDATE presentation_pdf_jobs SET status='ready',progress=100,outputUrl=?,outputProvider=?,outputStorageKey=?,outputChecksum=?,outputSize=?,pageCount=?,warnings=?,completedAt=NOW(),renderTokenHash=NULL WHERE id=?", [stored.url, stored.provider, stored.storageKey, checksum, pdf.length,pageCount,JSON.stringify(model?.avisos||[]), id]);
    return { id, status: "ready" };
  } catch (error) {
    console.error("[presentation-pdf]",{jobId:id,code:error instanceof Error?error.message:String(error)});
    const job = await pdfJob(id); const retry = Number(job?.attempts || 0) < maxAttempts;
    await exec(`UPDATE presentation_pdf_jobs SET status=?,progress=0,lastError=?,renderTokenHash=NULL,availableAt=IF(?,DATE_ADD(NOW(),INTERVAL attempts MINUTE),availableAt) WHERE id=?`, [retry ? "queued" : "failed", safePdfError(error), retry ? 1 : 0, id]);
    return { id, status: retry ? "queued" : "failed" };
  }
}
