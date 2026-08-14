import { NextRequest } from "next/server"; import { handleApi } from "../../../../../../lib/api-core";
export async function POST(req: NextRequest,{params}:{params:Promise<{token:string}>}){return handleApi("POST","/public/review/[token]/pdf-jobs",req,await params)}
