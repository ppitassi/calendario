import { createHash, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "../../../../../lib/db";
import { notificationSession } from "../../../../../lib/notifications";

export async function POST(req:NextRequest) {
  const session=await notificationSession(req);
  if(!session)return NextResponse.json({error:"Sessão expirada."},{status:401});
  const data=await req.json().catch(()=>({})),endpoint=String(data.endpoint||""),p256dh=String(data.keys?.p256dh||""),auth=String(data.keys?.auth||"");
  if(!endpoint.startsWith("https://")||!p256dh||!auth)return NextResponse.json({error:"Subscription inválida."},{status:400});
  await getDbPool().execute(`INSERT INTO push_subscriptions(id,user_id,endpoint_hash,endpoint,p256dh,auth_secret,user_agent,revoked_at) VALUES(?,?,?,?,?,?,?,NULL) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id),p256dh=VALUES(p256dh),auth_secret=VALUES(auth_secret),user_agent=VALUES(user_agent),revoked_at=NULL`,[randomUUID(),session.uid,createHash("sha256").update(endpoint).digest("hex"),endpoint.slice(0,4000),p256dh.slice(0,1000),auth.slice(0,1000),(req.headers.get("user-agent")||"").slice(0,500)]);
  return NextResponse.json({success:true});
}
