import { NextRequest } from "next/server"; import { handleApi } from "../../../../../../../lib/api-core";
export async function GET(req: NextRequest,{params}:{params:Promise<{token:string;jobId:string}>}){return handleApi("GET","/public/review/[token]/pdf-jobs/[jobId]",req,await params)}
