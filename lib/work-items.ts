import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDbPool, parseJson, rows } from "./db";
import { err, ok } from "./api-response";
import { body, getContext, toMysqlDateTime } from "./api-core/context";
import { handleCapability } from "./work-item-capabilities";

const TYPES = new Set(["PROJECT", "DEMAND", "TASK"]);
const STATUSES = new Set(["TODO", "IN_PROGRESS", "BLOCKED", "REVIEW", "DONE", "CANCELLED"]);
const PRIORITIES = new Set(["LOW", "NORMAL", "HIGH", "CRITICAL"]);
const PARENTS: Record<string, Set<string>> = { PROJECT: new Set(), DEMAND: new Set(["PROJECT"]), TASK: new Set(["PROJECT", "DEMAND"]) };

function cleanEnum(value: unknown, allowed: Set<string>, fallback?: string) {
  const normalized = String(value || fallback || "").toUpperCase();
  return allowed.has(normalized) ? normalized : null;
}
function serialize(row: any) {
  if (!row) return row;
  return { ...row, data_json: parseJson(row.data_json, row.data_json), recurrence_rule_json: parseJson(row.recurrence_rule_json, row.recurrence_rule_json) };
}
async function itemForUpdate(connection: any, id: string) {
  const [result] = await connection.query("SELECT * FROM work_items WHERE id=? AND deleted_at IS NULL FOR UPDATE", [id]);
  return result[0];
}
async function validateParent(connection: any, childType: string, childId: string | null, parentId: string | null) {
  if (!parentId) return null;
  if (parentId === childId) throw Object.assign(new Error("Um item não pode ser pai de si mesmo."), { status: 422 });
  const parent = await itemForUpdate(connection, parentId);
  if (!parent) throw Object.assign(new Error("Item pai não encontrado."), { status: 404 });
  if (!PARENTS[childType]?.has(parent.type)) throw Object.assign(new Error(`${childType} não pode ser vinculado a ${parent.type}.`), { status: 422 });
  if (childId) {
    let cursor: string | null = parent.parent_id;
    while (cursor) {
      if (cursor === childId) throw Object.assign(new Error("O vínculo criaria um ciclo."), { status: 422 });
      const [ancestors] = await connection.query("SELECT parent_id FROM work_items WHERE id=?", [cursor]);
      cursor = ancestors[0]?.parent_id || null;
    }
  }
  return parent;
}
async function event(connection: any, workItemId: string, actorId: string | null, eventType: string, data: unknown = null) {
  await connection.query("INSERT INTO work_item_events (work_item_id,actor_id,event_type,data_json) VALUES (?,?,?,?)", [workItemId, actorId, eventType, data == null ? null : JSON.stringify(data)]);
}
async function recalculateAncestors(connection:any,startParentId:string|null){let parentId=startParentId;while(parentId){const [parents]=await connection.query("SELECT parent_id,progress_strategy FROM work_items WHERE id=? FOR UPDATE",[parentId]);const parent=parents[0];if(!parent)break;if(parent.progress_strategy!=="MANUAL")await connection.query(`UPDATE work_items parent SET progress=COALESCE((SELECT CASE WHEN parent.progress_strategy='CHILDREN_WEIGHTED' THEN SUM(child.progress*child.progress_weight)/NULLIF(SUM(child.progress_weight),0) ELSE AVG(child.progress) END FROM work_items child WHERE child.parent_id=parent.id AND child.deleted_at IS NULL),0) WHERE parent.id=?`,[parentId]);parentId=parent.parent_id;}}
function requireManage(ctx: any) { return ctx.permissions.has("TASK_MANAGE") || ctx.permissions.has("PROJECT_MANAGE") || ctx.permissions.has("DEMAND_MANAGE") || ctx.userRole === "admin"; }

async function listWorkItems(req: NextRequest) {
  const url = new URL(req.url); const where = ["w.deleted_at IS NULL"]; const params: unknown[] = [];
  for (const [key, column] of [["type", "w.type"], ["status", "w.status"], ["clientId", "w.client_id"], ["parentId", "w.parent_id"]] as const) {
    const value = url.searchParams.get(key); if (value) { where.push(`${column}=?`); params.push(value); }
  }
  if (url.searchParams.get("archived") !== "true") where.push("w.archived_at IS NULL");
  const assignedTo = url.searchParams.get("assignedTo");
  if (assignedTo) { where.push("EXISTS (SELECT 1 FROM work_item_assignees a WHERE a.work_item_id=w.id AND a.user_id=? AND a.removed_at IS NULL)"); params.push(assignedTo); }
  const result = await rows(`SELECT w.*,c.display_name client_name,(SELECT COUNT(*) FROM work_items child WHERE child.parent_id=w.id AND child.deleted_at IS NULL) child_count FROM work_items w LEFT JOIN clients c ON c.id=w.client_id WHERE ${where.join(" AND ")} ORDER BY w.due_at IS NULL,w.due_at,w.created_at DESC LIMIT 500`, params);
  return ok(result.map(serialize));
}

async function createWorkItem(req: NextRequest, userId: string) {
  const input = await body(req); const type = cleanEnum(input.type, TYPES); const status = cleanEnum(input.status, STATUSES, "TODO"); const priority = cleanEnum(input.priority, PRIORITIES, "NORMAL");
  if (!type || !status || !priority || !String(input.title || "").trim()) return err("Tipo, título, status ou prioridade inválidos.", 422);
  const connection = await getDbPool().getConnection(); const id = randomUUID();
  try {
    await connection.beginTransaction();
    const parent = await validateParent(connection, type, null, input.parentId || null);
    const clientId = input.clientId || parent?.client_id || null;
    if (parent?.client_id && clientId && parent.client_id !== clientId) return err("O cliente deve ser o mesmo do item pai.", 422);
    await connection.query(`INSERT INTO work_items (id,type,title,description,client_id,parent_id,status,priority,progress,progress_strategy,created_by,start_at,due_at,recurrence_rule_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [id, type, String(input.title).trim(), input.description || null, clientId, input.parentId || null, status, priority, Math.min(100, Math.max(0, Number(input.progress || 0))), input.progressStrategy || "CHILDREN_AVERAGE", userId, toMysqlDateTime(input.startAt), toMysqlDateTime(input.dueAt), input.recurrenceRule ? JSON.stringify(input.recurrenceRule) : null]);
    await event(connection, id, userId, "ITEM_CREATED", { type, parentId: input.parentId || null });
    await recalculateAncestors(connection,input.parentId||null);
    await connection.commit(); return ok({ id }, 201);
  } catch (error: any) { await connection.rollback(); return err(error.message, error.status || 500); } finally { connection.release(); }
}

async function getWorkItem(id: string) {
  const item = (await rows(`SELECT w.*,c.display_name client_name FROM work_items w LEFT JOIN clients c ON c.id=w.client_id WHERE w.id=? AND w.deleted_at IS NULL`, [id]))[0];
  if (!item) return err("Work item não encontrado.", 404);
  const [assignees, tags, checklist, workflow, children] = await Promise.all([
    rows(`SELECT a.*,u.name,u.avatar FROM work_item_assignees a JOIN users u ON u.id=a.user_id WHERE a.work_item_id=? AND a.removed_at IS NULL ORDER BY a.is_primary DESC,a.assigned_at`, [id]),
    rows(`SELECT t.* FROM work_item_tags wt JOIN tags t ON t.id=wt.tag_id WHERE wt.work_item_id=?`, [id]),
    rows("SELECT * FROM work_item_checklists WHERE work_item_id=? ORDER BY sort_order,created_at", [id]),
    rows(`SELECT wiw.*,wt.name workflow_name,ws.key_name stage_key,ws.name stage_name FROM work_item_workflows wiw JOIN workflow_templates wt ON wt.id=wiw.workflow_template_id JOIN workflow_stages ws ON ws.id=wiw.current_stage_id WHERE wiw.work_item_id=?`, [id]),
    rows("SELECT id,type,title,status,priority,progress,due_at FROM work_items WHERE parent_id=? AND deleted_at IS NULL ORDER BY created_at", [id]),
  ]);
  return ok({ ...serialize(item), assignees, tags, checklist, workflow: workflow[0] || null, children });
}

async function updateWorkItem(req: NextRequest, id: string, userId: string) {
  const input = await body(req); const connection = await getDbPool().getConnection();
  try {
    await connection.beginTransaction(); const current = await itemForUpdate(connection, id); if (!current) return err("Work item não encontrado.", 404);
    const fields: string[] = []; const values: unknown[] = []; const changed: Record<string, unknown> = {};
    const scalar: Record<string, string> = { title: "title", description: "description", startAt: "start_at", dueAt: "due_at", progressStrategy: "progress_strategy" };
    for (const [key, column] of Object.entries(scalar)) if (input[key] !== undefined) { const value = ["startAt", "dueAt"].includes(key) ? toMysqlDateTime(input[key]) : input[key]; fields.push(`${column}=?`); values.push(value); changed[key] = value; }
    if (input.status !== undefined) { const value=cleanEnum(input.status,STATUSES); if(!value)return err("Status inválido.",422); fields.push("status=?");values.push(value);changed.status=value; if(value==="DONE"){fields.push("completed_at=COALESCE(completed_at,NOW())");} else fields.push("completed_at=NULL"); }
    if (input.priority !== undefined) { const value=cleanEnum(input.priority,PRIORITIES);if(!value)return err("Prioridade inválida.",422);fields.push("priority=?");values.push(value);changed.priority=value; }
    if (input.progress !== undefined) { const value=Math.min(100,Math.max(0,Number(input.progress)));fields.push("progress=?");values.push(value);changed.progress=value; }
    if (!fields.length) return err("Nenhum campo permitido.", 422);
    values.push(id); await connection.query(`UPDATE work_items SET ${fields.join(",")} WHERE id=?`, values); await event(connection,id,userId,"ITEM_UPDATED",changed);await recalculateAncestors(connection,current.parent_id); await connection.commit(); return ok({ success:true });
  } catch(error:any){await connection.rollback();return err(error.message,error.status||500);} finally{connection.release();}
}

async function moveWorkItem(req: NextRequest, id: string, userId: string) {
  const input=await body(req); const parentId=input.parentId||null; const connection=await getDbPool().getConnection();
  try{await connection.beginTransaction();const current=await itemForUpdate(connection,id);if(!current)return err("Work item não encontrado.",404);const parent=await validateParent(connection,current.type,id,parentId);const clientId=input.clientId!==undefined?input.clientId:(parent?.client_id||current.client_id);if(parent?.client_id&&clientId&&parent.client_id!==clientId)return err("O cliente deve ser o mesmo do item pai.",422);await connection.query("UPDATE work_items SET parent_id=?,client_id=? WHERE id=?",[parentId,clientId||null,id]);await event(connection,id,userId,parentId?"ITEM_MOVED":"ITEM_UNLINKED",{fromParentId:current.parent_id,toParentId:parentId,clientId});await recalculateAncestors(connection,current.parent_id);await recalculateAncestors(connection,parentId);await connection.commit();return ok({success:true});}catch(error:any){await connection.rollback();return err(error.message,error.status||500);}finally{connection.release();}
}

async function manageAssignees(req: NextRequest,id:string,userId:string,method:string){
  if(method==="GET")return ok(await rows(`SELECT a.*,u.name,u.email,u.avatar FROM work_item_assignees a JOIN users u ON u.id=a.user_id WHERE a.work_item_id=? AND a.removed_at IS NULL`,[id]));
  const input=await body(req);if(!input.userId)return err("Usuário obrigatório.",422);const connection=await getDbPool().getConnection();
  try{await connection.beginTransaction();if(method==="POST"){if(input.isPrimary)await connection.query("UPDATE work_item_assignees SET is_primary=FALSE WHERE work_item_id=? AND removed_at IS NULL",[id]);const existing=(await connection.query("SELECT id FROM work_item_assignees WHERE work_item_id=? AND user_id=? AND removed_at IS NULL",[id,input.userId]) as any)[0][0];if(!existing){const assignmentId=randomUUID();await connection.query("INSERT INTO work_item_assignees (id,work_item_id,user_id,role,is_primary,assigned_by) VALUES (?,?,?,?,?,?)",[assignmentId,id,input.userId,input.role||null,Boolean(input.isPrimary),userId]);await event(connection,id,userId,"ASSIGNEE_ADDED",{userId:input.userId,role:input.role||null});await connection.query("INSERT IGNORE INTO notifications (id,recipient_user_id,actor_user_id,type,work_item_id,deduplication_key) VALUES (?,?,?,?,?,?)",[randomUUID(),input.userId,userId,"WORK_ITEM_ASSIGNED",id,`assigned:${id}:${input.userId}`]);}}else{await connection.query("UPDATE work_item_assignees SET removed_at=NOW(),is_primary=FALSE WHERE work_item_id=? AND user_id=? AND removed_at IS NULL",[id,input.userId]);await event(connection,id,userId,"ASSIGNEE_REMOVED",{userId:input.userId});}await connection.commit();return ok({success:true});}catch(error:any){await connection.rollback();return err(error.message,500);}finally{connection.release();}
}

async function timeline(id:string){return ok((await rows("SELECT e.*,u.name actor_name,u.avatar actor_avatar FROM work_item_events e LEFT JOIN users u ON u.id=e.actor_id WHERE e.work_item_id=? ORDER BY e.created_at DESC,e.id DESC",[id])).map(serialize));}
async function comments(req:NextRequest,id:string,userId:string,method:string){if(method==="GET")return ok(await rows("SELECT c.*,u.name,u.avatar FROM comments c LEFT JOIN users u ON u.id=c.user_id WHERE c.work_item_id=? AND c.deleted_at IS NULL ORDER BY c.created_at",[id]));const input=await body(req);if(!String(input.body||"").trim())return err("Comentário vazio.",422);const connection=await getDbPool().getConnection();const commentId=randomUUID();try{await connection.beginTransaction();await connection.query("INSERT INTO comments (id,work_item_id,user_id,parent_comment_id,body) VALUES (?,?,?,?,?)",[commentId,id,userId,input.parentCommentId||null,String(input.body).trim()]);for(const mentioned of Array.isArray(input.mentionedUserIds)?input.mentionedUserIds:[]){await connection.query("INSERT IGNORE INTO comment_mentions (comment_id,user_id) VALUES (?,?)",[commentId,mentioned]);await connection.query("INSERT IGNORE INTO notifications (id,recipient_user_id,actor_user_id,type,work_item_id,deduplication_key) VALUES (?,?,?,?,?,?)",[randomUUID(),mentioned,userId,"MENTIONED",id,`mention:${commentId}:${mentioned}`]);}await event(connection,id,userId,"COMMENT_ADDED",{commentId});await connection.commit();return ok({id:commentId},201);}catch(error:any){await connection.rollback();return err(error.message,500);}finally{connection.release();}}

async function checklists(req:NextRequest,id:string,userId:string,method:string){if(method==="GET")return ok(await rows("SELECT * FROM work_item_checklists WHERE work_item_id=? ORDER BY sort_order,created_at",[id]));const input=await body(req);const connection=await getDbPool().getConnection();try{await connection.beginTransaction();if(method==="POST"){const checklistId=randomUUID();await connection.query("INSERT INTO work_item_checklists (id,work_item_id,title,description,category,priority,required,blocking,assigned_to,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)",[checklistId,id,String(input.title||"").trim(),input.description||null,input.category||null,cleanEnum(input.priority,PRIORITIES,"NORMAL"),Boolean(input.required),Boolean(input.blocking),input.assignedTo||null,Number(input.sortOrder||0)]);await event(connection,id,userId,"CHECKLIST_ITEM_ADDED",{checklistId});await connection.commit();return ok({id:checklistId},201);}const checklistId=String(input.id||"");const completed=Boolean(input.completed);await connection.query("UPDATE work_item_checklists SET completed_at=?,completed_by=? WHERE id=? AND work_item_id=?",[completed?new Date():null,completed?userId:null,checklistId,id]);await event(connection,id,userId,completed?"CHECKLIST_COMPLETED":"CHECKLIST_REOPENED",{checklistId});await connection.commit();return ok({success:true});}catch(error:any){await connection.rollback();return err(error.message,500);}finally{connection.release();}}

async function timeEntries(req:NextRequest,id:string,userId:string,method:string){if(method==="GET")return ok(await rows("SELECT t.*,u.name FROM work_item_time_entries t JOIN users u ON u.id=t.user_id WHERE t.work_item_id=? ORDER BY t.started_at DESC",[id]));const input=await body(req);const started=toMysqlDateTime(input.startedAt)||toMysqlDateTime(new Date());const ended=toMysqlDateTime(input.endedAt);if(ended&&new Date(ended)<new Date(started!))return err("O término não pode preceder o início.",422);const entryId=randomUUID();await getDbPool().query("INSERT INTO work_item_time_entries (id,work_item_id,user_id,started_at,ended_at,duration_seconds,source,notes) VALUES (?,?,?,?,?,IF(? IS NULL,NULL,TIMESTAMPDIFF(SECOND,?,?)),?,?)",[entryId,id,input.userId||userId,started,ended,ended,started,ended,input.source||"MANUAL",input.notes||null]);return ok({id:entryId},201);}

async function workflow(req:NextRequest,id:string,userId:string,method:string){if(method==="GET")return ok((await rows(`SELECT wiw.*,wt.name workflow_name,ws.key_name stage_key,ws.name stage_name FROM work_item_workflows wiw JOIN workflow_templates wt ON wt.id=wiw.workflow_template_id JOIN workflow_stages ws ON ws.id=wiw.current_stage_id WHERE wiw.work_item_id=?`,[id]))[0]||null);const input=await body(req);const connection=await getDbPool().getConnection();try{await connection.beginTransaction();if(input.workflowTemplateId){const first=(await connection.query("SELECT id FROM workflow_stages WHERE workflow_template_id=? ORDER BY sort_order LIMIT 1",[input.workflowTemplateId]) as any)[0][0];if(!first)return err("Workflow sem etapas.",422);await connection.query("INSERT INTO work_item_workflows (work_item_id,workflow_template_id,current_stage_id) VALUES (?,?,?) ON DUPLICATE KEY UPDATE workflow_template_id=VALUES(workflow_template_id),current_stage_id=VALUES(current_stage_id),entered_at=NOW()",[id,input.workflowTemplateId,first.id]);await event(connection,id,userId,"WORKFLOW_CHANGED",{workflowTemplateId:input.workflowTemplateId,stageId:first.id});}else{const current=(await connection.query("SELECT * FROM work_item_workflows WHERE work_item_id=? FOR UPDATE",[id]) as any)[0][0];let toStageId=input.toStageId;if(!toStageId&&input.toStageKey)toStageId=(await connection.query("SELECT id FROM workflow_stages WHERE workflow_template_id=? AND key_name=?",[current?.workflow_template_id,String(input.toStageKey).toUpperCase()]) as any)[0][0]?.id;const transition=(await connection.query("SELECT t.to_stage_id,s.maps_to_status,s.key_name FROM workflow_transitions t JOIN workflow_stages s ON s.id=t.to_stage_id WHERE t.from_stage_id=? AND t.to_stage_id=?",[current?.current_stage_id,toStageId]) as any)[0][0];if(!transition)return err("Transição de workflow inválida.",422);await connection.query("UPDATE work_item_workflows SET current_stage_id=?,entered_at=NOW() WHERE work_item_id=?",[transition.to_stage_id,id]);await connection.query("UPDATE work_items SET status=? WHERE id=?",[transition.maps_to_status,id]);await event(connection,id,userId,"WORKFLOW_STAGE_CHANGED",{fromStageId:current.current_stage_id,toStageId:transition.to_stage_id,toStageKey:transition.key_name});}await connection.commit();return ok({success:true});}catch(error:any){await connection.rollback();return err(error.message,error.status||500);}finally{connection.release();}}

export async function handleWorkItems(req:NextRequest,segments:string[],method:string):Promise<NextResponse>{
  const ctx=await getContext(req);if(!ctx.isAuthenticated||!ctx.userUid)return err("Não autenticado.",401);if(method!=="GET"&&!requireManage(ctx))return err("Permissão insuficiente.",403);
  if(!segments.length)return method==="GET"?listWorkItems(req):method==="POST"?createWorkItem(req,ctx.userUid):err("Método não permitido.",405);
  const [id,resource]=segments;
  if(!resource){if(method==="GET")return getWorkItem(id);if(method==="PATCH")return updateWorkItem(req,id,ctx.userUid);if(method==="DELETE"){await getDbPool().query("UPDATE work_items SET deleted_at=NOW() WHERE id=?",[id]);return ok({success:true});}}
  if(resource==="move"&&method==="POST")return moveWorkItem(req,id,ctx.userUid);
  if(resource==="assignees"&&["GET","POST","DELETE"].includes(method))return manageAssignees(req,id,ctx.userUid,method);
  if(resource==="events"&&method==="GET")return timeline(id);
  if(resource==="comments"&&["GET","POST"].includes(method))return comments(req,id,ctx.userUid,method);
  if(resource==="checklists"&&["GET","POST","PATCH"].includes(method))return checklists(req,id,ctx.userUid,method);
  if(resource==="time-entries"&&["GET","POST"].includes(method))return timeEntries(req,id,ctx.userUid,method);
  if(resource==="workflow"&&["GET","POST"].includes(method))return workflow(req,id,ctx.userUid,method);
  const capability=await handleCapability(req,id,segments.slice(1),method,ctx.userUid);if(capability)return capability;
  return err("Endpoint não encontrado.",404);
}
