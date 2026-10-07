/**
 * Service central para Demandas Globais / Extras, Work Units e Tasks.
 * Modelo canônico: Client -> WorkUnit -> Task -> Asset / ActivityEvent.
 */

import { getDb } from "./db";
import crypto from "node:crypto";
import type {
  CreateExtraDemandInput,
  DeliveryDefinition,
  ClientAssignmentContext,
  WorkUnit,
  Task,
  Priority,
  TaskStatus,
} from "./task-types";

/**
 * Traduz o código do tipo de entrega para um label amigável em português.
 */
export function formatDeliveryTypeLabel(type: string): string {
  const t = (type || "").toLowerCase().trim();
  switch (t) {
    case "feed_story":
    case "feed":
      return "Feed / Story";
    case "reel":
    case "video":
    case "vídeo":
      return "Reel / Vídeo";
    case "banner":
      return "Banner";
    case "encarte":
      return "Encarte";
    case "impresso":
      return "Impresso";
    case "capa":
      return "Capa";
    case "criativo_avulso":
    case "creative":
      return "Criativo Avulso";
    default:
      return type.charAt(0).toUpperCase() + type.slice(1);
  }
}

/**
 * Regra de Atribuição Obrigatória:
 * task.assigneeId ?? workUnit.executorId ?? workUnit.ownerId ?? client.ownerId
 */
export function resolveEffectiveAssignee({
  task,
  workUnit,
  client,
}: {
  task: { assigneeId?: string | null };
  workUnit: { executorId?: string | null; ownerId?: string | null };
  client: { ownerId?: string | null };
}): string | null {
  return (
    task.assigneeId ??
    workUnit.executorId ??
    workUnit.ownerId ??
    client.ownerId ??
    null
  );
}

/**
 * Regra de Prazo Efetivo:
 * task.dueDate ?? workUnit.dueDate
 */
export function resolveEffectiveDueDate(
  task: { dueDate?: string | null },
  workUnit: { dueDate?: string | null }
): string | null {
  return task.dueDate ?? workUnit.dueDate ?? null;
}

/**
 * Expande definições de entregas no servidor gerando as Tasks reais sequenciadas.
 * Exemplo: 3 × Reel -> Reel 01, Reel 02, Reel 03
 */
export function expandDeliveryDefinitions(
  deliveries: DeliveryDefinition[]
): Array<{
  type: string;
  title: string;
  assigneeId?: string | null;
  dueDate?: string | null;
  description?: string;
  position: number;
}> {
  const expanded: Array<{
    type: string;
    title: string;
    assigneeId?: string | null;
    dueDate?: string | null;
    description?: string;
    position: number;
  }> = [];

  let globalPos = 0;

  for (const del of deliveries) {
    const qty = Math.max(1, Number(del.quantity || 1));
    const baseType = del.type || "arte";
    const baseLabel = formatDeliveryTypeLabel(baseType);

    for (let i = 1; i <= qty; i++) {
      let taskTitle = del.title?.trim();
      if (!taskTitle) {
        taskTitle = qty > 1 ? `${baseLabel} ${String(i).padStart(2, "0")}` : baseLabel;
      } else if (qty > 1) {
        taskTitle = `${taskTitle} ${String(i).padStart(2, "0")}`;
      }

      expanded.push({
        type: baseType,
        title: taskTitle,
        assigneeId: del.assigneeId || null,
        dueDate: del.dueDate || null,
        description: del.description || "",
        position: globalPos++,
      });
    }
  }

  return expanded;
}

/**
 * Obtém o contexto de atribuição estrutural do cliente:
 * id, name, owner (Client Owner)
 */
export async function getClientAssignmentContext(
  clientId: string
): Promise<ClientAssignmentContext | null> {
  const db = getDb();
  const row = (await db
    .prepare(
      `SELECT c.id, c.name, c.owner_id, u.name as owner_name
       FROM clients c
       LEFT JOIN users u ON u.id = c.owner_id
       WHERE c.id = ?`
    )
    .get(clientId)) as any;

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    owner: row.owner_id
      ? {
          id: row.owner_id,
          name: row.owner_name || "Dono do Cliente",
        }
      : null,
  };
}

/**
 * Mutation Principal Atômica: Criação de Demanda Extra (Work Unit + Tasks em transaction).
 * Atende aos requisitos de RBAC, herança de owner, expansão server-side e auditoria.
 */
export async function createExtraDemand(
  currentUser: { id: string; role: string; name?: string },
  input: CreateExtraDemandInput
): Promise<{ workUnit: WorkUnit; tasks: Task[] }> {
  // 1. RBAC no servidor
  if (currentUser.role !== "admin" && currentUser.role !== "social_media") {
    throw new Error(
      "Acesso não autorizado: Somente administradores ou social media podem criar demandas."
    );
  }

  // 2. Validações básicas do payload
  if (!input.clientId) {
    throw new Error("O cliente é obrigatório para criar a demanda.");
  }
  if (!input.title || input.title.trim().length === 0) {
    throw new Error("O título da demanda é obrigatório.");
  }
  if (!input.deliveries || input.deliveries.length === 0) {
    throw new Error("A demanda precisa de pelo menos uma entrega definida.");
  }

  const db = getDb();

  // 3. Busca cliente e seu ownerId
  const clientRow = (await db
    .prepare("SELECT id, name, owner_id FROM clients WHERE id = ?")
    .get(input.clientId)) as { id: string; name: string; owner_id?: string } | undefined;

  if (!clientRow) {
    throw new Error("Cliente não encontrado.");
  }

  const clientOwnerId = clientRow.owner_id || null;

  // 4. Se executor manual foi informado, valida existência
  let validatedExecutorId: string | null = null;
  if (input.executorId) {
    const userExists = await db
      .prepare("SELECT id FROM users WHERE id = ?")
      .get(input.executorId);
    if (userExists) {
      validatedExecutorId = input.executorId;
    }
  }

  const workUnitId = crypto.randomUUID();
  const now = new Date().toISOString();
  const priority: Priority = ["low", "normal", "high", "urgent"].includes(input.priority)
    ? input.priority
    : "normal";
  const dueDate = input.dueDate || null;
  const description = input.description ? input.description.trim() : "";

  // 5. Expansão das entregas em Tasks individuais
  const expandedTasks = expandDeliveryDefinitions(input.deliveries);

  const createdTasks: Task[] = [];

  // 6. Transação atômica
  await db.transaction(async (tx) => {
    // 6.1 Insere a Work Unit
    await tx.prepare(`
      INSERT INTO work_units (
        id, client_id, type, title, description,
        owner_id, executor_id, priority, status,
        due_date, created_by_id, created_at, updated_at
      )
      VALUES (?, ?, 'extra_request', ?, ?, ?, ?, ?, 'not_started', ?, ?, ?, ?)
    `).run(
      workUnitId,
      input.clientId,
      input.title.trim(),
      description,
      clientOwnerId,
      validatedExecutorId,
      priority,
      dueDate,
      currentUser.id,
      now,
      now
    );

    // 6.2 Bulk insert das Tasks
    for (const t of expandedTasks) {
      const taskId = crypto.randomUUID();
      const taskDueDate = t.dueDate || null;

      await tx.prepare(`
        INSERT INTO tasks (
          id, work_unit_id, client_id, owner_id, assignee_id,
          created_by_id, title, description, type, position,
          status, due_date, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'not_started', ?, ?, ?)
      `).run(
        taskId,
        workUnitId,
        input.clientId,
        clientOwnerId,
        t.assigneeId || null,
        currentUser.id,
        t.title,
        t.description || "",
        t.type,
        t.position,
        taskDueDate,
        now,
        now
      );

      createdTasks.push({
        id: taskId,
        workUnitId,
        clientId: input.clientId,
        ownerId: clientOwnerId || undefined,
        assigneeId: t.assigneeId || null,
        createdById: currentUser.id,
        title: t.title,
        description: t.description,
        type: t.type,
        position: t.position,
        status: "not_started",
        dueDate: taskDueDate || undefined,
        createdAt: now,
        updatedAt: now,
      });
    }

    // 6.3 Registro de Activity Event
    const eventId = crypto.randomUUID();
    await tx.prepare(`
      INSERT INTO activity_events (
        id, entity_type, entity_id, actor_id, event_type,
        metadata, created_at
      )
      VALUES (?, 'work_unit', ?, ?, 'extra_demand_created', ?, ?)
    `).run(
      eventId,
      workUnitId,
      currentUser.id,
      JSON.stringify({
        title: input.title.trim(),
        taskCount: expandedTasks.length,
        priority,
      }),
      now
    );
  });

  const createdWorkUnit: WorkUnit = {
    id: workUnitId,
    clientId: input.clientId,
    type: "extra_request",
    title: input.title.trim(),
    description,
    priority,
    status: "not_started",
    ownerId: clientOwnerId || undefined,
    executorId: validatedExecutorId,
    createdById: currentUser.id,
    dueDate: dueDate || undefined,
    createdAt: now,
    updatedAt: now,
  };

  return { workUnit: createdWorkUnit, tasks: createdTasks };
}

export interface ClientWorkUnitItem extends WorkUnit {
  clientName?: string;
  clientAccent?: string;
  tasks: Array<Task & { assigneeName?: string | null }>;
  taskCount: number;
  completedCount: number;
}

/**
 * Consulta Work Units filtradas por cliente e tipo (ex: 'extra_request')
 * com suas tarefas completas para exibição consistente na visão do cliente.
 */
export async function getClientWorkUnits(
  clientId: string,
  type?: string
): Promise<ClientWorkUnitItem[]> {
  const db = getDb();
  let sql = `
    SELECT wu.*, c.name as client_name, c.accent as client_accent
    FROM work_units wu
    JOIN clients c ON c.id = wu.client_id
    WHERE wu.client_id = ? AND wu.deleted_at IS NULL
  `;
  const params: any[] = [clientId];

  if (type) {
    sql += " AND wu.type = ?";
    params.push(type);
  }

  sql += " ORDER BY wu.created_at DESC";

  const rows = await db.prepare(sql).all(...params);
  if (!rows || rows.length === 0) return [];

  const workUnitIds = rows.map((r: any) => r.id);
  const placeholders = workUnitIds.map(() => "?").join(",");

  let tasks: any[] = [];
  try {
    tasks = await db
      .prepare(
        `SELECT t.*, u.name as assignee_name
         FROM tasks t
         LEFT JOIN users u ON u.id = t.assignee_id
         WHERE t.work_unit_id IN (${placeholders}) AND t.deleted_at IS NULL
         ORDER BY t.position ASC, t.created_at ASC`
      )
      .all(...workUnitIds);
  } catch {
    tasks = [];
  }

  const tasksByWu = new Map<string, any[]>();
  tasks.forEach((t) => {
    const list = tasksByWu.get(t.work_unit_id) || [];
    list.push({
      id: t.id,
      workUnitId: t.work_unit_id,
      type: t.type,
      title: t.title,
      description: t.description || "",
      assigneeId: t.assignee_id,
      assigneeName: t.assignee_name || null,
      status: t.status,
      dueDate: t.due_date,
      position: t.position || 0,
      createdById: t.created_by_id,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      deletedAt: t.deleted_at,
    });
    tasksByWu.set(t.work_unit_id, list);
  });

  return rows.map((r: any) => {
    const wuTasks = tasksByWu.get(r.id) || [];
    const completedCount = wuTasks.filter((t) => t.status === "completed").length;
    return {
      id: r.id,
      clientId: r.client_id,
      clientName: r.client_name,
      clientAccent: r.client_accent,
      type: r.type,
      sourceId: r.source_id,
      title: r.title,
      description: r.description,
      priority: r.priority || "normal",
      status: r.status,
      ownerId: r.owner_id,
      executorId: r.executor_id,
      assigneeId: r.assignee_id,
      createdById: r.created_by_id,
      dueDate: r.due_date,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      deletedAt: r.deleted_at,
      tasks: wuTasks,
      taskCount: wuTasks.length,
      completedCount,
    };
  });
}

