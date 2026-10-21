import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { normalizeTaskStatus } from "@/lib/work-units";
import { hubJson, hubFailure } from "@/lib/client-hub-http";
import type { HubDocument } from "@/lib/client-hub-types";

/** Consolida tarefas reais e follow-ups; designer recebe apenas seu próprio trabalho. */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return hubJson({ error: "Não autorizado." }, 401);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const month = new URL(request.url).searchParams.get("month") || today.slice(0, 7);
    if (month !== "all" && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return hubJson({ error: "Mês inválido." }, 400);
    const db = getDb();
    const [tasks, publications, users, hubs] = await Promise.all([
      db.prepare(`SELECT t.id, t.title, t.client_id, c.name AS client_name, t.status, t.type,
        COALESCE(t.due_date, w.due_date) AS due_date,
        COALESCE(t.assignee_id, w.executor_id, w.owner_id, c.owner_id) AS assignee_id,
        w.id AS work_unit_id, w.planning
        FROM tasks t JOIN clients c ON c.id = t.client_id
        LEFT JOIN work_units w ON w.id = t.work_unit_id
        WHERE t.deleted_at IS NULL AND (w.id IS NULL OR w.deleted_at IS NULL)`).all(),
      db.prepare(`SELECT i.id, i.title, cal.client_id, c.name AS client_name, i.status, i.type,
        COALESCE(cy.global_deadline, i.date) AS due_date,
        COALESCE(i.assignee_id, cal.executor_id, cal.assigned_to_id, cal.owner_id, c.owner_id) AS assignee_id,
        cal.id AS work_unit_id
        FROM calendar_items i JOIN calendars cal ON cal.id = i.calendar_id JOIN clients c ON c.id = cal.client_id
        LEFT JOIN calendar_cycles cy ON cy.id = cal.cycle_id
        WHERE i.deleted_at IS NULL AND cal.deleted_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.source_item_id = i.id AND t.deleted_at IS NULL)`).all(),
      db.prepare("SELECT id, name FROM users WHERE status = 'approved' ORDER BY name").all(),
      db.prepare("SELECT h.client_id, c.name, h.document FROM client_hubs h JOIN clients c ON c.id = h.client_id").all(),
    ]);
    const completions = await db.prepare(`SELECT entity_id, MAX(created_at) AS completed_at FROM activity_events
      WHERE event_type = 'completed' AND entity_type = 'task' GROUP BY entity_id`).all();
    const completedAt = new Map(completions.map(row => [row.entity_id, row.completed_at as string]));
    const names = new Map(users.map(row => [row.id, row.name]));
    const rows = [...tasks, ...publications].filter(row => user.role !== "designer" || row.assignee_id === user.id).map(row => {
      const planning = row.planning ? JSON.parse(row.planning) : {};
      return {
        id: row.id, title: row.title, clientId: row.client_id, clientName: row.client_name,
        status: normalizeTaskStatus(row.status), due: row.due_date, assigneeId: row.assignee_id,
        assignee: names.get(row.assignee_id) || "Não atribuído", workUnitId: row.work_unit_id,
        effort: planning.effort || 1, category: planning.category || row.type, serviceMode: planning.serviceMode || "",
        dueTime: planning.dueTime || "", completedAt: completedAt.get(row.id) || null,
      };
    });
    const open = rows.filter(row => row.status !== "completed").sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
    const ranking = users.filter(person => user.role !== "designer" || person.id === user.id).map(person => ({
      id: person.id, name: person.name,
      completed: rows.filter(row => row.assigneeId === person.id && row.status === "completed"
        && (month === "all" || (row.completedAt && new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(new Date(row.completedAt)) === month))).length,
      openPoints: open.filter(row => row.assigneeId === person.id).reduce((sum, row) => sum + row.effort, 0),
    })).sort((a, b) => b.completed - a.completed || a.name.localeCompare(b.name));
    const followUps = hubs.flatMap(row => (JSON.parse(row.document) as HubDocument).followUps
      .filter(f => f.status === "scheduled" && (user.role !== "designer" || f.owner === user.id || f.participant === user.id))
      .map(f => ({ id: f.id, title: f.title, due: f.due, clientId: row.client_id, clientName: row.name, owner: names.get(f.owner) || "Responsável" })))
      .sort((a, b) => a.due.localeCompare(b.due));
    return hubJson({ today, month, open, ranking, followUps,
      stats: { open: open.length, overdue: open.filter(row => row.due && row.due < today).length,
        dueToday: open.filter(row => row.due?.slice(0, 10) === today).length,
        waiting: open.filter(row => ["waiting", "awaiting_approval"].includes(row.status)).length } });
  } catch (error) { return hubFailure(error); }
}
