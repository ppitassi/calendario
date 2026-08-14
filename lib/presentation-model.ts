
export type PresentationMediaState = "ready" | "missing" | "unauthorized" | "failed";
export type PresentationMedia = { url: string | null; assetId: string | null; checksum: string | null; state: PresentationMediaState; required: boolean; ordem: number };
export type PresentationPost = {
  id: string; data: string; formato: "feed" | "story" | "carousel" | "reel";
  titulo: string | null; subtitulo: string | null; legenda: string | null;
  objetivo: string | null; tema: string | null; roteiro: string | null;
  etapaFunil: "topo" | "meio" | "fundo" | null; videoUrl: string | null; midias: PresentationMedia[];
};
export type PresentationViewModel = {
  schemaVersion: 1; cliente: { id: string; nome: string; logoUrl: string | null; logoAssetId: string | null; logoChecksum: string | null; logoState: PresentationMediaState };
  competencia: string; competenciaLabel: string;
  estrategia: { segmento: string | null; tomDeVoz: string | null; publicoAlvo: string | null; colunasDeConteudo: string[]; observacoes: string | null };
  responsaveis: Array<{ nome: string; funcao: string | null }>;
  posts: PresentationPost[]; avisos: string[]; generatedAt: string;
};

const ASSET_RE = /^\/api\/media\/assets\/([^/]+)\/content$/;
export function validMonth(value: string) { return /^\d{4}-(0[1-9]|1[0-2])$/.test(value); }
export function normalizeDate(value: unknown) {
  const result = String(value || "").split("T")[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(result) ? result : null;
}
export function presentationFormat(value: unknown): PresentationPost["formato"] {
  const type = String(value || "").toLowerCase();
  if (type === "reel") return "reel";
  if (type === "carousel") return "carousel";
  if (type === "story") return "story";
  return "feed";
}
export function presentationFormatLabel(value:PresentationPost["formato"]){return value==="carousel"?"Carrossel":value==="story"?"Story":value==="reel"?"Reel":"Feed"}
function text(value: unknown) { const result = String(value || "").trim(); return result || null; }
function safeUrl(value: unknown) { const result=text(value); if(!result)return null; if(result.startsWith("/"))return result; try{const url=new URL(result);return ["http:","https:"].includes(url.protocol)?url.toString():null}catch{return null} }
function media(url: unknown, ordem: number, required = false): PresentationMedia {
  const clean = safeUrl(url); const match = clean?.match(ASSET_RE);
  return { url: clean, assetId: match?.[1] || null, checksum: null, state: clean ? "ready" : "missing", required, ordem };
}
function list(value: unknown): string[] {
  let parsed=value;
  if(typeof value==="string"){try{parsed=JSON.parse(value)}catch{parsed=[]}}
  return Array.isArray(parsed) ? parsed.map(text).filter((item): item is string => Boolean(item)) : [];
}
export function buildPresentationViewModel(data: any): PresentationViewModel {
  if (!data?.client?.id || !text(data.client.name) || !validMonth(String(data?.tokenData?.month || ""))) throw new Error("PRESENTATION_DATA_INVALID");
  const month = String(data.tokenData.month);
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`));
  const warnings: string[] = [];
  const posts = (Array.isArray(data.posts) ? data.posts : []).map((post: any): PresentationPost | null => {
    const date = normalizeDate(post.date);
    if (!post.id || !date || !date.startsWith(month)) { warnings.push(`Post inválido ignorado: ${String(post.id || "sem identificador")}`); return null; }
    const rawUrls = list(post.feedImages);
    for (const extra of [post.coverImage, post.linkedinCover, post.storyImage]) { const value = text(extra); if (value && !rawUrls.includes(value)) rawUrls.push(value); }
    const urls=rawUrls.map(safeUrl).filter((url):url is string=>Boolean(url));
    if(urls.length!==rawUrls.length)warnings.push(`Post ${post.id}: mídia com URL inválida ignorada.`);
    return {
      id: String(post.id), data: date, formato: presentationFormat(post.type),
      titulo: text(post.head) || text(post.artHeadline) || text(post.title), subtitulo: text(post.subhead) || text(post.subtitle),
      legenda: text(post.caption), objetivo: text(post.objective), tema: text(post.theme), roteiro: text(post.script),
      etapaFunil: ["topo", "meio", "fundo"].includes(String(post.funnelStage)) ? post.funnelStage : null, videoUrl: safeUrl(post.videoUrl),
      midias: urls.map((url, index) => media(url, index + 1, true)),
    };
  }).filter((post: PresentationPost | null): post is PresentationPost => Boolean(post));
  posts.sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id, "pt-BR", { numeric: true }));
  return {
    schemaVersion: 1,
    cliente: { id: String(data.client.id), nome: text(data.client.name)!, logoUrl: safeUrl(data.client.logoUrl), logoAssetId:safeUrl(data.client.logoUrl)?.match(ASSET_RE)?.[1]||null,logoChecksum:null,logoState:safeUrl(data.client.logoUrl)?"ready":"missing" },
    competencia: month, competenciaLabel: label,
    estrategia: { segmento: text(data.client.segment), tomDeVoz: text(data.client.voiceTone), publicoAlvo: text(data.client.targetAudience), colunasDeConteudo: list(data.client.contentColumns), observacoes: text(data.client.brandNotes) },
    responsaveis: (Array.isArray(data.owners) ? data.owners : []).map((owner: any) => ({ nome: text(owner.displayName), funcao: text(owner.role) })).filter((owner: any) => owner.nome),
    posts, avisos: warnings, generatedAt: new Date().toISOString(),
  };
}
export function stablePresentationPayload(model:PresentationViewModel){const{generatedAt:_generatedAt,...stable}=model;return stable}
export function presentationMetrics(model:PresentationViewModel){
  const total=model.posts.length;const formats={feed:0,story:0,carousel:0,reel:0};const funnel={topo:0,meio:0,fundo:0};
  for(const post of model.posts){formats[post.formato]+=1;if(post.etapaFunil)funnel[post.etapaFunil]+=1}
  const percent=(value:number,base:number)=>base?Math.round(value/base*100):0;const funnelTotal=funnel.topo+funnel.meio+funnel.fundo;
  return{total,formats,formatPercent:{feed:percent(formats.feed,total),story:percent(formats.story,total),carousel:percent(formats.carousel,total),reel:percent(formats.reel,total)},funnel,funnelPercent:{topo:percent(funnel.topo,funnelTotal),meio:percent(funnel.meio,funnelTotal),fundo:percent(funnel.fundo,funnelTotal)}};
}
