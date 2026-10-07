/**
 * Serviço de Fila Global de Trabalho (Global Work Queue) e Unidades de Trabalho (WorkUnits).
 * Permite buscar todo o trabalho atribuído ao usuário independentemente do cliente,
 * consolidando calendários e demandas como WorkUnits sem poluir o Kanban com dezenas de micro-cards.
 *
 * Inclui controle de Ownership (ownerId, assigneeId, createdById) e Audit Trail (Activity Events).
 */

import crypto from "node:crypto";
import { getDb } from "./db";
import { monthLabel, parseMonthKey } from "./date";
import {
  type WorkUnitType,
  type TaskStatus,
  type TaskEventType,
  type ActivityEvent,
  type WorkUnitTask,
  type AssignmentBreakdownItem,
  type WorkQueueUnitItem,
  type WorkQueueTaskItem,
  type WorkQueueItem,
  type WorkUnitDetails,
  type WorkQueueFilters,
  type Task,
  type WorkUnit,
  type TeamMember,
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
} from "./task-types";

export * from "./task-types";

/**
 * Normaliza qualquer valor textual de status para um dos 5 estados canônicos de TaskStatus.
 */
export function normalizeTaskStatus(rawStatus?: string | null): TaskStatus {
  if (!rawStatus) return "not_started";
  const s = rawStatus.toLowerCase().trim();

  // Completed
  if (
    s === "completed" ||
    s === "completo" ||
    s.includes("aprov") ||
    s === "approved" ||
    s === "done"
  ) {
    return "completed";
  }

  // Awaiting approval / review
  if (
    s === "awaiting_approval" ||
    s.includes("aguardando") ||
    s.includes("revis") ||
    s === "review" ||
    s.includes("sent_to_social") ||
    s.includes("sent_to_designer")
  ) {
    return "awaiting_approval";
  }

  // Waiting
  if (s === "waiting" || s.includes("espera") || s === "hold") {
    return "waiting";
  }

  // In progress
  if (
    s === "in_progress" ||
    s.includes("execu") ||
    s.includes("produ") ||
    s === "in_production"
  ) {
    return "in_progress";
  }

  // Default: Not started
  return "not_started";
}

/**
 * Converte TaskStatus para os valores legados gravados em calendars.
 */
function taskStatusToLegacyCalendar(status: TaskStatus): string {
  switch (status) {
    case "completed":
      return "approved";
    case "awaiting_approval":
      return "sent_to_social_media";
    case "waiting":
    case "in_progress":
      return "in_production";
    case "not_started":
    default:
      return "draft";
  }
}

/**
 * Converte TaskStatus para os valores legados gravados em calendar_items.
 */
function taskStatusToLegacyItem(status: TaskStatus): string {
  switch (status) {
    case "completed":
      return "Aprovado";
    case "awaiting_approval":
      return "Revisão";
    case "waiting":
    case "in_progress":
      return "Produção";
    case "not_started":
    default:
      return "Ideia";
  }
}

/**
 * 3. Registra um evento no Audit Trail permanente (Append-only).
 */
export async function recordActivityEvent(params: {
  entityType?: "task" | "work_unit" | "calendar";
  entityId: string;
  taskId?: string;
  actorId: string;
  eventType: TaskEventType | string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const metaStr = params.metadata ? JSON.stringify(params.metadata) : null;
  const entityType = params.entityType || "task";
  const taskId = params.taskId || (entityType === "task" ? params.entityId : null);

  try {
    await db
      .prepare(
        `INSERT INTO activity_events (
          id, entity_type, entity_id, task_id, actor_id, event_type,
          field_name, old_value, new_value, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        entityType,
        params.entityId,
        taskId,
        params.actorId,
        params.eventType,
        params.fieldName || null,
        params.oldValue || null,
        params.newValue || null,
        metaStr,
        now
      );
  } catch (err) {
    console.error("Erro ao registrar em activity_events:", err);
  }

  // Sincroniza tabela task_events caso seja tarefa
  if (taskId) {
    try {
      await db
        .prepare(
          `INSERT INTO task_events (
            id, task_id, actor_id, event_type, field_name, old_value, new_value, metadata, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          taskId,
          params.actorId,
          params.eventType,
          params.fieldName || null,
          params.oldValue || null,
          params.newValue || null,
          metaStr,
          now
        );
    } catch {}
  }
}

/**
 * 5. Busca o histórico de atividades da tarefa ou da unidade de trabalho.
 */
export async function getActivityEvents(
  entityId: string,
  entityType?: "task" | "work_unit" | "calendar"
): Promise<ActivityEvent[]> {
  const db = getDb();
  try {
    let sql = `
      SELECT
        ae.id,
        ae.entity_type,
        ae.entity_id,
        ae.task_id,
        ae.actor_id,
        ae.event_type,
        ae.field_name,
        ae.old_value,
        ae.new_value,
        ae.metadata,
        ae.created_at,
        u.name as actor_name
      FROM activity_events ae
      LEFT JOIN users u ON u.id = ae.actor_id
      WHERE (ae.entity_id = ? OR ae.task_id = ?)
    `;
    const params: any[] = [entityId, entityId];
    if (entityType) {
      sql += " AND ae.entity_type = ?";
      params.push(entityType);
    }
    sql += " ORDER BY ae.created_at DESC LIMIT 100";

    const rows = await db.prepare(sql).all(...params);
    return rows.map((r: any) => {
      let meta: any = undefined;
      if (r.metadata) {
        try {
          meta = JSON.parse(r.metadata);
        } catch {}
      }
      return {
        id: r.id,
        entityType: r.entity_type,
        entityId: r.entity_id,
        taskId: r.task_id,
        actorId: r.actor_id,
        actorName: r.actor_name || "Usuário",
        eventType: r.event_type,
        fieldName: r.field_name,
        oldValue: r.old_value,
        newValue: r.new_value,
        metadata: meta,
        createdAt: r.created_at,
      };
    });
  } catch (err) {
    console.error("Erro ao buscar histórico de atividades:", err);
    return [];
  }
}

/**
 * Retorna lista de membros da equipe ativos para atribuição de tarefas.
 */
export async function getTeamMembers(): Promise<TeamMember[]> {
  const db = getDb();
  try {
    const rows = await db
      .prepare(
        "SELECT id, name, role FROM users WHERE status = 'approved' ORDER BY name ASC"
      )
      .all();
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      role: r.role,
    }));
  } catch {
    return [];
  }
}

/**
 * 1. Query/Service Global: Busca todo o trabalho aberto para o usuário.
 * Oculta tarefas concluídas por padrão (status !== 'completed' e deleted_at IS NULL).
 */
export async function getOpenWorkForUser(
  userId?: string,
  filters?: WorkQueueFilters
): Promise<WorkQueueItem[]> {
  return getUserWorkQueue(userId, {
    ...filters,
    hideCompleted: filters?.hideCompleted !== false,
  });
}

/**
 * Busca todas as tarefas atribuídas ao usuário que estão abertas e não deletadas.
 */
export async function getOpenTasksByUser(userId: string): Promise<Task[]> {
  const db = getDb();
  const query = `
    SELECT
      t.id,
      t.work_unit_id,
      t.client_id,
      t.owner_id,
      t.assignee_id,
      t.created_by_id,
      t.title,
      t.type,
      t.status,
      t.due_date,
      t.created_at,
      t.updated_at,
      t.deleted_at,
      owner.name as owner_name,
      assigned.name as assignee_name,
      creator.name as created_by_name
    FROM tasks t
    LEFT JOIN users owner ON owner.id = t.owner_id
    LEFT JOIN users assigned ON assigned.id = t.assignee_id
    LEFT JOIN users creator ON creator.id = t.created_by_id
    WHERE (t.assignee_id = ? OR t.owner_id = ? OR (t.assignee_id IS NULL AND t.owner_id IS NULL))
      AND t.status != 'completed'
      AND t.status != 'Aprovado'
      AND t.deleted_at IS NULL
    ORDER BY t.due_date ASC, t.created_at DESC
  `;
  const rows = await db.prepare(query).all(userId, userId);
  return rows.map((r: any) => ({
    id: r.id,
    workUnitId: r.work_unit_id,
    clientId: r.client_id,
    ownerId: r.owner_id,
    ownerName: r.owner_name,
    assigneeId: r.assignee_id,
    assigneeName: r.assignee_name,
    createdById: r.created_by_id,
    createdByName: r.created_by_name,
    title: r.title,
    type: r.type,
    status: normalizeTaskStatus(r.status),
    dueDate: r.due_date,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  }));
}

/**
 * Busca todas as WorkUnits do usuário (não deletadas).
 */
export async function getWorkUnitsByUser(
  userId?: string,
  filters?: WorkQueueFilters
): Promise<WorkQueueUnitItem[]> {
  const items = await getUserWorkQueue(userId, filters);
  return items.filter((i): i is WorkQueueUnitItem => i.kind === "workUnit");
}

/**
 * Fila Global de Trabalho consolidada.
 * Retorna calendários como WorkUnits (com contagem de tarefas e breakdown)
 * e tarefas individuais / avulsas com ownership claramente identificado.
 */
export async function getUserWorkQueue(
  userId?: string,
  filters?: WorkQueueFilters
): Promise<WorkQueueItem[]> {
  const db = getDb();

  const scope = filters?.scope || (userId ? "me" : "team");
  const isUserScope = scope === "me" && !!userId;

  const isIncludeCompleted =
    filters?.includeCompleted !== undefined
      ? filters.includeCompleted
      : filters?.hideCompleted !== undefined
      ? !filters.hideCompleted
      : false;

  // 1. Calendários (WorkUnits principais) não deletados com responsáveis
  let calQuery = `
    SELECT
      cal.id,
      cal.client_id,
      cal.title,
      cal.month,
      cal.brand,
      cal.status as cal_status,
      cal.accent as cal_accent,
      cal.assigned_to_id,
      cal.executor_id,
      cal.owner_id as cal_owner_id,
      cal.created_by_id,
      c.name as client_name,
      c.accent as client_accent,
      c.logo_url as client_logo_url,
      c.owner_id as client_owner_id,
      c.created_by_id as client_created_by_id,
      cy.global_deadline,
      COALESCE(executor.name, assigned.name) as executor_name,
      COALESCE(owner.name, client_owner.name, creator.name) as owner_name,
      creator.name as creator_name
    FROM calendars cal
    INNER JOIN clients c ON c.id = cal.client_id
    LEFT JOIN calendar_cycles cy ON cy.month = cal.month
    LEFT JOIN users assigned ON assigned.id = cal.assigned_to_id
    LEFT JOIN users executor ON executor.id = cal.executor_id
    LEFT JOIN users owner ON owner.id = cal.owner_id
    LEFT JOIN users client_owner ON client_owner.id = c.owner_id
    LEFT JOIN users creator ON creator.id = cal.created_by_id
    WHERE (cal.deleted_at IS NULL)
  `;

  const calParams: any[] = [];
  if (filters?.clientId && filters.clientId !== "all") {
    calQuery += " AND cal.client_id = ?";
    calParams.push(filters.clientId);
  }

  calQuery += " ORDER BY cal.month DESC, cal.created_at DESC";

  let calendars: any[] = [];
  try {
    calendars = await db.prepare(calQuery).all(...calParams);
  } catch (e) {
    try {
      calQuery = calQuery.replace("WHERE (cal.deleted_at IS NULL)", "WHERE 1=1");
      calendars = await db.prepare(calQuery).all(...calParams);
    } catch {
      calendars = [];
    }
  }

  // 2. Busca todos os calendar_items não deletados com responsáveis
  let allItems: any[] = [];
  try {
    const itemsQuery = `
      SELECT
        ci.id,
        ci.calendar_id,
        ci.title,
        ci.type,
        ci.status,
        ci.date,
        ci.is_extra,
        ci.extra_format,
        ci.assignee_id,
        ci.owner_id,
        ci.deleted_at,
        u.name as assignee_name
      FROM calendar_items ci
      LEFT JOIN users u ON u.id = ci.assignee_id
      WHERE (ci.deleted_at IS NULL)
    `;
    allItems = await db.prepare(itemsQuery).all();
  } catch {
    try {
      allItems = await db
        .prepare(
          "SELECT id, calendar_id, title, type, status, date, is_extra, extra_format FROM calendar_items"
        )
        .all();
    } catch {
      allItems = [];
    }
  }

  // Agrupa calendar_items por calendar_id
  const itemsByCalId = new Map<string, any[]>();
  allItems.forEach((it) => {
    const list = itemsByCalId.get(it.calendar_id) || [];
    list.push(it);
    itemsByCalId.set(it.calendar_id, list);
  });

  const queueItems: WorkQueueItem[] = [];

  // 3. Monta as WorkUnits originadas de calendários
  for (const cal of calendars) {
    const items = itemsByCalId.get(cal.id) || [];
    const taskCount = items.length;

    let feedStory = 0;
    let videos = 0;
    let extras = 0;
    let other = 0;
    let completedCount = 0;
    let inProgressCount = 0;
    let waitingCount = 0;
    let awaitingApprovalCount = 0;

    items.forEach((it) => {
      const st = normalizeTaskStatus(it.status);
      if (st === "completed") completedCount++;
      else if (st === "awaiting_approval") awaitingApprovalCount++;
      else if (st === "waiting") waitingCount++;
      else if (st === "in_progress") inProgressCount++;

      const isEx = Boolean(it.is_extra);
      if (isEx) {
        extras++;
      } else {
        const t = (it.type || "").toLowerCase();
        if (
          t.includes("reels") ||
          t.includes("video") ||
          t.includes("vídeo") ||
          t.includes("tiktok")
        ) {
          videos++;
        } else if (
          t.includes("feed") ||
          t.includes("story") ||
          t.includes("carrossel") ||
          t.includes("post")
        ) {
          feedStory++;
        } else {
          other++;
        }
      }
    });

    let unitStatus: TaskStatus = normalizeTaskStatus(cal.cal_status);
    if (taskCount > 0) {
      if (completedCount === taskCount) {
        unitStatus = "completed";
      } else if (awaitingApprovalCount > 0) {
        unitStatus = "awaiting_approval";
      } else if (waitingCount > 0) {
        unitStatus = "waiting";
      } else if (inProgressCount > 0 || completedCount > 0) {
        unitStatus = "in_progress";
      } else {
        unitStatus = "not_started";
      }
    }

    let formattedMonth = cal.month;
    try {
      formattedMonth = monthLabel(parseMonthKey(cal.month));
    } catch {}

    const title = cal.title || `Calendário de ${formattedMonth}`;

    // Resolução hierárquica de Ownership e Executor
    const accountableOwnerId = cal.cal_owner_id || cal.client_owner_id || cal.client_created_by_id || cal.created_by_id;
    const accountableOwnerName = cal.owner_name || cal.creator_name || "Dono do Cliente";
    const defaultExecutorId = cal.executor_id || cal.assigned_to_id || null;
    const defaultExecutorName = cal.executor_name || (defaultExecutorId ? cal.assigned_name : null);
    const effectiveExecutorId = defaultExecutorId || accountableOwnerId;
    const effectiveExecutorName = defaultExecutorName || accountableOwnerName;

    // Se escopo for 'me', verifica se pertence ao usuário
    let userSpecificTaskCount: number | undefined = undefined;
    if (isUserScope && userId) {
      const isCalendarExecutor = effectiveExecutorId === userId;
      const userDelegatedTasks = items.filter((it) => it.assignee_id === userId);

      if (isCalendarExecutor) {
        userSpecificTaskCount = undefined;
      } else if (userDelegatedTasks.length > 0) {
        userSpecificTaskCount = userDelegatedTasks.length;
      } else {
        continue;
      }
    } else if (filters?.responsibleFilter && filters.responsibleFilter !== "all") {
      const target = filters.responsibleFilter === "me" ? userId : filters.responsibleFilter;
      if (target) {
        const isTargetExecutor = effectiveExecutorId === target;
        const targetTasks = items.filter((it) => (it.assignee_id || effectiveExecutorId) === target);
        if (!isTargetExecutor && targetTasks.length === 0 && accountableOwnerId !== target) {
          continue;
        }
      }
    }

    // Calcula Assignment Breakdown para tarefas delegadas
    const userCounts = new Map<string, { count: number; name: string }>();
    items.forEach((it) => {
      const itemEffId = it.assignee_id || effectiveExecutorId;
      const itemEffName = it.assignee_name || (it.assignee_id ? "Membro" : effectiveExecutorName);
      if (itemEffId) {
        const cur = userCounts.get(itemEffId) || { count: 0, name: itemEffName };
        cur.count++;
        userCounts.set(itemEffId, cur);
      }
    });

    const assignmentBreakdown: AssignmentBreakdownItem[] = Array.from(userCounts.entries()).map(
      ([uId, val]) => ({
        userId: uId,
        userName: val.name,
        count: val.count,
        isDefaultExecutor: uId === effectiveExecutorId,
      })
    );

    const unitItem: WorkQueueUnitItem = {
      kind: "workUnit",
      id: cal.id,
      clientId: cal.client_id,
      clientName: cal.client_name || cal.brand,
      clientAccent: cal.client_accent || cal.cal_accent || "#ef5d3d",
      clientLogoUrl: cal.client_logo_url,
      type: "calendar",
      sourceId: cal.id,
      title,
      status: unitStatus,
      ownerId: accountableOwnerId,
      ownerName: accountableOwnerName,
      executorId: defaultExecutorId,
      executorName: defaultExecutorName,
      assigneeId: defaultExecutorId,
      assigneeName: defaultExecutorName,
      effectiveAssigneeId: effectiveExecutorId,
      effectiveAssigneeName: effectiveExecutorName,
      createdById: cal.created_by_id,
      createdByName: cal.creator_name,
      dueDate: cal.global_deadline || `${cal.month}-28`,
      taskCount,
      breakdown: {
        feedStory,
        videos,
        extras,
        other,
      },
      assignmentBreakdown: assignmentBreakdown.length > 0 ? assignmentBreakdown : undefined,
      userSpecificTaskCount,
      progress: {
        total: taskCount,
        completed: completedCount,
        pending: taskCount - completedCount,
        percent: taskCount > 0 ? Math.round((completedCount / taskCount) * 100) : 0,
      },
    };

    queueItems.push(unitItem);
  }

  // 4. Busca WorkUnits cadastradas na tabela work_units
  try {
    let customUnitsQuery = `
      SELECT
        wu.id,
        wu.client_id,
        wu.type,
        wu.source_id,
        wu.title,
        wu.description,
        wu.priority,
        wu.status,
        wu.owner_id,
        wu.executor_id,
        wu.assignee_id,
        wu.created_by_id,
        wu.due_date,
        c.name as client_name,
        c.accent as client_accent,
        c.logo_url as client_logo_url,
        c.owner_id as client_owner_id,
        owner.name as owner_name,
        executor.name as executor_name,
        assigned.name as assignee_name,
        creator.name as creator_name,
        client_owner.name as client_owner_name
      FROM work_units wu
      INNER JOIN clients c ON c.id = wu.client_id
      LEFT JOIN users owner ON owner.id = wu.owner_id
      LEFT JOIN users executor ON executor.id = wu.executor_id
      LEFT JOIN users assigned ON assigned.id = wu.assignee_id
      LEFT JOIN users creator ON creator.id = wu.created_by_id
      LEFT JOIN users client_owner ON client_owner.id = c.owner_id
      WHERE (wu.deleted_at IS NULL)
    `;
    const wuParams: any[] = [];
    if (filters?.clientId && filters.clientId !== "all") {
      customUnitsQuery += " AND wu.client_id = ?";
      wuParams.push(filters.clientId);
    }

    const customUnits = await db.prepare(customUnitsQuery).all(...wuParams);

    if (customUnits.length > 0) {
      // Carrega tarefas vinculadas a essas work_units
      let wuTasksAll: any[] = [];
      try {
        const wuIds = customUnits.map((u: any) => u.id);
        const wuPlaceholders = wuIds.map(() => "?").join(",");
        wuTasksAll = await db
          .prepare(
            `SELECT
              t.id,
              t.work_unit_id,
              t.type,
              t.title,
              t.description,
              t.assignee_id,
              t.status,
              t.due_date,
              t.position,
              u.name as assignee_name
            FROM tasks t
            LEFT JOIN users u ON u.id = t.assignee_id
            WHERE t.work_unit_id IN (${wuPlaceholders}) AND (t.deleted_at IS NULL)
            ORDER BY t.position ASC, t.created_at ASC`
          )
          .all(...wuIds);
      } catch {
        wuTasksAll = [];
      }

      const tasksByWuId = new Map<string, any[]>();
      wuTasksAll.forEach((t) => {
        const list = tasksByWuId.get(t.work_unit_id) || [];
        list.push(t);
        tasksByWuId.set(t.work_unit_id, list);
      });

      for (const wu of customUnits) {
        if (wu.type === "calendar" && queueItems.some((q) => q.id === wu.source_id)) {
          continue;
        }

        const wuTasks = tasksByWuId.get(wu.id) || [];
        const clientOwnerId = wu.client_owner_id || null;
        const wuOwnerId = wu.owner_id || clientOwnerId;
        const wuOwnerName = wu.owner_name || wu.client_owner_name || "Dono do Cliente";
        const wuExecutorId = wu.executor_id || wu.assignee_id || null;
        const wuExecutorName = wu.executor_name || wu.assignee_name || null;
        const defaultEffectiveId = wuExecutorId || wuOwnerId || clientOwnerId;
        const defaultEffectiveName = wuExecutorName || wuOwnerName;

        // Calcula responsáveis efetivos e prazos para cada tarefa da WorkUnit
        let matchingUserTasksCount = 0;
        let feedStory = 0;
        let videos = 0;
        let extras = 0;
        let other = 0;
        let completedCount = 0;
        let inProgressCount = 0;
        let waitingCount = 0;
        let awaitingApprovalCount = 0;

        const taskAssigneesMap = new Map<string, { count: number; name: string }>();

        wuTasks.forEach((t: any) => {
          const effectiveAssignee = t.assignee_id || defaultEffectiveId;
          const effectiveAssigneeName = t.assignee_name || defaultEffectiveName;

          if (effectiveAssignee) {
            const cur = taskAssigneesMap.get(effectiveAssignee) || { count: 0, name: effectiveAssigneeName };
            cur.count++;
            taskAssigneesMap.set(effectiveAssignee, cur);
          }

          if (effectiveAssignee === userId) {
            matchingUserTasksCount++;
          }

          const st = normalizeTaskStatus(t.status);
          if (st === "completed") completedCount++;
          else if (st === "awaiting_approval") awaitingApprovalCount++;
          else if (st === "waiting") waitingCount++;
          else if (st === "in_progress") inProgressCount++;

          const tType = (t.type || "").toLowerCase();
          if (tType.includes("reel") || tType.includes("video") || tType.includes("vídeo") || tType.includes("tiktok")) {
            videos++;
          } else if (tType.includes("feed") || tType.includes("story") || tType.includes("carrossel") || tType.includes("post")) {
            feedStory++;
          } else if (tType.includes("banner") || tType.includes("encarte") || tType.includes("impresso") || tType.includes("capa")) {
            extras++;
          } else {
            other++;
          }
        });

        // Se o escopo for Meu Trabalho ('me'), filtra pelas tarefas do usuário
        if (isUserScope && userId) {
          if (wuTasks.length > 0) {
            if (matchingUserTasksCount === 0) continue;
          } else if (defaultEffectiveId !== userId) {
            continue;
          }
        }

        const totalTasks = wuTasks.length;
        let unitStatus: TaskStatus = normalizeTaskStatus(wu.status);
        if (totalTasks > 0) {
          if (completedCount === totalTasks) {
            unitStatus = "completed";
          } else if (awaitingApprovalCount > 0) {
            unitStatus = "awaiting_approval";
          } else if (waitingCount > 0) {
            unitStatus = "waiting";
          } else if (inProgressCount > 0 || completedCount > 0) {
            unitStatus = "in_progress";
          } else {
            unitStatus = "not_started";
          }
        }

        const assignmentBreakdown: AssignmentBreakdownItem[] = Array.from(taskAssigneesMap.entries()).map(
          ([uId, val]) => ({
            userId: uId,
            userName: val.name,
            count: val.count,
            isDefaultExecutor: uId === defaultEffectiveId,
          })
        );

        queueItems.push({
          kind: "workUnit",
          id: wu.id,
          clientId: wu.client_id,
          clientName: wu.client_name,
          clientAccent: wu.client_accent || "#ef5d3d",
          clientLogoUrl: wu.client_logo_url,
          type: (wu.type as WorkUnitType) || "extra_request",
          sourceId: wu.source_id,
          title: wu.title,
          status: unitStatus,
          ownerId: wuOwnerId,
          ownerName: wuOwnerName,
          executorId: wuExecutorId,
          executorName: wuExecutorName,
          assigneeId: wu.assignee_id,
          assigneeName: wu.assignee_name,
          effectiveAssigneeId: defaultEffectiveId,
          effectiveAssigneeName: defaultEffectiveName,
          createdById: wu.created_by_id,
          createdByName: wu.creator_name,
          dueDate: wu.due_date,
          taskCount: totalTasks,
          breakdown: {
            feedStory,
            videos,
            extras: extras || (wu.type === "extra_request" ? totalTasks : 0),
            other,
          },
          assignmentBreakdown: assignmentBreakdown.length > 0 ? assignmentBreakdown : undefined,
          userSpecificTaskCount: isUserScope ? (wuTasks.length > 0 ? matchingUserTasksCount : 1) : undefined,
          progress: {
            total: totalTasks,
            completed: completedCount,
            pending: totalTasks - completedCount,
            percent: totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0,
          },
        });
      }
    }
  } catch (err) {
    console.error("Erro ao carregar work_units customizadas:", err);
  }

  // 5. Busca tarefas avulsas (sem work_unit_id) na tabela tasks
  try {
    let soloTasksQuery = `
      SELECT
        t.id,
        t.work_unit_id,
        t.client_id,
        t.owner_id,
        t.assignee_id,
        t.created_by_id,
        t.title,
        t.type,
        t.status,
        t.due_date,
        c.name as client_name,
        c.accent as client_accent,
        owner.name as owner_name,
        assigned.name as assignee_name,
        creator.name as creator_name
      FROM tasks t
      INNER JOIN clients c ON c.id = t.client_id
      LEFT JOIN users owner ON owner.id = t.owner_id
      LEFT JOIN users assigned ON assigned.id = t.assignee_id
      LEFT JOIN users creator ON creator.id = t.created_by_id
      WHERE (t.work_unit_id IS NULL OR t.work_unit_id = '')
        AND (t.deleted_at IS NULL)
    `;
    const tParams: any[] = [];
    if (filters?.clientId && filters.clientId !== "all") {
      soloTasksQuery += " AND t.client_id = ?";
      tParams.push(filters.clientId);
    }

    const soloTasks = await db.prepare(soloTasksQuery).all(...tParams);
    for (const t of soloTasks) {
      const taskEffectiveId = t.assignee_id || t.owner_id;
      if (isUserScope && userId && taskEffectiveId !== userId) {
        continue;
      }

      queueItems.push({
        kind: "task",
        id: t.id,
        clientId: t.client_id,
        clientName: t.client_name,
        clientAccent: t.client_accent || "#ef5d3d",
        title: t.title,
        type: t.type,
        status: normalizeTaskStatus(t.status),
        ownerId: t.owner_id || t.assignee_id,
        ownerName: t.owner_name || t.assignee_name,
        assigneeId: t.assignee_id,
        assigneeName: t.assignee_name,
        effectiveAssigneeId: taskEffectiveId,
        effectiveAssigneeName: t.assignee_name || t.owner_name,
        createdById: t.created_by_id,
        createdByName: t.creator_name,
        dueDate: t.due_date,
      });
    }
  } catch {}

  // 6. Aplicação de filtros
  let result = queueItems;

  // Filtro de Responsável na visão de equipe
  if (scope === "team" && filters?.responsibleFilter && filters.responsibleFilter !== "all") {
    const target = filters.responsibleFilter === "me" ? userId : filters.responsibleFilter;
    if (target) {
      result = result.filter((item) => {
        if (item.ownerId === target) return true;
        if (
          item.effectiveAssigneeId === target ||
          item.assigneeId === target ||
          (item.kind === "workUnit" && item.executorId === target)
        ) {
          return true;
        }
        if (item.kind === "workUnit" && item.assignmentBreakdown) {
          return item.assignmentBreakdown.some((b) => b.userId === target);
        }
        return false;
      });
    }
  }

  // Filtro de status concluído (oculta completed por padrão quando includeCompleted é false)
  if (!isIncludeCompleted && filters?.status !== "completed") {
    result = result.filter((item) => item.status !== "completed");
  }

  if (filters?.status && filters.status !== "all") {
    result = result.filter((item) => item.status === filters.status);
  }

  if (filters?.excludeStatus && filters.excludeStatus.length > 0) {
    result = result.filter((item) => !filters.excludeStatus!.includes(item.status));
  }

  if (filters?.type && filters.type !== "all") {
    result = result.filter((item) => {
      if (item.kind === "workUnit") return item.type === filters.type;
      return true;
    });
  }

  if (filters?.search && filters.search.trim()) {
    const q = filters.search.toLowerCase().trim();
    result = result.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.clientName.toLowerCase().includes(q) ||
        (item.ownerName && item.ownerName.toLowerCase().includes(q)) ||
        (item.assigneeName && item.assigneeName.toLowerCase().includes(q))
    );
  }

  return result;
}

/**
 * 15. Visão de equipe:
 * Consulta a fila de trabalho de toda a equipe para usuários autorizados (admin / social_media).
 */
export async function getTeamWorkQueue(
  filters?: WorkQueueFilters
): Promise<WorkQueueItem[]> {
  return getUserWorkQueue(undefined, {
    ...filters,
    scope: "team",
  });
}


/**
 * Carrega os detalhes completos de uma WorkUnit, suas tarefas e histórico de atividades.
 */
export async function getWorkUnitDetails(
  workUnitId: string
): Promise<WorkUnitDetails | null> {
  const db = getDb();

  // 1. Tenta buscar em calendars
  let cal: any = null;
  try {
    cal = await db
      .prepare(
        `SELECT
          cal.id,
          cal.client_id,
          cal.title,
          cal.month,
          cal.brand,
          cal.status as cal_status,
          cal.accent as cal_accent,
          cal.assigned_to_id,
          cal.executor_id,
          cal.owner_id as cal_owner_id,
          cal.created_by_id,
          c.name as client_name,
          c.accent as client_accent,
          c.logo_url as client_logo_url,
          c.owner_id as client_owner_id,
          c.created_by_id as client_created_by_id,
          cy.global_deadline,
          COALESCE(executor.name, assigned.name) as executor_name,
          COALESCE(owner.name, client_owner.name, creator.name) as owner_name,
          creator.name as creator_name
        FROM calendars cal
        INNER JOIN clients c ON c.id = cal.client_id
        LEFT JOIN calendar_cycles cy ON cy.month = cal.month
        LEFT JOIN users assigned ON assigned.id = cal.assigned_to_id
        LEFT JOIN users executor ON executor.id = cal.executor_id
        LEFT JOIN users owner ON owner.id = cal.owner_id
        LEFT JOIN users client_owner ON client_owner.id = c.owner_id
        LEFT JOIN users creator ON creator.id = cal.created_by_id
        WHERE cal.id = ? AND (cal.deleted_at IS NULL)`
      )
      .get(workUnitId);
  } catch {
    try {
      cal = await db
        .prepare(
          `SELECT
            cal.id,
            cal.client_id,
            cal.title,
            cal.month,
            cal.brand,
            cal.status as cal_status,
            cal.accent as cal_accent,
            cal.assigned_to_id,
            cal.executor_id,
            cal.owner_id as cal_owner_id,
            cal.created_by_id,
            c.name as client_name,
            c.accent as client_accent,
            c.logo_url as client_logo_url,
            c.owner_id as client_owner_id,
            c.created_by_id as client_created_by_id,
            COALESCE(executor.name, assigned.name) as executor_name,
            COALESCE(owner.name, client_owner.name, creator.name) as owner_name,
            creator.name as creator_name
          FROM calendars cal
          INNER JOIN clients c ON c.id = cal.client_id
          LEFT JOIN users assigned ON assigned.id = cal.assigned_to_id
          LEFT JOIN users executor ON executor.id = cal.executor_id
          LEFT JOIN users owner ON owner.id = cal.owner_id
          LEFT JOIN users client_owner ON client_owner.id = c.owner_id
          LEFT JOIN users creator ON creator.id = cal.created_by_id
          WHERE cal.id = ?`
        )
        .get(workUnitId);
    } catch {}
  }

  if (cal) {
    const rawTasks = await getTasksByWorkUnit(cal.id);

    const accountableOwnerId = cal.cal_owner_id || cal.client_owner_id || cal.client_created_by_id || cal.created_by_id;
    const accountableOwnerName = cal.owner_name || cal.creator_name || "Dono do Cliente";
    const defaultExecutorId = cal.executor_id || cal.assigned_to_id || null;
    const defaultExecutorName = cal.executor_name || (defaultExecutorId ? cal.assigned_name : null);
    const effectiveExecutorId = defaultExecutorId || accountableOwnerId;
    const effectiveExecutorName = defaultExecutorName || accountableOwnerName;

    // Mapeia tarefas com resolução de herança
    const tasks: WorkUnitTask[] = rawTasks.map((t) => {
      const isInherited = !t.assigneeId;
      const effectiveId = t.assigneeId || effectiveExecutorId;
      const effectiveName = isInherited
        ? (effectiveExecutorName || "Executor padrão do calendário")
        : (t.assigneeName || "Membro");
      return {
        ...t,
        ownerId: accountableOwnerId,
        ownerName: accountableOwnerName,
        effectiveAssigneeId: effectiveId,
        effectiveAssigneeName: effectiveName,
        isInheritedAssignment: isInherited,
      };
    });

    const userCounts = new Map<string, { count: number; name: string }>();
    tasks.forEach((t) => {
      const effId = t.effectiveAssigneeId;
      const effName = t.effectiveAssigneeName || "Membro";
      if (effId) {
        const cur = userCounts.get(effId) || { count: 0, name: effName };
        cur.count++;
        userCounts.set(effId, cur);
      }
    });

    const assignmentBreakdown: AssignmentBreakdownItem[] = Array.from(userCounts.entries()).map(
      ([uId, val]) => ({
        userId: uId,
        userName: val.name,
        count: val.count,
        isDefaultExecutor: uId === effectiveExecutorId,
      })
    );

    const breakdown = getWorkUnitBreakdownFromTasks(tasks);
    const progress = getWorkUnitProgressFromTasks(tasks);
    const events = await getActivityEvents(cal.id, "work_unit");

    let formattedMonth = cal.month;
    try {
      formattedMonth = monthLabel(parseMonthKey(cal.month));
    } catch {}

    const unit: WorkQueueUnitItem = {
      kind: "workUnit",
      id: cal.id,
      clientId: cal.client_id,
      clientName: cal.client_name || cal.brand,
      clientAccent: cal.client_accent || cal.cal_accent || "#ef5d3d",
      clientLogoUrl: cal.client_logo_url,
      type: "calendar",
      sourceId: cal.id,
      title: cal.title || `Calendário de ${formattedMonth}`,
      status: normalizeTaskStatus(cal.cal_status),
      ownerId: accountableOwnerId,
      ownerName: accountableOwnerName,
      executorId: defaultExecutorId,
      executorName: defaultExecutorName,
      assigneeId: defaultExecutorId,
      assigneeName: defaultExecutorName,
      effectiveAssigneeId: effectiveExecutorId,
      effectiveAssigneeName: effectiveExecutorName,
      createdById: cal.created_by_id,
      createdByName: cal.creator_name,
      dueDate: cal.global_deadline || `${cal.month}-28`,
      taskCount: tasks.length,
      breakdown,
      assignmentBreakdown: assignmentBreakdown.length > 0 ? assignmentBreakdown : undefined,
      progress,
    };

    return { unit, tasks, events };
  }

  // 2. Se não for calendário, verifica na tabela work_units
  try {
    const wu = await db
      .prepare(
        `SELECT
          wu.id,
          wu.client_id,
          wu.type,
          wu.source_id,
          wu.title,
          wu.status,
          wu.owner_id,
          wu.executor_id,
          wu.assignee_id,
          wu.created_by_id,
          wu.due_date,
          c.name as client_name,
          c.accent as client_accent,
          c.logo_url as client_logo_url,
          c.owner_id as client_owner_id,
          c.created_by_id as client_created_by_id,
          COALESCE(owner.name, client_owner.name, creator.name) as owner_name,
          COALESCE(executor.name, assigned.name) as executor_name,
          creator.name as creator_name
        FROM work_units wu
        INNER JOIN clients c ON c.id = wu.client_id
        LEFT JOIN users owner ON owner.id = wu.owner_id
        LEFT JOIN users client_owner ON client_owner.id = c.owner_id
        LEFT JOIN users executor ON executor.id = wu.executor_id
        LEFT JOIN users assigned ON assigned.id = wu.assignee_id
        LEFT JOIN users creator ON creator.id = wu.created_by_id
        WHERE wu.id = ? AND (wu.deleted_at IS NULL)`
      )
      .get(workUnitId);

    if (wu) {
      const rawTasks = await getTasksByWorkUnit(wu.id);

      const accountableOwnerId = wu.owner_id || wu.client_owner_id || wu.client_created_by_id || wu.created_by_id;
      const accountableOwnerName = wu.owner_name || wu.creator_name || "Dono do Cliente";
      const defaultExecutorId = wu.executor_id || wu.assignee_id || null;
      const defaultExecutorName = wu.executor_name || (defaultExecutorId ? wu.assignee_name : null);
      const effectiveExecutorId = defaultExecutorId || accountableOwnerId;
      const effectiveExecutorName = defaultExecutorName || accountableOwnerName;

      const tasks: WorkUnitTask[] = rawTasks.map((t) => {
        const isInherited = !t.assigneeId;
        const effectiveId = t.assigneeId || effectiveExecutorId;
        const effectiveName = isInherited
          ? (effectiveExecutorName || "Executor padrão")
          : (t.assigneeName || "Membro");
        return {
          ...t,
          ownerId: accountableOwnerId,
          ownerName: accountableOwnerName,
          effectiveAssigneeId: effectiveId,
          effectiveAssigneeName: effectiveName,
          isInheritedAssignment: isInherited,
        };
      });

      const userCounts = new Map<string, { count: number; name: string }>();
      tasks.forEach((t) => {
        const effId = t.effectiveAssigneeId;
        const effName = t.effectiveAssigneeName || "Membro";
        if (effId) {
          const cur = userCounts.get(effId) || { count: 0, name: effName };
          cur.count++;
          userCounts.set(effId, cur);
        }
      });

      const assignmentBreakdown: AssignmentBreakdownItem[] = Array.from(userCounts.entries()).map(
        ([uId, val]) => ({
          userId: uId,
          userName: val.name,
          count: val.count,
          isDefaultExecutor: uId === effectiveExecutorId,
        })
      );

      const breakdown = getWorkUnitBreakdownFromTasks(tasks);
      const progress = getWorkUnitProgressFromTasks(tasks);
      const events = await getActivityEvents(wu.id, "work_unit");

      const unit: WorkQueueUnitItem = {
        kind: "workUnit",
        id: wu.id,
        clientId: wu.client_id,
        clientName: wu.client_name,
        clientAccent: wu.client_accent || "#ef5d3d",
        clientLogoUrl: wu.client_logo_url,
        type: (wu.type as WorkUnitType) || "extra_request",
        sourceId: wu.source_id,
        title: wu.title,
        status: normalizeTaskStatus(wu.status),
        ownerId: accountableOwnerId,
        ownerName: accountableOwnerName,
        executorId: defaultExecutorId,
        executorName: defaultExecutorName,
        assigneeId: defaultExecutorId,
        assigneeName: defaultExecutorName,
        effectiveAssigneeId: effectiveExecutorId,
        effectiveAssigneeName: effectiveExecutorName,
        createdById: wu.created_by_id,
        createdByName: wu.creator_name,
        dueDate: wu.due_date,
        taskCount: tasks.length,
        breakdown,
        assignmentBreakdown: assignmentBreakdown.length > 0 ? assignmentBreakdown : undefined,
        progress,
      };

      return { unit, tasks, events };
    }
  } catch {}

  return null;
}

/**
 * Busca todas as tarefas ativas pertencentes a uma WorkUnit.
 */
export async function getTasksByWorkUnit(workUnitId: string): Promise<WorkUnitTask[]> {
  const db = getDb();

  // 1. Tenta calendar_items vinculados
  try {
    const items = await db
      .prepare(
        `SELECT
          ci.id,
          ci.calendar_id,
          ci.title,
          ci.type,
          ci.status,
          ci.date,
          ci.head,
          ci.caption,
          ci.image_url,
          ci.visual,
          ci.is_extra,
          ci.extra_format,
          ci.assignee_id,
          ci.owner_id,
          ci.created_by_id,
          assigned.name as assignee_name,
          owner.name as owner_name,
          creator.name as creator_name
        FROM calendar_items ci
        LEFT JOIN users assigned ON assigned.id = ci.assignee_id
        LEFT JOIN users owner ON owner.id = ci.owner_id
        LEFT JOIN users creator ON creator.id = ci.created_by_id
        WHERE ci.calendar_id = ? AND (ci.deleted_at IS NULL)
        ORDER BY ci.date ASC, ci.order_index ASC, ci.id ASC`
      )
      .all(workUnitId);

    if (items && items.length > 0) {
      return items.map((it: any) => ({
        id: it.id,
        workUnitId,
        clientId: "",
        title: it.title || "Publicação sem título",
        type: it.type || (it.is_extra ? it.extra_format || "Arte Extra" : "Feed"),
        status: normalizeTaskStatus(it.status),
        dueDate: it.date,
        date: it.date,
        head: it.head,
        caption: it.caption,
        imageUrl: it.image_url || it.visual,
        isExtra: Boolean(it.is_extra),
        extraFormat: it.extra_format,
        assigneeId: it.assignee_id || null,
        assigneeName: it.assignee_name || null,
        ownerId: it.owner_id || null,
        ownerName: it.owner_name || null,
        createdById: it.created_by_id || null,
        createdByName: it.creator_name || null,
      }));
    }
  } catch {}

  // 2. Tenta tabela tasks
  try {
    const taskRows = await db
      .prepare(
        `SELECT
          t.id, t.work_unit_id, t.client_id, t.owner_id, t.assignee_id, t.created_by_id,
          t.title, t.type, t.status, t.due_date,
          owner.name as owner_name, assigned.name as assignee_name, creator.name as creator_name
        FROM tasks t
        LEFT JOIN users owner ON owner.id = t.owner_id
        LEFT JOIN users assigned ON assigned.id = t.assignee_id
        LEFT JOIN users creator ON creator.id = t.created_by_id
        WHERE t.work_unit_id = ? AND (t.deleted_at IS NULL)
        ORDER BY t.due_date ASC, t.created_at ASC`
      )
      .all(workUnitId);

    return taskRows.map((t: any) => ({
      id: t.id,
      workUnitId: t.work_unit_id,
      clientId: t.client_id,
      ownerId: t.owner_id,
      ownerName: t.owner_name,
      assigneeId: t.assignee_id || null,
      assigneeName: t.assignee_name || null,
      createdById: t.created_by_id,
      createdByName: t.creator_name,
      title: t.title,
      type: t.type,
      status: normalizeTaskStatus(t.status),
      dueDate: t.due_date,
    }));
  } catch {
    return [];
  }
}

/**
 * Calcula o progresso de tarefas.
 */
function getWorkUnitProgressFromTasks(tasks: WorkUnitTask[]) {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === "completed").length;
  return {
    total,
    completed,
    pending: total - completed,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

export async function getWorkUnitProgress(workUnitId: string) {
  const tasks = await getTasksByWorkUnit(workUnitId);
  return getWorkUnitProgressFromTasks(tasks);
}

/**
 * Calcula o breakdown de formatos de uma WorkUnit.
 */
function getWorkUnitBreakdownFromTasks(tasks: WorkUnitTask[]) {
  let feedStory = 0;
  let videos = 0;
  let extras = 0;
  let other = 0;

  tasks.forEach((t) => {
    if (t.isExtra) {
      extras++;
    } else {
      const typeStr = (t.type || "").toLowerCase();
      if (
        typeStr.includes("video") ||
        typeStr.includes("vídeo") ||
        typeStr.includes("reels") ||
        typeStr.includes("tiktok")
      ) {
        videos++;
      } else if (
        typeStr.includes("feed") ||
        typeStr.includes("story") ||
        typeStr.includes("carrossel") ||
        typeStr.includes("post")
      ) {
        feedStory++;
      } else {
        other++;
      }
    }
  });

  return { feedStory, videos, extras, other };
}

export async function getWorkUnitBreakdown(workUnitId: string) {
  const tasks = await getTasksByWorkUnit(workUnitId);
  return getWorkUnitBreakdownFromTasks(tasks);
}

/**
 * 2. Atualiza o status de uma tarefa individual e registra no histórico de auditoria.
 */
export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  actorId?: string
): Promise<boolean> {
  const db = getDb();
  const now = new Date().toISOString();
  const legacyStatus = taskStatusToLegacyItem(status);

  // 1. Busca estado anterior para histórico
  let oldStatus: string | null = null;
  let taskTitle = "";
  try {
    const prevItem = await db
      .prepare("SELECT title, status FROM calendar_items WHERE id = ?")
      .get(taskId);
    if (prevItem) {
      oldStatus = normalizeTaskStatus(prevItem.status);
      taskTitle = prevItem.title || "";
    } else {
      const prevTask = await db
        .prepare("SELECT title, status FROM tasks WHERE id = ?")
        .get(taskId);
      if (prevTask) {
        oldStatus = normalizeTaskStatus(prevTask.status);
        taskTitle = prevTask.title || "";
      }
    }
  } catch {}

  let updated = false;

  // 2. Tenta atualizar na tabela calendar_items
  try {
    const resItem = await db
      .prepare("UPDATE calendar_items SET status = ?, updated_at = ? WHERE id = ?")
      .run(legacyStatus, now, taskId);
    if (resItem.changes > 0) updated = true;
  } catch {}

  // 3. Tenta atualizar na tabela tasks
  if (!updated) {
    try {
      const resTask = await db
        .prepare("UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?")
        .run(status, now, taskId);
      if (resTask.changes > 0) updated = true;
    } catch {}
  }

  // 4. Registra no histórico de auditoria (Append-only)
  if (updated && actorId) {
    await recordActivityEvent({
      entityType: "task",
      entityId: taskId,
      actorId,
      eventType: status === "completed" ? "completed" : "status_changed",
      fieldName: "status",
      oldValue: oldStatus ? TASK_STATUS_LABELS[oldStatus as TaskStatus] || oldStatus : undefined,
      newValue: TASK_STATUS_LABELS[status],
      metadata: { taskTitle, oldStatusRaw: oldStatus, newStatusRaw: status },
    });
  }

  return updated;
}

/**
 * 2. Atualiza o status de uma WorkUnit e registra no histórico.
 */
export async function updateWorkUnitStatus(
  workUnitId: string,
  status: TaskStatus,
  actorId?: string
): Promise<boolean> {
  const db = getDb();
  const now = new Date().toISOString();
  const legacyCalStatus = taskStatusToLegacyCalendar(status);

  let oldStatus: string | null = null;
  let unitTitle = "";
  try {
    const prevCal = await db
      .prepare("SELECT title, status FROM calendars WHERE id = ?")
      .get(workUnitId);
    if (prevCal) {
      oldStatus = normalizeTaskStatus(prevCal.status);
      unitTitle = prevCal.title || "";
    } else {
      const prevWu = await db
        .prepare("SELECT title, status FROM work_units WHERE id = ?")
        .get(workUnitId);
      if (prevWu) {
        oldStatus = normalizeTaskStatus(prevWu.status);
        unitTitle = prevWu.title || "";
      }
    }
  } catch {}

  let updated = false;

  // 1. Tenta atualizar calendário
  try {
    const resCal = await db
      .prepare("UPDATE calendars SET status = ?, updated_at = ? WHERE id = ?")
      .run(legacyCalStatus, now, workUnitId);
    if (resCal.changes > 0) updated = true;
  } catch {}

  // 2. Tenta atualizar work_units
  if (!updated) {
    try {
      const resWu = await db
        .prepare("UPDATE work_units SET status = ?, updated_at = ? WHERE id = ?")
        .run(status, now, workUnitId);
      if (resWu.changes > 0) updated = true;
    } catch {}
  }

  // 3. Registra no histórico
  if (updated && actorId) {
    await recordActivityEvent({
      entityType: "work_unit",
      entityId: workUnitId,
      actorId,
      eventType: status === "completed" ? "completed" : "status_changed",
      fieldName: "status",
      oldValue: oldStatus ? TASK_STATUS_LABELS[oldStatus as TaskStatus] || oldStatus : undefined,
      newValue: TASK_STATUS_LABELS[status],
      metadata: { unitTitle, oldStatusRaw: oldStatus, newStatusRaw: status },
    });
  }

  return updated;
}

/**
 * 6. Resolução hierárquica centralizada do executor da tarefa:
 * Prioridade:
 * 1. Task-level Assignment Override (task.assigneeId)
 * 2. Calendar-level Assignment (calendar.executorId)
 * 3. Inherited Ownership (calendar.ownerId)
 * 4. Client Owner (client.ownerId)
 */
export function resolveTaskAssignee(params: {
  assigneeId?: string | null;
  executorId?: string | null;
  ownerId?: string | null;
  clientOwnerId?: string | null;
}): string | null {
  if (params.assigneeId) {
    return params.assigneeId;
  }
  if (params.executorId) {
    return params.executorId;
  }
  if (params.ownerId) {
    return params.ownerId;
  }
  if (params.clientOwnerId) {
    return params.clientOwnerId;
  }
  return null;
}

/**
 * 4. Delegação no calendário inteiro (Calendar-level Assignment).
 * Define executorId para o calendário/workUnit.
 * Todas as tarefas que herdam do calendário passam automaticamente para esse executor.
 */
export async function assignCalendarExecutor(params: {
  calendarId: string;
  executorId?: string | null;
  actorId: string;
}): Promise<boolean> {
  const { calendarId, executorId, actorId } = params;
  const db = getDb();
  const now = new Date().toISOString();

  let oldExecutorName = "Nenhum";
  let oldExecutorId: string | null = null;
  try {
    const prev = await db
      .prepare(
        `SELECT COALESCE(cal.executor_id, cal.assigned_to_id) as ex_id, u.name
         FROM calendars cal
         LEFT JOIN users u ON u.id = COALESCE(cal.executor_id, cal.assigned_to_id)
         WHERE cal.id = ?`
      )
      .get(calendarId);
    if (prev) {
      oldExecutorId = prev.ex_id;
      oldExecutorName = prev.name || "Nenhum";
    }
  } catch {}

  let newExecutorName = "Nenhum";
  if (executorId) {
    const u = await db.prepare("SELECT name FROM users WHERE id = ?").get(executorId);
    if (u) newExecutorName = u.name;
  }

  const finalVal = executorId || null;

  try {
    await db
      .prepare("UPDATE calendars SET executor_id = ?, assigned_to_id = ?, updated_at = ? WHERE id = ?")
      .run(finalVal, finalVal, now, calendarId);
  } catch {}

  try {
    await db
      .prepare("UPDATE work_units SET executor_id = ?, assignee_id = ?, updated_at = ? WHERE id = ?")
      .run(finalVal, finalVal, now, calendarId);
  } catch {}

  if (actorId) {
    await recordActivityEvent({
      entityType: "work_unit",
      entityId: calendarId,
      actorId,
      eventType: oldExecutorId ? "calendar_executor_changed" : "calendar_executor_assigned",
      fieldName: "executor_id",
      oldValue: oldExecutorName,
      newValue: newExecutorName,
      metadata: { executorId: finalVal, oldExecutorId, newExecutorName },
    });
  }

  return true;
}

/**
 * 7. Atribui a tarefa para um executor (assigneeId).
 * Se assigneeId for nulo/vazio/"inherit", limpa o override para herdar do calendário.
 */
export async function assignTask(params: {
  taskId: string;
  assigneeId?: string | null;
  actorId: string;
  kind?: "workUnit" | "task";
}): Promise<boolean> {
  const { taskId, assigneeId, actorId, kind = "task" } = params;
  const db = getDb();
  const now = new Date().toISOString();

  if (kind === "workUnit") {
    return assignCalendarExecutor({
      calendarId: taskId,
      executorId: assigneeId || undefined,
      actorId,
    });
  }

  // Atribuição de tarefa individual (com suporte a "Herdar do calendário")
  const isClearingOverride = !assigneeId || assigneeId === "" || assigneeId === "inherit";

  let oldAssigneeName = "Herdado do calendário";
  try {
    const prevItem = await db
      .prepare(
        `SELECT ci.assignee_id, u.name as assignee_name
         FROM calendar_items ci
         LEFT JOIN users u ON u.id = ci.assignee_id
         WHERE ci.id = ?`
      )
      .get(taskId);
    if (prevItem) {
      oldAssigneeName = prevItem.assignee_name || "Herdado do calendário";
    } else {
      const prevTask = await db
        .prepare(
          `SELECT t.assignee_id, u.name as assignee_name
           FROM tasks t
           LEFT JOIN users u ON u.id = t.assignee_id
           WHERE t.id = ?`
        )
        .get(taskId);
      if (prevTask) {
        oldAssigneeName = prevTask.assignee_name || "Herdado do calendário";
      }
    }
  } catch {}

  let targetUserName = "Herdar do calendário";
  if (!isClearingOverride) {
    const user = await db.prepare("SELECT name FROM users WHERE id = ?").get(assigneeId);
    if (user) targetUserName = user.name;
  }

  const finalAssigneeValue = isClearingOverride ? null : assigneeId;

  // 1. Tenta atualizar na tabela calendar_items
  let updated = false;
  try {
    const resItem = await db
      .prepare("UPDATE calendar_items SET assignee_id = ?, updated_at = ? WHERE id = ?")
      .run(finalAssigneeValue, now, taskId);
    if (resItem.changes > 0) updated = true;
  } catch {}

  // 2. Tenta atualizar na tabela tasks
  try {
    const resTask = await db
      .prepare("UPDATE tasks SET assignee_id = ?, updated_at = ? WHERE id = ?")
      .run(finalAssigneeValue, now, taskId);
    if (resTask.changes > 0) updated = true;
  } catch {}

  // 3. Registra no histórico de auditoria
  await recordActivityEvent({
    entityType: "task",
    entityId: taskId,
    actorId,
    eventType: isClearingOverride
      ? "task_assignment_inherited"
      : "task_assignee_changed",
    fieldName: "assignee_id",
    oldValue: oldAssigneeName,
    newValue: targetUserName,
    metadata: {
      assigneeId: finalAssigneeValue,
      isInherited: isClearingOverride,
      targetUserName,
    },
  });

  return updated;
}

/**
 * 7. Altera o responsável (ownerId / accountable owner).
 */
export async function changeTaskOwner(params: {
  taskId: string;
  ownerId: string;
  actorId: string;
  kind?: "workUnit" | "task";
}): Promise<boolean> {
  const { taskId, ownerId, actorId, kind = "task" } = params;
  const db = getDb();
  const now = new Date().toISOString();

  let ownerName = "Usuário";
  const user = await db.prepare("SELECT name FROM users WHERE id = ?").get(ownerId);
  if (user) ownerName = user.name;

  if (kind === "workUnit") {
    try {
      await db
        .prepare("UPDATE calendars SET owner_id = ?, updated_at = ? WHERE id = ?")
        .run(ownerId, now, taskId);
    } catch {}
    try {
      await db
        .prepare("UPDATE work_units SET owner_id = ?, updated_at = ? WHERE id = ?")
        .run(ownerId, now, taskId);
    } catch {}
  } else {
    try {
      await db
        .prepare("UPDATE calendar_items SET owner_id = ?, updated_at = ? WHERE id = ?")
        .run(ownerId, now, taskId);
    } catch {}
    try {
      await db
        .prepare("UPDATE tasks SET owner_id = ?, updated_at = ? WHERE id = ?")
        .run(ownerId, now, taskId);
    } catch {}
  }

  await recordActivityEvent({
    entityType: kind === "workUnit" ? "work_unit" : "task",
    entityId: taskId,
    actorId,
    eventType: "owner_changed",
    fieldName: "owner_id",
    newValue: ownerName,
    metadata: { ownerId, ownerName },
  });

  return true;
}

/**
 * 4. Exclusão de Tarefa com Soft Delete e histórico.
 */
export async function softDeleteTask(taskId: string, actorId?: string): Promise<boolean> {
  const db = getDb();
  const now = new Date().toISOString();

  let changes = 0;
  try {
    const resItem = await db
      .prepare("UPDATE calendar_items SET deleted_at = ?, updated_at = ? WHERE id = ?")
      .run(now, now, taskId);
    changes += resItem.changes;
  } catch {}

  try {
    const resTask = await db
      .prepare("UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ?")
      .run(now, now, taskId);
    changes += resTask.changes;
  } catch {}

  if (changes > 0 && actorId) {
    await recordActivityEvent({
      entityType: "task",
      entityId: taskId,
      actorId,
      eventType: "deleted",
      fieldName: "deleted_at",
      newValue: now,
    });
  }

  return changes > 0;
}

/**
 * 4. Desfazer exclusão com histórico.
 */
export async function restoreTask(taskId: string, actorId?: string): Promise<boolean> {
  const db = getDb();
  const now = new Date().toISOString();

  let changes = 0;
  try {
    const resItem = await db
      .prepare("UPDATE calendar_items SET deleted_at = NULL, updated_at = ? WHERE id = ?")
      .run(now, taskId);
    changes += resItem.changes;
  } catch {}

  try {
    const resTask = await db
      .prepare("UPDATE tasks SET deleted_at = NULL, updated_at = ? WHERE id = ?")
      .run(now, taskId);
    changes += resTask.changes;
  } catch {}

  if (changes > 0 && actorId) {
    await recordActivityEvent({
      entityType: "task",
      entityId: taskId,
      actorId,
      eventType: "restored",
      fieldName: "deleted_at",
      newValue: "Restaurada",
    });
  }

  return changes > 0;
}

/**
 * Soft Delete para WorkUnit inteira com histórico.
 */
export async function softDeleteWorkUnit(workUnitId: string, actorId?: string): Promise<boolean> {
  const db = getDb();
  const now = new Date().toISOString();

  let changes = 0;
  try {
    const resCal = await db
      .prepare("UPDATE calendars SET deleted_at = ?, updated_at = ? WHERE id = ?")
      .run(now, now, workUnitId);
    changes += resCal.changes;
  } catch {}

  try {
    const resWu = await db
      .prepare("UPDATE work_units SET deleted_at = ?, updated_at = ? WHERE id = ?")
      .run(now, now, workUnitId);
    changes += resWu.changes;
  } catch {}

  if (changes > 0 && actorId) {
    await recordActivityEvent({
      entityType: "work_unit",
      entityId: workUnitId,
      actorId,
      eventType: "deleted",
      fieldName: "deleted_at",
      newValue: now,
    });
  }

  return changes > 0;
}

/**
 * Desfazer exclusão de WorkUnit com histórico.
 */
export async function restoreWorkUnit(workUnitId: string, actorId?: string): Promise<boolean> {
  const db = getDb();
  const now = new Date().toISOString();

  let changes = 0;
  try {
    const resCal = await db
      .prepare("UPDATE calendars SET deleted_at = NULL, updated_at = ? WHERE id = ?")
      .run(now, workUnitId);
    changes += resCal.changes;
  } catch {}

  try {
    const resWu = await db
      .prepare("UPDATE work_units SET deleted_at = NULL, updated_at = ? WHERE id = ?")
      .run(now, workUnitId);
    changes += resWu.changes;
  } catch {}

  if (changes > 0 && actorId) {
    await recordActivityEvent({
      entityType: "work_unit",
      entityId: workUnitId,
      actorId,
      eventType: "restored",
      fieldName: "deleted_at",
      newValue: "Restaurada",
    });
  }

  return changes > 0;
}
