import { NextRequest } from "next/server";
import { handleWorkItems } from "../../../../lib/work-items";
export const runtime = "nodejs";
type Context={params:Promise<{path?:string[]}>};
async function call(req:NextRequest,ctx:Context,method:string){const {path=[]}=await ctx.params;return handleWorkItems(req,path,method);}
export const GET=(req:NextRequest,ctx:Context)=>call(req,ctx,"GET");
export const POST=(req:NextRequest,ctx:Context)=>call(req,ctx,"POST");
export const PATCH=(req:NextRequest,ctx:Context)=>call(req,ctx,"PATCH");
export const PUT=(req:NextRequest,ctx:Context)=>call(req,ctx,"PUT");
export const DELETE=(req:NextRequest,ctx:Context)=>call(req,ctx,"DELETE");
