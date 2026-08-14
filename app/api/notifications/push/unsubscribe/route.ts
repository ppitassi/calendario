import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "../../../../../lib/db";
import { notificationSession } from "../../../../../lib/notifications";

export async function DELETE(req:NextRequest) {
  const session=await notificationSession(req);
  if(!session)return NextResponse.json({error:"Sessão expirada."},{status:401});
  const data=await req.json().catch(()=>({})),endpoint=String(data.endpoint||"");
  await getDbPool().execute("UPDATE push_subscriptions SET revoked_at=NOW() WHERE user_id=? AND endpoint_hash=?",[session.uid,createHash("sha256").update(endpoint).digest("hex")]);
  return NextResponse.json({success:true});
}
