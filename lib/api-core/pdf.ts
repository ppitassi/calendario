import { chromium } from "playwright-core";
import { existsSync } from "fs";

export function resolveChromiumExecutable() {
  const candidates = [
    process.env.CHROMIUM_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ].filter(Boolean) as string[];

  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  return undefined;
}

export function pdfRendererHealth() {
  const browserless=String(process.env.BROWSERLESS_URL||"").trim();
  if(browserless){try{const url=new URL(browserless);return {configured:["ws:","wss:","http:","https:"].includes(url.protocol),mode:"browserless" as const}}catch{return {configured:false,mode:"browserless" as const}}}
  return {configured:Boolean(resolveChromiumExecutable()),mode:"local" as const};
}

export async function renderPdf(url: string, onStage?: (stage:"browser"|"document"|"assets"|"pdf")=>void|Promise<void>): Promise<Buffer> {
  const navigationTimeout=Math.max(10_000,Number(process.env.PDF_RENDER_TIMEOUT_MS||120_000));
  const executablePath = resolveChromiumExecutable();
  const browser = process.env.BROWSERLESS_URL ? await chromium.connectOverCDP(process.env.BROWSERLESS_URL) : await chromium.launch({
    executablePath: executablePath || (() => { throw new Error("CHROMIUM_NOT_CONFIGURED"); })(),
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    await onStage?.("browser");
    const page = await browser.newPage();
    const failedRequests:string[]=[];page.on("requestfailed",request=>{if(failedRequests.length<10)failedRequests.push(new URL(request.url()).pathname)});
    const failedCriticalResponses:string[]=[];page.on("response",response=>{const type=response.request().resourceType();if(response.status()>=400&&(type==="stylesheet"||type==="script")&&failedCriticalResponses.length<10)failedCriticalResponses.push(`${response.status()}:${new URL(response.url()).pathname}`)});
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: navigationTimeout });
    if (!response?.ok()) throw new Error(`PDF_RENDER_HTTP_${response?.status() || 0}`);
    await onStage?.("document");
    await page.waitForSelector('#pdf-render-ready[data-ready="true"]', { state:"attached",timeout: 30000 });
    if(failedCriticalResponses.length)throw new Error(`PDF_CRITICAL_RESOURCE_FAILED:${failedCriticalResponses.join(",")}`);
    const decodeFailures=await page.evaluate(async () => {
      await Promise.race([document.fonts.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error("PDF_FONT_TIMEOUT")),15_000))]);
      const images = Array.from(document.images);
      return Promise.race([Promise.all(images.map(async image => { try{if (!image.complete) await new Promise<void>((resolve, reject) => { image.addEventListener("load", () => resolve(), { once: true }); image.addEventListener("error", () => reject(new Error("load")), { once: true }); }); await image.decode();return null}catch{if(image.dataset.required!=="true"){image.remove();return null}return new URL(image.src).pathname} })),new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error("PDF_MEDIA_TIMEOUT")),30_000))]);
    });
    const requiredFailures=decodeFailures.filter(Boolean);if(requiredFailures.length)throw new Error(`PDF_MEDIA_FAILED:${requiredFailures.join(",")}`);
    await onStage?.("assets");
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" }, preferCSSPageSize: true,
    });
    await onStage?.("pdf");
    return pdf;
  } finally {
    await browser.close();
  }
}
