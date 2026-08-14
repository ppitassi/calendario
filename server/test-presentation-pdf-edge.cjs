require("dotenv").config({ path: ".env.local", quiet: true });
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const mysql = require("mysql2/promise");

const dbConfig = process.env.DATABASE_URL || { host: process.env.DB_HOST || "127.0.0.1", port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME };
const base = String(process.env.INTERNAL_APP_URL || process.env.APP_URL || "http://127.0.0.1:3006").replace(/\/$/, "");
async function images(dir) { const result=[];for(const entry of await fs.readdir(dir,{withFileTypes:true})){const target=path.join(dir,entry.name);if(entry.isDirectory())result.push(...await images(target));else if(/\.(png|jpe?g|webp)$/i.test(entry.name))result.push(target)}return result }
async function runWorker(){const response=await fetch(`${base}/api/internal/presentation-pdf/run`,{method:"POST",headers:{"x-pdf-worker-secret":process.env.PDF_WORKER_SECRET||process.env.META_JOB_SECRET}});assert.ok(response.ok,`Worker retornou ${response.status}`)}
async function main(){
  const db=await mysql.createConnection(dbConfig);const snapshotId=crypto.randomUUID(),jobId=crypto.randomUUID();let outputPath=null;
  try{
    const [sources]=await db.query("SELECT s.payload,s.clientId,s.month,j.requestedByUserId FROM presentation_snapshots s JOIN presentation_pdf_jobs j ON j.snapshotId=s.id WHERE s.sourceType='internal' AND j.status='ready' ORDER BY j.completedAt DESC LIMIT 1");assert.ok(sources[0]);
    const model=typeof sources[0].payload==="string"?JSON.parse(sources[0].payload):sources[0].payload;const available=await images(path.join(process.cwd(),"public"));assert.ok(available.length>=2,"São necessárias duas imagens públicas para o teste de carrossel.");
    const urls=available.slice(0,2).map(file=>"/"+path.relative(path.join(process.cwd(),"public"),file).split(path.sep).map(encodeURIComponent).join("/"));const ending="FIM-DA-LEGENDA-LONGA";const caption=("Este é um parágrafo persistido para validar a quebra segura de uma legenda extensa no documento A4. ".repeat(450))+ending;
    model.generatedAt=new Date().toISOString();model.posts=[{id:"edge-carousel",data:`${sources[0].month}-01`,formato:"carousel",titulo:"Carrossel de validação",subtitulo:null,legenda:caption,objetivo:null,tema:null,roteiro:null,etapaFunil:null,videoUrl:null,midias:urls.map((url,index)=>({url,assetId:null,checksum:null,state:"ready",required:true,ordem:index+1}))}];
    await db.query("INSERT INTO presentation_snapshots (id,clientId,month,version,sourceType,contentHash,payload,createdByUserId,approvalStatus) VALUES (?,?,?,999997,'internal',?,?,?,'draft')",[snapshotId,sources[0].clientId,sources[0].month,crypto.randomBytes(32).toString("hex"),JSON.stringify(model),sources[0].requestedByUserId]);
    await db.query("INSERT INTO presentation_pdf_jobs (id,snapshotId,requestedByUserId,status,progress,rendererVersion,availableAt,expiresAt) VALUES (?,?,?,'queued',0,'edge-test',NOW(),DATE_ADD(NOW(),INTERVAL 1 DAY))",[jobId,snapshotId,sources[0].requestedByUserId]);
    let job;for(let attempt=0;attempt<80;attempt++){await runWorker();const [rows]=await db.query("SELECT * FROM presentation_pdf_jobs WHERE id=?",[jobId]);job=rows[0];if(["ready","failed"].includes(job.status))break;await new Promise(resolve=>setTimeout(resolve,500))}assert.equal(job.status,"ready",job.lastError||"PDF de borda não ficou pronto.");assert.ok(Number(job.pageCount)>4,"Legenda extensa não criou páginas de continuação.");
    outputPath=path.resolve(process.env.UPLOAD_STORAGE_ROOT,...String(job.outputStorageKey).split("/"));const relative=path.relative(path.resolve(process.env.UPLOAD_STORAGE_ROOT),outputPath);assert.ok(!relative.startsWith("..")&&!path.isAbsolute(relative));const temp=await fs.mkdtemp(path.join(os.tmpdir(),"pdf-edge-"));try{const textFile=path.join(temp,"document.txt");const extracted=spawnSync("pdftotext",[outputPath,textFile],{encoding:"utf8"});assert.equal(extracted.status,0,extracted.stderr);const text=await fs.readFile(textFile,"utf8");assert.match(text,/Peça 1 de 2/);assert.match(text,/Peça 2 de 2/);assert.match(text,/FIM-DA-LEGENDA-LONGA/)}finally{await fs.rm(temp,{recursive:true,force:true})}
    console.log(JSON.stringify({ok:true,longCaption:true,carouselItems:2,pages:Number(job.pageCount)}));
  } finally {
    const [rows]=await db.query("SELECT status FROM presentation_pdf_jobs WHERE id=?",[jobId]);if(rows[0]?.status==="ready"){await db.query("UPDATE presentation_pdf_jobs SET expiresAt=DATE_SUB(NOW(),INTERVAL 1 MINUTE) WHERE id=?",[jobId]);await runWorker().catch(()=>undefined)}
    await db.query("DELETE FROM presentation_pdf_jobs WHERE id=?",[jobId]);await db.query("DELETE FROM presentation_snapshots WHERE id=?",[snapshotId]);await db.end();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1});
