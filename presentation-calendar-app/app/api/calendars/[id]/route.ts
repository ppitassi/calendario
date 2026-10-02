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

    const calendar = (await db.prepare(`
      SELECT
        cal.*,
        c.name as client_name,
        c.logo_url as client_logo_url,
        c.has_multiple_profiles as client_has_multiple_profiles,
        c.profiles as client_profiles,
        c.posting_days as client_posting_days,
        c.weekday_formats as client_weekday_formats,
        creator.name as creator_name,
        creator.role as creator_role,
        assigned.name as assigned_name,
        assigned.role as assigned_role
      FROM calendars cal
      LEFT JOIN clients c ON c.id = cal.client_id
      LEFT JOIN users creator ON creator.id = cal.created_by_id
      LEFT JOIN users assigned ON assigned.id = cal.assigned_to_id
      WHERE cal.id = ?
    `).get(id)) as any;

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

    let parsedWeekdayFormats: Record<string, string> = {};
    try {
      parsedWeekdayFormats = JSON.parse(calendar.weekday_formats || "{}");
    } catch {
      parsedWeekdayFormats = {};
    }
    if (Object.keys(parsedWeekdayFormats).length === 0 && calendar.client_weekday_formats) {
      try {
        parsedWeekdayFormats = JSON.parse(calendar.client_weekday_formats || "{}");
      } catch {}
    }
    calendar.weekday_formats = parsedWeekdayFormats;

    // Constrói lista persistente de perfis cadastrados para este cliente
    const profileSet = new Set<string>();
    if (calendar.client_profiles) {
      try {
        const parsed = JSON.parse(calendar.client_profiles);
        if (Array.isArray(parsed)) {
          parsed.forEach((p: string) => { if (p && p.trim()) profileSet.add(p.trim()); });
        }
      } catch {
        calendar.client_profiles.split(",").forEach((p: string) => {
          if (p && p.trim()) profileSet.add(p.trim());
        });
      }
    }

    // Busca também perfis utilizados em quaisquer calendários deste cliente apenas se nenhum perfil estiver cadastrado
    if (calendar.client_id && profileSet.size === 0 && !calendar.client_profiles) {
      try {
        const usedProfiles = await db.prepare(`
          SELECT DISTINCT ci.profile
          FROM calendar_items ci
          JOIN calendars c ON c.id = ci.calendar_id
          WHERE c.client_id = ? AND ci.profile IS NOT NULL AND ci.profile != ''
        `).all(calendar.client_id);
        for (const row of usedProfiles) {
          if (row.profile && row.profile.trim()) profileSet.add(row.profile.trim());
        }

        const usedCollabs = await db.prepare(`
          SELECT DISTINCT ci.collab_profile
          FROM calendar_items ci
          JOIN calendars c ON c.id = ci.calendar_id
          WHERE c.client_id = ? AND ci.collab_profile IS NOT NULL AND ci.collab_profile != ''
        `).all(calendar.client_id);
        for (const row of usedCollabs) {
          if (row.collab_profile && row.collab_profile.trim()) profileSet.add(row.collab_profile.trim());
        }
      } catch {}
    }

    calendar.available_profiles = Array.from(profileSet);

    const items = await db.prepare(`
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
        image_url as "imageUrl",
        image_url,
        story_url as "storyUrl",
        story_url,
        cta,
        hashtags,
        funnel_stage as "funnelStage",
        funnel_stage,
        internal_notes as "internalNotes",
        internal_notes,
        profile,
        is_collab as "isCollab",
        is_collab,
        collab_profile as "collabProfile",
        collab_profile,
        order_index as "orderIndex",
        order_index
      FROM calendar_items
      WHERE calendar_id = ?
      ORDER BY date ASC, order_index ASC, created_at ASC
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
      weekdayFormats,
      items,
      profiles,
      is_pre_calendar,
      isPreCalendar,
    } = body;

    const db = getDb();
    const existing = (await db.prepare("SELECT * FROM calendars WHERE id = ?").get(id)) as any;
    if (!existing) {
      return NextResponse.json({ error: "Calendário não encontrado." }, { status: 404 });
    }

    const now = new Date().toISOString();

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
    const finalIsPreCalendar = is_pre_calendar !== undefined
      ? (is_pre_calendar ? 1 : 0)
      : isPreCalendar !== undefined
      ? (isPreCalendar ? 1 : 0)
      : (existing.is_pre_calendar ?? 0);

    await db.prepare(`
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
        is_pre_calendar = ?,
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
      finalIsPreCalendar,
      now,
      id
    );

    if (profiles !== undefined && existing.client_id) {
      const profilesStr = Array.isArray(profiles) ? JSON.stringify(profiles) : String(profiles);
      try {
        await db.prepare("UPDATE clients SET profiles = ?, updated_at = ? WHERE id = ?").run(
          profilesStr,
          now,
          existing.client_id
        );
      } catch (err) {
        console.error("Erro ao atualizar profiles do cliente:", err);
      }
    }

    if (postingDays !== undefined && Array.isArray(postingDays)) {
      const pDaysStr = JSON.stringify(postingDays);
      await db.prepare(`UPDATE calendars SET posting_days = ? WHERE id = ?`).run(pDaysStr, id);
      if (existing.client_id) {
        await db.prepare(`UPDATE clients SET posting_days = ? WHERE id = ?`).run(pDaysStr, existing.client_id);
      }
    }

    if (weekdayFormats !== undefined && typeof weekdayFormats === "object") {
      const wFormatsStr = JSON.stringify(weekdayFormats);
      await db.prepare(`UPDATE calendars SET weekday_formats = ? WHERE id = ?`).run(wFormatsStr, id);
      if (existing.client_id) {
        await db.prepare(`UPDATE clients SET weekday_formats = ? WHERE id = ?`).run(wFormatsStr, existing.client_id);
      }
    }

    if (assignedToId && assignedToId !== user.id && assignedToId !== existing.assigned_to_id) {
      const notifId = crypto.randomUUID();
      await db.prepare(`
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

    if (Array.isArray(items)) {
      // 1. Sanitiza a lista para garantir IDs únicos e não vazios
      const seenIds = new Set<string>();
      const sanitizedItems: any[] = [];
      for (const item of items) {
        let itemId = item && item.id ? String(item.id).trim() : "";
        if (!itemId || seenIds.has(itemId)) {
          itemId = crypto.randomUUID();
        }
        seenIds.add(itemId);
        sanitizedItems.push({ ...item, id: itemId });
      }

      const validIds = sanitizedItems.map((it) => it.id);

      await db.transaction(async (tx) => {
        // 2. Remove itens deste calendário que não existem mais na lista enviada
        if (validIds.length > 0) {
          const placeholders = validIds.map(() => "?").join(", ");
          await tx.prepare(`DELETE FROM calendar_items WHERE calendar_id = ? AND id NOT IN (${placeholders})`).run(id, ...validIds);
        } else {
          await tx.prepare("DELETE FROM calendar_items WHERE calendar_id = ?").run(id);
        }

        // 3. Upsert idempotente usando ON CONFLICT (id) DO UPDATE
        const upsertItem = tx.prepare(`
          INSERT INTO calendar_items (
            id, calendar_id, date, title, type, status, channel, objective, head, subhead,
            caption, visual, image_url, story_url, cta, hashtags, funnel_stage, internal_notes,
            profile, is_collab, collab_profile, order_index, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (id) DO UPDATE SET
            calendar_id = EXCLUDED.calendar_id,
            date = EXCLUDED.date,
            title = EXCLUDED.title,
            type = EXCLUDED.type,
            status = EXCLUDED.status,
            channel = EXCLUDED.channel,
            objective = EXCLUDED.objective,
            head = EXCLUDED.head,
            subhead = EXCLUDED.subhead,
            caption = EXCLUDED.caption,
            visual = EXCLUDED.visual,
            image_url = EXCLUDED.image_url,
            story_url = EXCLUDED.story_url,
            cta = EXCLUDED.cta,
            hashtags = EXCLUDED.hashtags,
            funnel_stage = EXCLUDED.funnel_stage,
            internal_notes = EXCLUDED.internal_notes,
            profile = EXCLUDED.profile,
            is_collab = EXCLUDED.is_collab,
            collab_profile = EXCLUDED.collab_profile,
            order_index = EXCLUDED.order_index,
            updated_at = EXCLUDED.updated_at
        `);

        for (let i = 0; i < sanitizedItems.length; i++) {
          const item = sanitizedItems[i];
          const orderIdx = item.orderIndex !== undefined ? Number(item.orderIndex) : i;
          await upsertItem.run(
            item.id,
            id,
            item.date || "",
            item.title || "Nova publicação",
            item.type === "Post" ? "Feed" : item.type || "Feed",
            item.status || "Ideia",
            item.channel || "Instagram",
            item.objective || "",
            item.head || "",
            item.subhead || "",
            item.caption || "",
            item.visual || "",
            item.imageUrl || item.image_url || item.imageurl || "",
            item.storyUrl || item.story_url || item.storyurl || "",
            item.cta || "",
            item.hashtags || "",
            item.funnelStage || item.funnel_stage || item.funnelstage || "Topo",
            item.internalNotes || item.internal_notes || item.internalnotes || "",
            item.profile || "",
            item.isCollab || item.is_collab || item.iscollab ? 1 : 0,
            item.collabProfile || item.collab_profile || item.collabprofile || "",
            orderIdx,
            now,
            now
          );
        }
      });
    }

    return NextResponse.json({ success: true, updated_at: now });
  } catch (error: any) {
    console.error("Error updating calendar:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** Remove o calendário; os itens associados são apagados pela cascata. */
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
    await db.prepare("DELETE FROM calendars WHERE id = ?").run(id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
