import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { processNextPdfJob } from "../../../../../lib/presentation-pdf-jobs";
export const runtime = "nodejs"; export const maxDuration = 300;
export async function POST(req: NextRequest) {
  const expected = String(process.env.PDF_WORKER_SECRET || process.env.META_JOB_SECRET || ""), supplied = String(req.headers.get("x-pdf-worker-secret") || "");
  const a=Buffer.from(expected),b=Buffer.from(supplied); if (!expected || a.length!==b.length || !timingSafeEqual(a,b)) return NextResponse.json({ error:"Não autorizado." },{status:401});
  return NextResponse.json({ job: await processNextPdfJob() });
}
