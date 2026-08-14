import {NextRequest,NextResponse} from "next/server";
import {getContext} from "../../../../../lib/api-core/context";
import {getDbPool} from "../../../../../lib/db";
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){const context=await getContext(req);if(!context.isAuthenticated)return NextResponse.json({error:"Não autenticado."},{status:401});const{id}=await params;await getDbPool().query("UPDATE clients SET active=TRUE,archived_at=NULL WHERE id=?",[id]);await getDbPool().query("INSERT INTO audit_logs (actor_id,event_type,entity_type,entity_id) VALUES (?,'CLIENT_RESTORED','CLIENT',?)",[context.userUid,id]);return NextResponse.json({success:true});}
