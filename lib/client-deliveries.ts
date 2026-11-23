import { getDb } from "./db";
import type { WorkDelivery } from "./client-hub-types";

/** Publicações aprovadas e tarefas concluídas são a fonte única de entregas. */
export async function clientDeliveries(clientId: string): Promise<WorkDelivery[]> {
  const db = getDb();
  const publications = await db.prepare(`SELECT ci.id, ci.title, ci.date, ci.type, ci.calendar_id, c.share_token
    FROM calendar_items ci JOIN calendars c ON c.id = ci.calendar_id
    WHERE c.client_id = ? AND c.deleted_at IS NULL AND ci.deleted_at IS NULL
    AND COALESCE(c.is_pre_calendar, 0) = 0 AND ci.status = 'Aprovado' ORDER BY ci.date DESC`).all(clientId);
  const tasks = await db.prepare(`SELECT t.id, t.title, t.type, COALESCE((SELECT MAX(e.created_at) FROM activity_events e WHERE e.entity_id = t.id AND e.event_type = 'completed'), t.updated_at) AS completed_at
    FROM tasks t JOIN work_units w ON w.id = t.work_unit_id
    WHERE t.client_id = ? AND t.deleted_at IS NULL AND w.deleted_at IS NULL
    AND t.status = 'completed' AND t.type != 'follow_up' AND (t.source_item_id IS NULL OR t.source_item_id = '')
    ORDER BY t.updated_at DESC`).all(clientId);
  return [
    ...publications.map(row => ({ key: `calendar:${row.id}`, title: row.title, date: row.date.slice(0, 10), type: row.type, calendarId: row.calendar_id, url: row.share_token ? `/portal/${row.share_token}` : undefined, origin: "calendar" as const })),
    ...tasks.map(row => ({ key: `task:${row.id}`, title: row.title, date: row.completed_at.slice(0, 10), type: row.type, calendarId: null, origin: "task" as const })),
  ].sort((a, b) => b.date.localeCompare(a.date));
}
