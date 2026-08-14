require("dotenv").config({ path: ".env.local" });
const origin=String(process.env.INTERNAL_APP_URL||"http://127.0.0.1:3006").replace(/\/$/,"");
const secret=process.env.PDF_WORKER_SECRET||process.env.META_JOB_SECRET;
if(!secret){ console.error("PDF_WORKER_SECRET não configurado."); process.exit(1); }
let stopped=false; process.on("SIGTERM",()=>{stopped=true}); process.on("SIGINT",()=>{stopped=true});
async function tick(){try{const response=await fetch(`${origin}/api/internal/presentation-pdf/run`,{method:"POST",headers:{"x-pdf-worker-secret":secret}});if(!response.ok)console.error("Falha no worker PDF:",response.status);else{const data=await response.json();if(data.job)console.log("PDF processado:",data.job.id,data.job.status)}}catch(error){console.error("Worker PDF indisponível:",error.message)}}
(async()=>{while(!stopped){await tick();await new Promise(resolve=>setTimeout(resolve,5000))}})();
