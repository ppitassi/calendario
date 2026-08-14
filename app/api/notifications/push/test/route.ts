import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "../../../../../lib/db";
import { notificationSession } from "../../../../../lib/notifications";

export async function POST(req:NextRequest) {
  const session=await notificationSession(req);
  if(!session)return NextResponse.json({error:"Sessão expirada."},{status:401});
  const id=randomUUID(),data={category:"security",entityType:"user",entityId:session.uid,title:"Notificação de teste",body:"As notificações deste navegador estão funcionando.",route:"/"};
  await getDbPool().execute("INSERT INTO notifications (id,recipient_user_id,type,data_json) VALUES (?,?,?,?)",[id,session.uid,"push_test",JSON.stringify(data)]);
  await getDbPool().execute("INSERT INTO notification_outbox (id,notification_id,channel) VALUES (?,?,?)",[randomUUID(),id,"browser_push"]);
  return NextResponse.json({success:true,id});
}
