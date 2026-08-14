import 'server-only';
import { getDbPool } from './db';
import { NextRequest } from 'next/server';

export const NOTIFICATION_CATEGORIES = [
  'clients', 'posts', 'artwork', 'comments', 'approvals',
  'assignments', 'calendar', 'integrations', 'security',
] as const;
export type NotificationCategory = typeof NOTIFICATION_CATEGORIES[number];

export async function notificationSession(req: NextRequest) {
  const token = req.cookies.get('cp_session')?.value;
  if (!token) return null;
  const [result] = await getDbPool().query(
    'SELECT uid FROM users WHERE session_token = ? AND session_expires_at > NOW() LIMIT 1',
    [token],
  );
  return (result as any[])[0] || null;
}

export async function ensureNotificationPreferences(userId: string) {
  for (const category of NOTIFICATION_CATEGORIES) {
    await getDbPool().execute(
      `INSERT IGNORE INTO notification_preferences
       (userId,category,inAppEnabled,browserPushEnabled) VALUES (?,?,TRUE,TRUE)`,
      [userId, category],
    );
  }
}

export function buildNotificationRoute(input: { entityType: string; entityId?: string | number | null; clientId?: string | null; metadata?: Record<string, unknown> | null }) {
  const query = new URLSearchParams();
  if (input.clientId) query.set('clientId', input.clientId);
  if (input.entityType === 'post' && input.entityId != null) query.set('postId', String(input.entityId));
  else if (input.entityType === 'client' && input.entityId != null) { query.set('clientId', String(input.entityId)); query.set('screen', 'client_setup'); }
  else if (input.entityType === 'planning' && input.metadata?.month) query.set('month', String(input.metadata.month));
  if (input.metadata?.artworkVersion) query.set('artworkVersion', String(input.metadata.artworkVersion));
  if (input.metadata?.commentId) query.set('commentId', String(input.metadata.commentId));
  return '/?' + query.toString();
}

export function sanitizeNotificationRoute(route: string | null | undefined) {
  if (!route || !route.startsWith('/') || route.startsWith('//') || /^(?:javascript|data|https?):/i.test(route)) return null;
  try { const parsed = new URL(route, 'http://internal.local'); return parsed.origin === 'http://internal.local' ? parsed.pathname + parsed.search + parsed.hash : null; } catch { return null; }
}

type EventInput = {
  actorUserId?: string | null; type: string; category: NotificationCategory;
  entityType: string; entityId?: string | number | null; clientId?: string | null;
  title: string; body: string; route: string; recipientUserIds: string[]; dedupeKey?: string | null;
};

export async function createNotificationEvent(input: EventInput) {
  const recipients = [...new Set(input.recipientUserIds)].filter(Boolean).filter(id => id !== input.actorUserId);
  if (!recipients.length) return null;
  const pool = getDbPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const dedupe = input.dedupeKey ? `${input.dedupeKey}:${Math.floor(Date.now() / 120000)}` : null;
    const safeRoute = sanitizeNotificationRoute(input.route) || buildNotificationRoute(input);
    const [created]: any = await connection.execute(
      `INSERT INTO notifications
       (actorUserId,type,category,entityType,entityId,clientId,title,body,route,dedupeKey)
       VALUES (?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id), title=VALUES(title), body=VALUES(body), createdAt=NOW()`,
      [input.actorUserId || null, input.type, input.category, input.entityType,
       input.entityId == null ? null : String(input.entityId), input.clientId || null,
       input.title.slice(0,255), input.body.slice(0,500), safeRoute.slice(0,500), dedupe],
    );
    const notificationId = Number(created.insertId);
    for (const userId of recipients) {
      const [allowed]: any = await connection.execute(
        `SELECT u.uid FROM users u
         LEFT JOIN notification_preferences p ON p.userId=u.uid AND p.category=?
         WHERE u.uid=? AND COALESCE(p.inAppEnabled,TRUE)=TRUE LIMIT 1`,
        [input.category, userId],
      );
      if (!allowed.length) continue;
      await connection.execute('INSERT IGNORE INTO notification_recipients (notificationId,userId) VALUES (?,?)', [notificationId,userId]);
      await connection.execute(
        `INSERT IGNORE INTO notification_outbox (notificationId,recipientUserId,channel)
         SELECT ?,?,'browser_push' FROM notification_preferences
         WHERE userId=? AND category=? AND browserPushEnabled=TRUE`,
        [notificationId,userId,userId,input.category],
      );
    }
    await connection.commit();
    return notificationId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

export async function resolvePostRecipients(clientId: string, assigneeId?: string | null) {
  const [result] = await getDbPool().query(
    `SELECT DISTINCT uid FROM users WHERE
      (uid=? OR role IN ('admin','gerente') OR FIND_IN_SET(uid,(SELECT REPLACE(REPLACE(REPLACE(COALESCE(owners,''),'[',''),']',''),'"','') FROM clients WHERE id=?)))`,
    [assigneeId || '', clientId],
  );
  return (result as any[]).map(row => row.uid);
}
