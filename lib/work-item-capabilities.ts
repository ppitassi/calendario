import { randomBytes, randomUUID, createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { body, toMysqlDateTime } from "./api-core/context";
import { err, ok } from "./api-response";
import { getDbPool, parseJson, rows } from "./db";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  localUploadsRoot,
  MIME_EXTENSIONS,
  matchesFileSignature,
} from "./storage/core";

async function addEvent(
  connection: any,
  itemId: string,
  userId: string,
  type: string,
  data: unknown,
) {
  await connection.query(
    "INSERT INTO work_item_events (work_item_id,actor_id,event_type,data_json) VALUES (?,?,?,?)",
    [itemId, userId, type, JSON.stringify(data)],
  );
}
async function item(id: string) {
  return (
    await rows("SELECT * FROM work_items WHERE id=? AND deleted_at IS NULL", [
      id,
    ])
  )[0];
}

async function content(
  req: NextRequest,
  id: string,
  userId: string,
  method: string,
) {
  if (method === "GET") {
    const value = (
      await rows(
        `SELECT ci.*,sc.key_name channel,cf.key_name format FROM content_items ci LEFT JOIN social_channels sc ON sc.id=ci.channel_id LEFT JOIN content_formats cf ON cf.id=ci.format_id WHERE ci.work_item_id=?`,
        [id],
      )
    )[0];
    return ok(
      value
        ? { ...value, editorial_json: parseJson(value.editorial_json, {}) }
        : null,
    );
  }
  const input = await body(req);
  const work = await item(id);
  if (!work || work.type !== "TASK")
    return err("Conteúdo só pode ser associado a TASK.", 422);
  const db = await getDbPool().getConnection();
  try {
    await db.beginTransaction();
    const existing = (
      (await db.query(
        "SELECT * FROM content_items WHERE work_item_id=? FOR UPDATE",
        [id],
      )) as any
    )[0][0];
    const channel = input.channel
      ? (
          (await db.query("SELECT id FROM social_channels WHERE key_name=?", [
            String(input.channel).toUpperCase(),
          ])) as any
        )[0][0]
      : null;
    const format = input.format
      ? (
          (await db.query("SELECT id FROM content_formats WHERE key_name=?", [
            String(input.format).toUpperCase(),
          ])) as any
        )[0][0]
      : null;
    const contentId = existing?.id || randomUUID();
    if (existing)
      await db.query(
        "UPDATE content_items SET head=?,subhead=?,caption=?,objective=?,hashtags=?,internal_notes=?,funnel_stage=?,channel_id=?,format_id=?,editorial_json=? WHERE id=?",
        [
          input.head || null,
          input.subhead || null,
          input.caption || null,
          input.objective || null,
          input.hashtags || null,
          input.internalNotes || null,
          input.funnelStage || null,
          channel?.id || null,
          format?.id || null,
          JSON.stringify(input.editorial || {}),
          contentId,
        ],
      );
    else
      await db.query(
        "INSERT INTO content_items (id,work_item_id,head,subhead,caption,objective,hashtags,internal_notes,funnel_stage,channel_id,format_id,editorial_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        [
          contentId,
          id,
          input.head || null,
          input.subhead || null,
          input.caption || null,
          input.objective || null,
          input.hashtags || null,
          input.internalNotes || null,
          input.funnelStage || null,
          channel?.id || null,
          format?.id || null,
          JSON.stringify(input.editorial || {}),
        ],
      );
    const [[version]] = (await db.query(
      "SELECT COALESCE(MAX(version_number),0)+1 number FROM content_versions WHERE content_item_id=?",
      [contentId],
    )) as any;
    const versionId = randomUUID();
    const versionNumber = Number(version.number);
    await db.query(
      "INSERT INTO content_versions (id,content_item_id,version_number,snapshot_json,created_by) VALUES (?,?,?,?,?)",
      [versionId, contentId, versionNumber, JSON.stringify(input), userId],
    );
    await addEvent(
      db,
      id,
      userId,
      existing ? "CONTENT_UPDATED" : "CONTENT_CREATED",
      { contentId, versionId, version: versionNumber },
    );
    await db.commit();
    return ok({ id: contentId, versionId, version: versionNumber });
  } catch (error: any) {
    await db.rollback();
    return err(error.message, 500);
  } finally {
    db.release();
  }
}

async function publications(
  req: NextRequest,
  id: string,
  userId: string,
  method: string,
) {
  const contentItem = (
    await rows("SELECT id FROM content_items WHERE work_item_id=?", [id])
  )[0];
  if (!contentItem) return err("Conteúdo não encontrado.", 404);
  if (method === "GET")
    return ok(
      await rows(
        `SELECT p.*,sc.key_name channel FROM publications p JOIN social_channels sc ON sc.id=p.channel_id WHERE p.content_item_id=? ORDER BY p.scheduled_at`,
        [contentItem.id],
      ),
    );
  const input = await body(req);
  const channel = (
    await rows("SELECT id FROM social_channels WHERE key_name=?", [
      String(input.channel || "").toUpperCase(),
    ])
  )[0];
  if (!channel) return err("Canal inválido.", 422);
  const publicationId = String(input.id || randomUUID());
  await getDbPool().query(
    `INSERT INTO publications (id,content_item_id,channel_id,scheduled_at,published_at,status,external_post_id,url,verification_status,verified_by,verified_at,verification_notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE scheduled_at=VALUES(scheduled_at),published_at=VALUES(published_at),status=VALUES(status),external_post_id=VALUES(external_post_id),url=VALUES(url),verification_status=VALUES(verification_status),verified_by=VALUES(verified_by),verified_at=VALUES(verified_at),verification_notes=VALUES(verification_notes)`,
    [
      publicationId,
      contentItem.id,
      channel.id,
      toMysqlDateTime(input.scheduledAt),
      toMysqlDateTime(input.publishedAt),
      input.status || "DRAFT",
      input.externalPostId || null,
      input.url || null,
      input.verificationStatus || "PENDING",
      input.verificationStatus && input.verificationStatus !== "PENDING"
        ? userId
        : null,
      input.verificationStatus && input.verificationStatus !== "PENDING"
        ? new Date()
        : null,
      input.verificationNotes || null,
    ],
  );
  return ok({ id: publicationId });
}

async function photoJob(req: NextRequest, id: string, method: string) {
  if (method === "GET")
    return ok(
      (await rows("SELECT * FROM photo_jobs WHERE work_item_id=?", [id]))[0] ||
        null,
    );
  const work = await item(id);
  if (!work || !["DEMAND", "TASK"].includes(work.type))
    return err("Photo job exige DEMAND ou TASK.", 422);
  const input = await body(req);
  const keys = [
    "capturedCount",
    "selectedCount",
    "targetEditCount",
    "editedCount",
    "exportedCount",
    "deliveredCount",
  ];
  const values = keys.map((key) =>
    Math.max(0, Math.floor(Number(input[key] || 0))),
  );
  if (values.slice(1).some((value, index) => value > values[index]))
    return err("As contagens não podem exceder a etapa anterior.", 422);
  const photoId = String(input.id || randomUUID());
  await getDbPool().query(
    `INSERT INTO photo_jobs (id,work_item_id,captured_count,selected_count,target_edit_count,edited_count,exported_count,delivered_count) VALUES (?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE captured_count=VALUES(captured_count),selected_count=VALUES(selected_count),target_edit_count=VALUES(target_edit_count),edited_count=VALUES(edited_count),exported_count=VALUES(exported_count),delivered_count=VALUES(delivered_count)`,
    [photoId, id, ...values],
  );
  const target = values[2] || values[1];
  const progress = target
    ? Math.min(100, Math.round((values[3] / target) * 100))
    : 0;
  await getDbPool().query("UPDATE work_items SET progress=? WHERE id=?", [
    progress,
    id,
  ]);
  return ok({ id: photoId, progress });
}

const allowedExternal: Record<string, string[]> = {
  PLANNING: ["READY", "CANCELLED"],
  READY: ["DEPARTED", "CANCELLED"],
  DEPARTED: ["IN_TRANSIT"],
  IN_TRANSIT: ["ARRIVED"],
  ARRIVED: ["IN_PROGRESS"],
  IN_PROGRESS: ["FINISHING"],
  FINISHING: ["RETURNING", "COMPLETED"],
  RETURNING: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};
async function externalOperation(
  req: NextRequest,
  id: string,
  userId: string,
  method: string,
  action?: string,
) {
  const work = await item(id);
  if (!work || !["DEMAND", "TASK"].includes(work.type))
    return err("Operação externa exige DEMAND ou TASK.", 422);
  const current = (
    await rows("SELECT * FROM external_operations WHERE work_item_id=?", [id])
  )[0];
  if (!action && method === "GET") return ok(current || null);
  const input = await body(req);
  if (!action) {
    const operationId = current?.id || randomUUID();
    await getDbPool().query(
      `INSERT INTO external_operations (id,work_item_id,operation_type,title,objective,briefing,location_name,address,latitude,longitude,geofence_radius_meters,scheduled_start,scheduled_end,status,tracking_enabled,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE operation_type=VALUES(operation_type),title=VALUES(title),objective=VALUES(objective),briefing=VALUES(briefing),location_name=VALUES(location_name),address=VALUES(address),latitude=VALUES(latitude),longitude=VALUES(longitude),geofence_radius_meters=VALUES(geofence_radius_meters),scheduled_start=VALUES(scheduled_start),scheduled_end=VALUES(scheduled_end),tracking_enabled=VALUES(tracking_enabled)`,
      [
        operationId,
        id,
        String(input.operationType || "OTHER").toUpperCase(),
        input.title || work.title,
        input.objective || null,
        input.briefing || null,
        input.locationName || null,
        input.address || null,
        input.latitude || null,
        input.longitude || null,
        input.geofenceRadiusMeters || null,
        toMysqlDateTime(input.scheduledStart),
        toMysqlDateTime(input.scheduledEnd),
        current?.status || "PLANNING",
        Boolean(input.trackingEnabled),
        userId,
      ],
    );
    return ok({ id: operationId });
  }
  if (!current) return err("Operação externa não encontrada.", 404);
  if (action === "transition") {
    const next = String(input.status || "").toUpperCase();
    if (!allowedExternal[current.status]?.includes(next))
      return err("Transição operacional inválida.", 422);
    if (next === "COMPLETED") {
      const blockers = await rows(
        "SELECT id FROM external_operation_plan_items WHERE external_operation_id=? AND blocking=TRUE AND completed_at IS NULL",
        [current.id],
      );
      if (blockers.length) return err("Há itens bloqueantes pendentes.", 409);
    }
    const fields = ["status=?"],
      values: any[] = [next];
    if (next === "IN_PROGRESS" && !current.actual_start)
      fields.push("actual_start=NOW()");
    if (next === "COMPLETED")
      (fields.push(
        "actual_end=NOW()",
        "tracking_ended_at=IF(tracking_enabled,NOW(),tracking_ended_at)",
        "final_notes=?",
      ),
        values.push(input.finalNotes || null));
    if (next === "DEPARTED" && current.tracking_enabled)
      fields.push("tracking_started_at=NOW()");
    values.push(current.id);
    const eventTypes: Record<string, string> = {
      DEPARTED: "LEFT_COMPANY",
      ARRIVED: "ARRIVED_CLIENT",
      IN_PROGRESS: "ACTIVITY_STARTED",
      FINISHING: "ACTIVITY_FINISHED",
      RETURNING: "LEFT_CLIENT",
      COMPLETED: "OPERATION_FINISHED",
    };
    const db = await getDbPool().getConnection();
    try {
      await db.beginTransaction();
      await db.query(
        `UPDATE external_operations SET ${fields.join(",")} WHERE id=?`,
        values,
      );
      await db.query(
        "INSERT INTO external_operation_events (external_operation_id,actor_id,event_type,latitude,longitude,metadata_json,data_json) VALUES (?,?,?,?,?,?,?)",
        [
          current.id,
          userId,
          eventTypes[next] || next,
          input.latitude || null,
          input.longitude || null,
          JSON.stringify(input.data || {}),
          JSON.stringify({ status: next }),
        ],
      );
      await addEvent(
        db,
        id,
        userId,
        next === "COMPLETED"
          ? "EXTERNAL_OPERATION_FINISHED"
          : "EXTERNAL_OPERATION_STATUS_CHANGED",
        { status: next },
      );
      await db.commit();
      return ok({ success: true, status: next });
    } catch (error: any) {
      await db.rollback();
      return err(error.message, 500);
    } finally {
      db.release();
    }
  }
  if (action === "locations" && method === "POST") {
    if (!current.tracking_enabled || current.tracking_ended_at)
      return err("Tracking não está ativo.", 409);
    await getDbPool().query(
      "INSERT INTO external_operation_locations (external_operation_id,user_id,latitude,longitude,accuracy_meters,captured_at) VALUES (?,?,?,?,?,?)",
      [
        current.id,
        userId,
        input.latitude,
        input.longitude,
        input.accuracyMeters || null,
        toMysqlDateTime(input.capturedAt) || new Date(),
      ],
    );
    return ok({ success: true }, 201);
  }
  if (action === "plan-items") {
    if (method === "GET")
      return ok(
        await rows(
          "SELECT * FROM external_operation_plan_items WHERE external_operation_id=? ORDER BY category,sort_order",
          [current.id],
        ),
      );
    if (method === "POST") {
      const planId = randomUUID();
      await getDbPool().query(
        "INSERT INTO external_operation_plan_items (id,external_operation_id,title,description,priority,required,blocking,assigned_to,category,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)",
        [
          planId,
          current.id,
          input.title,
          input.description || null,
          input.priority || "NORMAL",
          Boolean(input.required),
          Boolean(input.blocking),
          input.assignedTo || null,
          input.category || "GENERAL",
          Number(input.sortOrder || 0),
        ],
      );
      return ok({ id: planId }, 201);
    }
    await getDbPool().query(
      "UPDATE external_operation_plan_items SET completed_at=?,completed_by=? WHERE id=? AND external_operation_id=?",
      [
        input.completed ? new Date() : null,
        input.completed ? userId : null,
        input.id,
        current.id,
      ],
    );
    return ok({ success: true });
  }
  if (action === "members") {
    if (method === "GET")
      return ok(
        await rows(
          `SELECT m.id,m.user_id userId,u.name,u.avatar,m.role,m.is_primary isPrimary,m.assigned_at assignedAt FROM external_operation_members m JOIN users u ON u.id=m.user_id WHERE m.external_operation_id=? AND m.removed_at IS NULL ORDER BY m.is_primary DESC,u.name`,
          [current.id],
        ),
      );
    if (method === "DELETE") {
      await getDbPool().query(
        "UPDATE external_operation_members SET removed_at=NOW(),is_primary=FALSE WHERE external_operation_id=? AND id=?",
        [current.id, input.id],
      );
      return ok({ success: true });
    }
    if (input.isPrimary)
      await getDbPool().query(
        "UPDATE external_operation_members SET is_primary=FALSE WHERE external_operation_id=? AND removed_at IS NULL",
        [current.id],
      );
    const memberId = randomUUID();
    await getDbPool().query(
      "INSERT INTO external_operation_members (id,external_operation_id,user_id,role,is_primary) VALUES (?,?,?,?,?)",
      [
        memberId,
        current.id,
        input.userId,
        input.role || null,
        Boolean(input.isPrimary),
      ],
    );
    return ok({ id: memberId }, 201);
  }
  if (action === "events" && method === "GET")
    return ok(
      await rows(
        "SELECT * FROM external_operation_events WHERE external_operation_id=? ORDER BY occurred_at",
        [current.id],
      ),
    );
  if (action === "summary" && method === "GET") {
    const [counts, times, lastLocation] = await Promise.all([
      rows(
        `SELECT COUNT(*) total,SUM(completed_at IS NOT NULL) completed,SUM(required=TRUE) requiredTotal,SUM(required=TRUE AND completed_at IS NOT NULL) requiredCompleted,SUM(blocking=TRUE AND completed_at IS NULL) blockingPending FROM external_operation_plan_items WHERE external_operation_id=?`,
        [current.id],
      ),
      rows(
        `SELECT TIMESTAMPDIFF(SECOND,tracking_started_at,COALESCE(tracking_ended_at,NOW())) totalTrackingSeconds,TIMESTAMPDIFF(SECOND,actual_start,COALESCE(actual_end,NOW())) executionSeconds,TIMESTAMPDIFF(SECOND,scheduled_start,actual_start) startDelaySeconds FROM external_operations WHERE id=?`,
        [current.id],
      ),
      rows(
        `SELECT latitude,longitude,accuracy_meters accuracyMeters,captured_at capturedAt FROM external_operation_locations WHERE external_operation_id=? ORDER BY captured_at DESC LIMIT 1`,
        [current.id],
      ),
    ]);
    const incidents =
      (
        await rows(
          "SELECT COUNT(*) total FROM external_operation_incidents WHERE external_operation_id=?",
          [current.id],
        )
      )[0]?.total || 0;
    const extras =
      (
        await rows(
          "SELECT COUNT(*) total FROM work_items WHERE origin_external_operation_id=? AND deleted_at IS NULL",
          [current.id],
        )
      )[0]?.total || 0;
    const files =
      (
        await rows(
          "SELECT COUNT(*) total FROM file_links WHERE entity_type='EXTERNAL_OPERATION' AND entity_id=?",
          [current.id],
        )
      )[0]?.total || 0;
    return ok({
      operation: current,
      checklist: counts[0] || {},
      timing: times[0] || {},
      lastLocation: lastLocation[0] || null,
      incidents: Number(incidents),
      extraDemands: Number(extras),
      files: Number(files),
      trackingActive: Boolean(
        current.tracking_enabled &&
        !current.tracking_ended_at &&
        !["COMPLETED", "CANCELLED"].includes(current.status),
      ),
    });
  }
  if (action === "extra-work-item" && method === "POST") {
    const type = String(input.type || "TASK").toUpperCase();
    if (!["DEMAND", "TASK"].includes(type))
      return err("Tipo adicional inválido.", 422);
    const extraId = randomUUID(),
      parentId =
        type === "TASK" ? input.parentId || id : input.parentId || null;
    await getDbPool().query(
      "INSERT INTO work_items (id,type,title,description,client_id,parent_id,origin_work_item_id,origin_external_operation_id,created_by,due_at,priority) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      [
        extraId,
        type,
        input.title,
        input.description || null,
        work.client_id,
        parentId,
        id,
        current.id,
        userId,
        toMysqlDateTime(input.dueAt),
        input.priority || "NORMAL",
      ],
    );
    await getDbPool().query(
      "INSERT INTO work_item_events (work_item_id,actor_id,event_type,data_json) VALUES (?,?,?,?)",
      [
        extraId,
        userId,
        "ITEM_CREATED_FROM_EXTERNAL_OPERATION",
        JSON.stringify({
          originWorkItemId: id,
          originExternalOperationId: current.id,
        }),
      ],
    );
    return ok({ id: extraId, type }, 201);
  }
  if (action === "incidents") {
    if (method === "GET")
      return ok(
        await rows(
          "SELECT * FROM external_operation_incidents WHERE external_operation_id=? ORDER BY created_at DESC",
          [current.id],
        ),
      );
    const incidentId = randomUUID();
    await getDbPool().query(
      "INSERT INTO external_operation_incidents (id,external_operation_id,reported_by,incident_type,severity,title,description) VALUES (?,?,?,?,?,?,?)",
      [
        incidentId,
        current.id,
        userId,
        input.type || "OTHER",
        input.severity || "NORMAL",
        input.title,
        input.description || null,
      ],
    );
    return ok({ id: incidentId }, 201);
  }
  return err("Ação de operação externa inválida.", 404);
}

async function approvals(
  req: NextRequest,
  id: string,
  userId: string,
  method: string,
  action?: string,
) {
  if (method === "GET" && !action) {
    const flows = await rows(
      `SELECT af.*,cv.version_number FROM approval_flows af LEFT JOIN content_versions cv ON cv.id=af.content_version_id WHERE af.work_item_id=? ORDER BY af.created_at DESC`,
      [id],
    );
    for (const flow of flows) {
      flow.steps = await rows(
        `SELECT s.*,u.name approver_name FROM approval_steps s LEFT JOIN users u ON u.id=s.approver_user_id WHERE s.approval_flow_id=? ORDER BY s.sort_order`,
        [flow.id],
      );
      for (const step of flow.steps)
        step.decisions = await rows(
          `SELECT d.id,d.decision,d.comment,d.decided_at decidedAt,du.name decidedBy FROM approval_decisions d LEFT JOIN users du ON du.id=d.decided_by WHERE d.approval_step_id=? ORDER BY d.decided_at`,
          [step.id],
        );
    }
    return ok(flows);
  }
  const input = await body(req);
  if (!action) {
    const steps = Array.isArray(input.steps) ? input.steps : [];
    if (!steps.length)
      return err("Inclua pelo menos uma etapa de aprovação.", 422);
    const flowId = randomUUID(),
      stepIds: string[] = [],
      db = await getDbPool().getConnection();
    try {
      await db.beginTransaction();
      await db.query(
        "INSERT INTO approval_flows (id,work_item_id,content_version_id,created_by) VALUES (?,?,?,?)",
        [flowId, id, input.contentVersionId || null, userId],
      );
      for (let index = 0; index < steps.length; index += 1) {
        const step = steps[index],
          stepId = randomUUID();
        if (!String(step.name || "").trim())
          throw new Error("Nome da etapa obrigatório.");
        stepIds.push(stepId);
        await db.query(
          "INSERT INTO approval_steps (id,approval_flow_id,name,approver_user_id,approver_role_id,sort_order) VALUES (?,?,?,?,?,?)",
          [
            stepId,
            flowId,
            String(step.name).trim(),
            step.approverUserId || null,
            step.approverRoleId || null,
            index,
          ],
        );
      }
      await addEvent(db, id, userId, "APPROVAL_FLOW_CREATED", {
        flowId,
        stepIds,
      });
      await db.commit();
      return ok({ id: flowId, stepIds }, 201);
    } catch (error: any) {
      await db.rollback();
      return err(error.message, 422);
    } finally {
      db.release();
    }
  }
  if (action === "decision") {
    const db = await getDbPool().getConnection();
    try {
      await db.beginTransaction();
      const [stepRows] = (await db.query(
        `SELECT s.*,f.work_item_id,f.content_version_id FROM approval_steps s JOIN approval_flows f ON f.id=s.approval_flow_id WHERE s.id=? FOR UPDATE`,
        [input.stepId],
      )) as any;
      const step = stepRows[0];
      if (!step || step.work_item_id !== id) {
        await db.rollback();
        return err("Etapa não encontrada.", 404);
      }
      if (step.status !== "PENDING") {
        await db.rollback();
        return err("Esta etapa já foi decidida.", 409);
      }
      const decision = String(input.decision || "").toUpperCase();
      if (!["APPROVED", "CHANGES_REQUESTED", "REJECTED"].includes(decision)) {
        await db.rollback();
        return err("Decisão inválida.", 422);
      }
      await db.query(
        "INSERT INTO approval_decisions (id,approval_step_id,decided_by,decision,comment,content_version_id) VALUES (?,?,?,?,?,?)",
        [
          randomUUID(),
          step.id,
          userId,
          decision,
          input.comment || null,
          step.content_version_id,
        ],
      );
      await db.query("UPDATE approval_steps SET status=? WHERE id=?", [
        decision,
        step.id,
      ]);
      let flowStatus = decision;
      if (decision === "APPROVED") {
        const [[pending]] = (await db.query(
          "SELECT COUNT(*) total FROM approval_steps WHERE approval_flow_id=? AND status='PENDING'",
          [step.approval_flow_id],
        )) as any;
        flowStatus = Number(pending.total) === 0 ? "APPROVED" : "PENDING";
      }
      await db.query(
        "UPDATE approval_flows SET status=?,completed_at=IF(?='PENDING',NULL,NOW()) WHERE id=?",
        [flowStatus, flowStatus, step.approval_flow_id],
      );
      await addEvent(db, id, userId, "APPROVAL_DECISION", {
        stepId: step.id,
        decision,
        flowStatus,
        comment: input.comment || null,
      });
      await db.commit();
      return ok({ success: true, flowStatus });
    } catch (error: any) {
      await db.rollback();
      return err(error.message, 500);
    } finally {
      db.release();
    }
  }
  if (action === "public-token") {
    const raw = randomBytes(32).toString("base64url"),
      tokenId = randomUUID(),
      versionIds = [
        ...new Set<string>((input.assetVersionIds || []).map(String)),
      ];
    const db = await getDbPool().getConnection();
    try {
      await db.beginTransaction();
      if (versionIds.length) {
        const placeholders = versionIds.map(() => "?").join(",");
        const linked = (await db.query(
          `SELECT av.id FROM asset_versions av JOIN work_item_assets wa ON wa.media_asset_id=av.media_asset_id WHERE wa.work_item_id=? AND av.id IN (${placeholders})`,
          [id, ...versionIds],
        )) as any;
        if (linked[0].length !== versionIds.length)
          throw new Error("Um ou mais arquivos não pertencem a este item.");
      }
      await db.query(
        "INSERT INTO public_approval_tokens (id,token_hash,client_id,work_item_id,content_version_id,approval_flow_id,expires_at,created_by) VALUES (?,?,?,?,?,?,?,?)",
        [
          tokenId,
          createHash("sha256").update(raw).digest("hex"),
          input.clientId,
          id,
          input.contentVersionId || null,
          input.approvalFlowId || null,
          toMysqlDateTime(input.expiresAt),
          userId,
        ],
      );
      for (const versionId of versionIds)
        await db.query(
          "INSERT INTO public_token_assets (public_token_id,asset_version_id) VALUES (?,?)",
          [tokenId, versionId],
        );
      await db.commit();
      return ok({ id: tokenId, token: raw, assetVersionIds: versionIds }, 201);
    } catch (error: any) {
      await db.rollback();
      return err(error.message, 422);
    } finally {
      db.release();
    }
  }
  return err("Ação de aprovação inválida.", 404);
}

async function assets(
  req: NextRequest,
  id: string,
  userId: string,
  method: string,
  assetId?: string,
) {
  if (method === "GET")
    return ok(
      await rows(
        `SELECT a.id,av.id assetVersionId,av.version_number versionNumber,a.original_name originalName,a.mime_type mimeType,a.byte_size byteSize,a.created_at createdAt,wa.category,wa.sort_order sortOrder,CONCAT('/api/media/assets/',a.id,'/content') url FROM work_item_assets wa JOIN media_assets a ON a.id=wa.media_asset_id LEFT JOIN asset_versions av ON av.media_asset_id=a.id WHERE wa.work_item_id=? AND a.deleted_at IS NULL ORDER BY wa.sort_order,a.created_at`,
        [id],
      ),
    );
  if (method === "DELETE" && assetId) {
    const asset = (
      await rows(
        "SELECT a.storage_provider,a.storage_key FROM media_assets a JOIN work_item_assets wa ON wa.media_asset_id=a.id WHERE a.id=? AND wa.work_item_id=?",
        [assetId, id],
      )
    )[0];
    if (!asset) return err("Arquivo não encontrado.", 404);
    await getDbPool().query(
      "DELETE FROM work_item_assets WHERE work_item_id=? AND media_asset_id=?",
      [id, assetId],
    );
    await getDbPool().query(
      "DELETE FROM file_links WHERE media_asset_id=? AND entity_type='WORK_ITEM' AND entity_id=?",
      [assetId, id],
    );
    const remaining = (
      await rows("SELECT 1 FROM file_links WHERE media_asset_id=? LIMIT 1", [
        assetId,
      ])
    )[0];
    if (!remaining) {
      await getDbPool().query(
        "UPDATE media_assets SET deleted_at=NOW() WHERE id=?",
        [assetId],
      );
      if (asset.storage_provider === "local")
        await unlink(path.resolve(localUploadsRoot(), asset.storage_key)).catch(
          () => undefined,
        );
    }
    return ok({ success: true });
  }
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return err("Arquivo obrigatório.", 422);
  const maxBytes =
    Math.max(1, Number(process.env.UPLOAD_MAX_MB || 100)) * 1024 * 1024;
  if (file.size > maxBytes)
    return err("Arquivo excede o limite permitido.", 413);
  const extension = MIME_EXTENSIONS[file.type];
  if (!extension) return err("Formato de arquivo não permitido.", 415);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesFileSignature(bytes.slice(0, 16), file.type))
    return err("Assinatura do arquivo inválida.", 422);
  const mediaId = randomUUID(),
    assetVersionId = randomUUID(),
    relative = path.join("work-items", id, `${mediaId}.${extension}`),
    target = path.resolve(localUploadsRoot(), relative),
    root = path.resolve(localUploadsRoot());
  if (!target.startsWith(root + path.sep)) return err("Caminho inválido.", 422);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
  const checksum = createHash("sha256").update(bytes).digest("hex"),
    category = String(form.get("category") || "GENERAL");
  const db = await getDbPool().getConnection();
  try {
    await db.beginTransaction();
    await db.query(
      "INSERT INTO media_assets (id,storage_provider,storage_key,original_name,mime_type,byte_size,checksum_sha256,created_by) VALUES (?,'local',?,?,?,?,?,?)",
      [
        mediaId,
        relative,
        file.name.slice(0, 500),
        file.type,
        file.size,
        checksum,
        userId,
      ],
    );
    await db.query(
      "INSERT INTO asset_versions (id,logical_asset_id,media_asset_id,version_number,created_by) VALUES (?,?,?,?,?)",
      [assetVersionId, mediaId, mediaId, 1, userId],
    );
    await db.query(
      "INSERT INTO work_item_assets (id,work_item_id,media_asset_id,category,sort_order) VALUES (?,?,?,?,?)",
      [randomUUID(), id, mediaId, category, Number(form.get("sortOrder") || 0)],
    );
    await db.query(
      "INSERT INTO file_links (id,media_asset_id,entity_type,entity_id,category) VALUES (?,?,?,?,?)",
      [randomUUID(), mediaId, "WORK_ITEM", id, category],
    );
    await addEvent(db, id, userId, "FILE_ADDED", {
      mediaAssetId: mediaId,
      assetVersionId,
      name: file.name,
    });
    await db.commit();
    return ok(
      {
        id: mediaId,
        assetVersionId,
        versionNumber: 1,
        url: `/api/media/assets/${mediaId}/content`,
      },
      201,
    );
  } catch (error: any) {
    await db.rollback();
    await unlink(target).catch(() => undefined);
    return err(error.message, 500);
  } finally {
    db.release();
  }
}

export async function handleCapability(
  req: NextRequest,
  id: string,
  segments: string[],
  method: string,
  userId: string,
): Promise<NextResponse | null> {
  const [resource, action] = segments;
  if (resource === "content" && ["GET", "PUT", "POST"].includes(method))
    return content(req, id, userId, method);
  if (resource === "content-versions" && method === "GET")
    return ok(
      await rows(
        `SELECT cv.id,cv.version_number versionNumber,cv.snapshot_json snapshot,cv.created_at createdAt,u.name createdByName FROM content_versions cv JOIN content_items ci ON ci.id=cv.content_item_id LEFT JOIN users u ON u.id=cv.created_by WHERE ci.work_item_id=? ORDER BY cv.version_number DESC`,
        [id],
      ),
    );
  if (resource === "publications" && ["GET", "POST", "PATCH"].includes(method))
    return publications(req, id, userId, method);
  if (resource === "photo-job" && ["GET", "PUT", "POST"].includes(method))
    return photoJob(req, id, method);
  if (
    resource === "external-operation" &&
    ["GET", "PUT", "POST", "PATCH", "DELETE"].includes(method)
  )
    return externalOperation(req, id, userId, method, action);
  if (resource === "approvals" && ["GET", "POST"].includes(method))
    return approvals(req, id, userId, method, action);
  if (resource === "assets" && ["GET", "POST", "DELETE"].includes(method))
    return assets(req, id, userId, method, action);
  return null;
}
