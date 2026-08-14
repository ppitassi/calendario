import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { exec, parseJson, rows } from "./db";
import { ApiContext, ApiParams } from "./api-types";
import { err, ok } from "./api-response";
import { body } from "./api-core/context";

export function clientOwnerIds(value: unknown): string[] { const parsed=Array.isArray(value)?value:parseJson(value,[]);return Array.isArray(parsed)?parsed.map(String).filter(Boolean):[]; }
function legacyClient(row:any,members:any[]=[]){const strategy=parseJson(row.strategy_json,{});const integrations=parseJson(row.integrations_json,{});return {id:row.id,name:row.name,displayName:row.display_name,slug:row.slug,active:Boolean(row.active),logoUrl:row.logo_url,segment:row.segment,owners:members.map((member)=>member.user_id),...strategy,...integrations,config:strategy.config||{},socialLinks:strategy.socialLinks||{},instagramStats:strategy.instagramStats||{},createdAt:row.created_at};}
export function publicClient(client:any){return legacyClient(client,client.members||[]);}
const slugify=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,180)||randomUUID();

export async function handleClientsApi(method:string,route:string,req:NextRequest,params:ApiParams,ctx:ApiContext,_removeAsset:(url:string)=>Promise<void>):Promise<NextResponse|null>{
  if(route==="/clients"&&method==="GET"){
    const unrestricted=ctx.userRole==="admin"||ctx.permissions.has("CLIENT_EDIT");
    const clients=await rows(`SELECT DISTINCT c.* FROM clients c LEFT JOIN client_members cm ON cm.client_id=c.id AND cm.removed_at IS NULL LEFT JOIN work_items w ON w.client_id=c.id AND w.deleted_at IS NULL LEFT JOIN work_item_assignees a ON a.work_item_id=w.id AND a.removed_at IS NULL WHERE c.archived_at IS NULL AND (?=1 OR cm.user_id=? OR a.user_id=?) ORDER BY c.display_name`,[unrestricted?1:0,ctx.userUid,ctx.userUid]);
    return ok(await Promise.all(clients.map(async(client)=>legacyClient(client,await rows("SELECT user_id,role,is_primary FROM client_members WHERE client_id=? AND removed_at IS NULL",[client.id])))));
  }
  if(route==="/clients"&&method==="POST"){
    const input=await body(req);const name=String(input.name||input.displayName||"").trim();if(!name)return err("Nome do cliente obrigatório.",422);
    const id=String(input.id||randomUUID());const existing=(await rows("SELECT id FROM clients WHERE id=?",[id]))[0];
    const known=new Set(["id","name","displayName","slug","active","logoUrl","segment","owners","primaryAccountManagerId","integrations"]);const strategy=Object.fromEntries(Object.entries(input).filter(([key])=>!known.has(key)));
    let slug=String(input.slug||slugify(name));const collision=(await rows("SELECT id FROM clients WHERE slug=? AND id<>?",[slug,id]))[0];if(collision)slug=`${slug}-${id.slice(0,8)}`;
    if(existing)await exec("UPDATE clients SET name=?,display_name=?,slug=?,active=?,logo_url=?,segment=?,primary_account_manager_id=?,strategy_json=?,integrations_json=? WHERE id=?",[name,String(input.displayName||name),slug,input.active!==false,input.logoUrl||null,input.segment||null,input.primaryAccountManagerId||null,JSON.stringify(strategy),JSON.stringify(input.integrations||{}),id]);
    else await exec("INSERT INTO clients (id,name,display_name,slug,active,logo_url,segment,primary_account_manager_id,strategy_json,integrations_json) VALUES (?,?,?,?,?,?,?,?,?,?)",[id,name,String(input.displayName||name),slug,input.active!==false,input.logoUrl||null,input.segment||null,input.primaryAccountManagerId||null,JSON.stringify(strategy),JSON.stringify(input.integrations||{})]);
    if(Array.isArray(input.owners)){await exec("UPDATE client_members SET removed_at=NOW() WHERE client_id=? AND removed_at IS NULL",[id]);for(let index=0;index<input.owners.length;index+=1){const owner=typeof input.owners[index]==="string"?input.owners[index]:input.owners[index]?.uid||input.owners[index]?.id;if(owner)await exec("INSERT INTO client_members (id,client_id,user_id,role,is_primary) VALUES (?,?,?,?,?)",[randomUUID(),id,owner,"MEMBER",index===0]);}}
    return ok({id});
  }
  if(route==="/clients/[id]"&&method==="GET"){
    const client=(await rows("SELECT * FROM clients WHERE id=? AND archived_at IS NULL",[params.id]))[0];if(!client)return err("Cliente não encontrado.",404);return ok(legacyClient(client,await rows("SELECT user_id,role,is_primary FROM client_members WHERE client_id=? AND removed_at IS NULL",[params.id])));
  }
  if(route==="/clients/[id]"&&method==="DELETE"){await exec("UPDATE clients SET active=FALSE,archived_at=NOW() WHERE id=?",[params.id]);await exec("INSERT INTO audit_logs (actor_id,event_type,entity_type,entity_id) VALUES (?,'CLIENT_ARCHIVED','CLIENT',?)",[ctx.userUid,params.id]);return ok({success:true,archived:true});}
  return null;
}
