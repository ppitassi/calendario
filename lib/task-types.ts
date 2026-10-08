/**
 * Definições de tipos e constantes para Fila Global de Trabalho e Unidades de Trabalho.
 * Arquivo puramente TypeScript (sem dependências de servidor/Node) para uso seguro
 * tanto em Client Components quanto em Server Components / APIs.
 */

export type WorkUnitType = "calendar" | "extra_request" | "campaign" | "project";

export type TaskStatus =
  | "not_started"
  | "in_progress"
  | "waiting"
  | "awaiting_approval"
  | "completed";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: "Não iniciado",
  in_progress: "Em execução",
  waiting: "Em espera",
  awaiting_approval: "Aguardando aprovação",
  completed: "Completo",
};

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  not_started: "#94a3b8",
  in_progress: "#38bdf8",
  waiting: "#f59e0b",
  awaiting_approval: "#ec4899",
  completed: "#10b981",
};

export type TaskEventType =
  | "task_created"
  | "calendar_created"
  | "calendar_executor_assigned"
  | "calendar_executor_changed"
  | "task_assignee_changed"
  | "task_assignment_inherited"
  | "task_assignment_override_removed"
  | "status_changed"
  | "assigned"
  | "owner_changed"
  | "title_changed"
  | "description_changed"
  | "due_date_changed"
  | "priority_changed"
  | "comment_added"
  | "attachment_added"
  | "attachment_removed"
  | "moved_to_work_unit"
  | "deleted"
  | "restored"
  | "completed";

export interface ActivityEvent {
  id: string;
  entityType: "task" | "work_unit" | "calendar";
  entityId: string;
  taskId?: string;
  actorId: string;
  actorName?: string;
  eventType: TaskEventType | string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface AssignmentBreakdownItem {
  userId: string;
  userName: string;
  count: number;
  isDefaultExecutor?: boolean;
}

export interface WorkUnitTask {
  id: string;
  workUnitId: string;
  clientId: string;
  ownerId?: string;
  ownerName?: string;
  assigneeId?: string | null;
  assigneeName?: string | null;
  effectiveAssigneeId?: string;
  effectiveAssigneeName?: string;
  isInheritedAssignment?: boolean;
  createdById?: string;
  createdByName?: string;
  title: string;
  type: string;
  status: TaskStatus;
  dueDate?: string;
  date?: string;
  head?: string;
  subhead?: string;
  caption?: string;
  visual?: string;
  cta?: string;
  imageUrl?: string;
  isExtra?: boolean;
  extraFormat?: string;
}

export interface WorkQueueUnitItem {
  kind: "workUnit";
  id: string;
  clientId: string;
  clientName: string;
  clientAccent: string;
  clientLogoUrl?: string;
  type: WorkUnitType;
  sourceId?: string;
  title: string;
  status: TaskStatus;
  ownerId?: string;
  ownerName?: string;
  executorId?: string | null;
  executorName?: string | null;
  assigneeId?: string | null;
  assigneeName?: string | null;
  effectiveAssigneeId?: string;
  effectiveAssigneeName?: string;
  createdById?: string;
  createdByName?: string;
  dueDate?: string;
  taskCount: number;
  breakdown: {
    feedStory: number;
    videos: number;
    extras: number;
    other: number;
  };
  assignmentBreakdown?: AssignmentBreakdownItem[];
  userSpecificTaskCount?: number;
  progress: {
    total: number;
    completed: number;
    pending: number;
    percent: number;
  };
}

export interface WorkQueueTaskItem {
  kind: "task";
  id: string;
  workUnitId?: string;
  clientId: string;
  clientName: string;
  clientAccent: string;
  title: string;
  type: string;
  status: TaskStatus;
  ownerId?: string;
  ownerName?: string;
  assigneeId?: string | null;
  assigneeName?: string | null;
  effectiveAssigneeId?: string;
  effectiveAssigneeName?: string;
  isInheritedAssignment?: boolean;
  createdById?: string;
  createdByName?: string;
  dueDate?: string;
}

export type WorkQueueItem = WorkQueueUnitItem | WorkQueueTaskItem;

export interface WorkUnitDetails {
  unit: WorkQueueUnitItem;
  tasks: WorkUnitTask[];
  events?: ActivityEvent[];
}

export interface WorkQueueFilters {
  scope?: "me" | "team";
  clientId?: string;
  status?: string;
  includeCompleted?: boolean;
  hideCompleted?: boolean;
  excludeStatus?: TaskStatus[];
  search?: string;
  type?: string;
  responsibleFilter?: string; // only applicable in team scope
}

export type Priority = "low" | "normal" | "high" | "urgent";

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  low: "#94a3b8",
  normal: "#38bdf8",
  high: "#f59e0b",
  urgent: "#ef4444",
};

export interface DeliveryDefinition {
  type: string;
  title?: string;
  quantity: number;
  assigneeId?: string | null;
  dueDate?: string | null;
  description?: string;
}

export interface CreateExtraDemandInput {
  clientId: string;
  title: string;
  description?: string;
  executorId?: string | null;
  priority: Priority;
  dueDate?: string | null;
  deliveries: DeliveryDefinition[];
}

export interface ClientAssignmentContext {
  id: string;
  name: string;
  owner: {
    id: string;
    name: string;
  } | null;
}

export interface Task {
  id: string;
  workUnitId?: string;
  clientId: string;
  ownerId?: string;
  ownerName?: string;
  assigneeId?: string | null;
  assigneeName?: string | null;
  createdById?: string;
  createdByName?: string;
  type: string;
  title: string;
  description?: string;
  position?: number;
  status: TaskStatus;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface WorkUnit {
  id: string;
  clientId: string;
  type: WorkUnitType;
  sourceId?: string;
  title: string;
  description?: string;
  priority?: Priority;
  status: TaskStatus;
  ownerId?: string;
  executorId?: string | null;
  assigneeId?: string | null;
  createdById?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

/** Referência a um arquivo que vive exclusivamente no Nextcloud. */
export interface Asset {
  id: string;
  provider: "nextcloud";
  nextcloudFileId: string;
  nextcloudPath: string;
  filename: string;
  mimeType?: string;
  sizeBytes?: number;
  etag?: string;
  workUnitId?: string;
  taskId?: string;
  postId?: string;
  publicationId?: string;
  previewAssetId?: string;
  uploadedById?: string;
  detachedAt?: string;
  archivedAt?: string;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
}

