import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../../lib/db';
import { notificationSession } from '../../../../lib/notifications';
export async function GET(req: NextRequest) {
  const s=await notificationSession(req); if(!s) return NextResponse.json({error:'SessÃ£o expirada.'},{status:401});
  const [r]=await getDbPool().query(`SELECT COUNT(*) count FROM notification_recipients nr JOIN notifications n ON n.id=nr.notificationId WHERE nr.userId=? AND nr.readAt IS NULL AND nr.dismissedAt IS NULL`,[s.uid]);
  return NextResponse.json({count:Number((r as any[])[0]?.count||0)});
}
