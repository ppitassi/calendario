import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';
import { notificationSession } from '../../../lib/notifications';

export async function GET(req: NextRequest) {
  const session = await notificationSession(req);
  if (!session) return NextResponse.json({ error: 'SessÃ£o expirada.' }, { status: 401 });
  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get('filter') === 'unread';
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || 20)));
  const cursor = Number(url.searchParams.get('cursor') || Number.MAX_SAFE_INTEGER);
  const [rows] = await getDbPool().query(
    `SELECT n.id,n.type,n.category,n.entityType,n.entityId,n.clientId,n.title,n.body,n.route,n.createdAt,
      nr.seenAt,nr.toastPresentedAt,nr.readAt,nr.dismissedAt,u.displayName actorName,c.name clientName
     FROM notification_recipients nr JOIN notifications n ON n.id=nr.notificationId
     LEFT JOIN users u ON u.uid=n.actorUserId LEFT JOIN clients c ON c.id=n.clientId
     WHERE nr.userId=? AND nr.dismissedAt IS NULL AND n.id < ?
     ${unreadOnly ? 'AND nr.readAt IS NULL' : ''}
     ORDER BY n.id DESC LIMIT ?`,
    [session.uid, cursor, limit],
  );
  return NextResponse.json({ items: rows, nextCursor: (rows as any[]).length === limit ? (rows as any[]).at(-1)?.id : null });
}
