import { NextRequest } from "next/server"; import { handleApi } from "../../../../../lib/api-core";
export async function GET(req:NextRequest,{params}:{params:Promise<{clientId:string;month:string}>}){return handleApi("GET","/presentation/[clientId]/[month]",req,await params)}
