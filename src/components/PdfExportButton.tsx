import { useEffect, useState } from "react";
import { FileDown, RotateCcw } from "lucide-react";
import { Button } from "./ui/Button/Button";

export function PdfExportButton({ onExport, compact = false }: { onExport: () => Promise<void>; compact?: boolean }) {
  const [state,setState]=useState<"idle"|"running"|"failed">("idle"); const [progress,setProgress]=useState(0); const [error,setError]=useState("");
  useEffect(()=>{const listener=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.progress!==undefined)setProgress(Number(detail.progress)||0)};window.addEventListener("pdf-job-progress",listener);return()=>window.removeEventListener("pdf-job-progress",listener)},[]);
  const run=async()=>{if(state==="running")return;setState("running");setProgress(0);setError("");try{await onExport();setState("idle");setProgress(100)}catch(cause){setState("failed");setError(cause instanceof Error?cause.message:"Não foi possível gerar o PDF.")}};
  return <div className="relative"><Button type="button" onClick={run} loading={state==="running"} title={error||undefined} size={compact?"small":"medium"} variant="secondary" icon={state==="failed"?<RotateCcw/>:<FileDown/>}>{state==="running"?`Gerando ${progress}%`:state==="failed"?"Tentar novamente":"Exportar PDF"}</Button>{error?<span role="alert" className="absolute right-0 top-full mt-2 w-64">{error}</span>:null}</div>;
}
