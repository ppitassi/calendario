/** Carrega, atualiza ou remove um calendário e suas publicações. */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import crypto from "node:crypto";

/**
 * Carrega calendário, relações e itens; quando o calendário não define uma
 * cadência própria, herda os dias de postagem do cliente.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { id } = await params;
    const db = getDb();

    const calendar = db.prepare(`
      SELECT
        cal.*,
        c.name as client_name,
        c.logo_url as client_logo_url,
        c.has_multiple_profiles as client_has_multiple_profiles,
        c.posting_days as client_posting_days,
        creator.name as creator_name,
        creator.role as creator_role,
        assigned.name as assigned_name,
        assigned.role as assigned_role
      FROM calendars cal
      LEFT JOIN clients c ON c.id = cal.client_id
      LEFT JOIN users creator ON creator.id = cal.created_by_id
      LEFT JOIN users assigned ON assigned.id = cal.assigned_to_id
      WHERE cal.id = ?
    `).get(id) as any;

    if (!calendar) {
      return NextResponse.json({ error: "Calendário não encontrado." }, { status: 404 });
    }

    // Primeiro tenta a configuração do mês; depois recorre ao padrão do cliente.
    let parsedPostingDays: number[] = [];
    try {
      parsedPostingDays = JSON.parse(calendar.posting_days || "[]");
    } catch {
      parsedPostingDays = [];
    }
    if (parsedPostingDays.length === 0 && calendar.client_posting_days) {
      try {
        parsedPostingDays = JSON.parse(calendar.client_posting_days || "[]");
      } catch {}
    }
    calendar.posting_days = parsedPostingDays;

    const items = db.prepare(`
      SELECT
        id,
        date,
        title,
        type,
        status,
        channel,
        objective,
        head,
        subhead,
        caption,
        visual,
        image_url as imageUrl,
        cta,
        hashtags,
        funnel_stage as funnelStage,
        internal_notes as internalNotes,
        profile,
        is_collab as isCollab,
        collab_profile as collabProfile
      FROM calendar_items
      WHERE calendar_id = ?
      ORDER BY date ASC, created_at ASC
    `).all(id);

    return NextResponse.json({ calendar, items });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Atualiza parcialmente os metadados e, quando `items` é enviado, substitui a
 * coleção completa de publicações dentro de uma transação.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const {
      title,
      month,
      brand,
      project,
      accent,
      strategy,
      audience,
      objective,
      status,
      assignedToId,
      postingDays,
      items,
    } = body;

    const db = getDb();
    const existing = db.prepare("SELECT * FROM calendars WHERE id = ?").get(id) as any;
    if (!existing) {
      return NextResponse.json({ error: "Calendário não encontrado." }, { status: 404 });
    }

    const now = new Date().toISOString();

    // Campo ausente preserva o valor persistido; vazio explícito continua sendo vazio.
    const finalTitle = title !== undefined ? title : existing.title;
    const finalMonth = month !== undefined ? month : existing.month;
    const finalBrand = brand !== undefined ? brand : existing.brand;
    const finalProject = project !== undefined ? project : existing.project;
    const finalAccent = accent !== undefined ? accent : existing.accent;
    const finalStrategy = strategy !== undefined ? strategy : existing.strategy;
    const finalAudience = audience !== undefined ? audience : existing.audience;
    const finalObjective = objective !== undefined ? objective : existing.objective;
    const finalStatus = status !== undefined ? status : existing.status;
    const finalAssignedTo = assignedToId !== undefined ? (assignedToId || null) : existing.assigned_to_id;

    // Persiste o conjunto final de metadados depois de aplicar os fallbacks acima.
    db.prepare(`
      UPDATE calendars
      SET
        title = ?,
        month = ?,
        brand = ?,
        project = ?,
        accent = ?,
        strategy = ?,
        audience = ?,
        objective = ?,
        status = ?,
        assigned_to_id = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      finalTitle ?? "",
      finalMonth ?? "",
      finalBrand ?? "",
      finalProject ?? "",
      finalAccent ?? "#ef5d3d",
      finalStrategy ?? "",
      finalAudience ?? "",
      finalObjective ?? "",
      finalStatus ?? "draft",
      finalAssignedTo,
      now,
      id
    );

    // Dias enviados valem para o mês e também viram padrão dos próximos meses do cliente.
    if (postingDays !== undefined && Array.isArray(postingDays)) {
      const pDaysStr = JSON.stringify(postingDays);
      db.prepare(`UPDATE calendars SET posting_days = ? WHERE id = ?`).run(pDaysStr, id);
      if (existing.client_id) {
        db.prepare(`UPDATE clients SET posting_days = ? WHERE id = ?`).run(pDaysStr, existing.client_id);
      }
    }

    // Só uma atribuição nova, feita para outra pessoa, produz notificação.
    if (assignedToId && assignedToId !== user.id && assignedToId !== existing.assigned_to_id) {
      const notifId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, message, link, is_read, created_at)
        VALUES (?, ?, 'assignment', 'Calendário transferido para você', ?, ?, 0, ?)
      `).run(
        notifId,
        assignedToId,
        `${user.name} transferiu o calendário "${finalTitle}" para você.`,
        `/studio/${id}`,
        now
      );
    }

    // Operação destrutiva controlada: apaga e reinsere toda a lista, com rollback em falha.
    if (Array.isArray(items)) {
      db.exec("BEGIN TRANSACTION;");
      try {
        db.prepare("DELETE FROM calendar_items WHERE calendar_id = ?").run(id);

        const insertItem = db.prepare(`
          INSERT INTO calendar_items (
            id, calendar_id, date, title, type, status, channel, objective, head, subhead,
            caption, visual, image_url, cta, hashtags, funnel_stage, internal_notes,
            profile, is_collab, collab_profile, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const item of items) {
          const itemId = item.id || crypto.randomUUID();
          insertItem.run(
            itemId,
            id,
            item.date || "",
            item.title || "Nova publicação",
            item.type || "Post",
            item.status || "Ideia",
            item.channel || "Instagram",
            item.objective || "",
            item.head || "",
            item.subhead || "",
            item.caption || "",
            item.visual || "",
            item.imageUrl || item.image_url || "",
            item.cta || "",
            item.hashtags || "",
            item.funnelStage || item.funnel_stage || "Topo",
            item.internalNotes || item.internal_notes || "",
            item.profile || "",
            item.isCollab ? 1 : 0,
            item.collabProfile || "",
            now,
            now
          );
        }
        db.exec("COMMIT;");
      } catch (err) {
        db.exec("ROLLBACK;");
        throw err;
      }
    }

    return NextResponse.json({ success: true, updated_at: now });
  } catch (error: any) {
    console.error("Error updating calendar:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** Remove o calendário; os itens associados são apagados pela cascata do SQLite. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { id } = await params;
    const db = getDb();
    db.prepare("DELETE FROM calendars WHERE id = ?").run(id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
