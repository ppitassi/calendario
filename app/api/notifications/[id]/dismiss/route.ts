import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "../../../../../lib/db";
import { notificationSession } from "../../../../../lib/notifications";

export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const session=await notificationSession(req);
  if(!session)return NextResponse.json({error:"Sessão expirada."},{status:401});
  const {id}=await params;
  await getDbPool().execute("UPDATE notifications SET dismissed_at=NOW(),read_at=COALESCE(read_at,NOW()) WHERE id=? AND recipient_user_id=?",[id,session.uid]);
  return NextResponse.json({success:true});
}
