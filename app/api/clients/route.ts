/** Lista e cria clientes acessíveis pela área autenticada. */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import crypto from "node:crypto";

/**
 * Lista clientes; com `month=AAAA-MM`, inclui o calendário daquele mês,
 * o estado editorial e a quantidade de publicações.
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");

    const db = getDb();
    let clients: any[];

    if (month) {
      clients = await db
        .prepare(
          `SELECT
            c.id,
            c.name,
            c.segment,
            c.tone,
            c.audience,
            c.strategy,
            c.accent,
            c.posting_days,
            c.logo_url,
            c.has_multiple_profiles,
            c.has_pre_calendar,
            c.created_by_id,
            c.created_at,
            u.name as creator_name,
            (SELECT COUNT(*) FROM calendars cal WHERE cal.client_id = c.id) as calendars_count,
            cal.id as month_calendar_id,
            cal.status as month_calendar_status,
            cal.title as month_calendar_title,
            cal.client_feedback_status as month_client_feedback_status,
            cal.client_feedback as month_client_feedback,
            cal.client_feedback_at as month_client_feedback_at,
            cal.is_pre_calendar as month_is_pre_calendar,
            cal.share_token as month_share_token,
            (SELECT COUNT(*) FROM calendar_items ci WHERE ci.calendar_id = cal.id) as month_items_count
          FROM clients c
          LEFT JOIN users u ON u.id = c.created_by_id
          LEFT JOIN calendars cal ON cal.client_id = c.id AND cal.month = ?
          ORDER BY c.name ASC`
        )
        .all(month);
    } else {
      clients = await db
        .prepare(
          `SELECT
            c.id,
            c.name,
            c.segment,
            c.tone,
            c.audience,
            c.strategy,
            c.accent,
            c.posting_days,
            c.logo_url,
            c.has_multiple_profiles,
            c.has_pre_calendar,
            c.created_by_id,
            c.created_at,
            u.name as creator_name,
            (SELECT COUNT(*) FROM calendars cal WHERE cal.client_id = c.id) as calendars_count
          FROM clients c
          LEFT JOIN users u ON u.id = c.created_by_id
          ORDER BY c.name ASC`
        )
        .all();
    }

    const formattedClients = clients.map((c: any) => {
      let pDays: number[] = [];
      try {
        pDays = JSON.parse(c.posting_days || "[]");
      } catch {
        pDays = [];
      }
      return {
        ...c,
        posting_days: pDays,
      };
    });

    return NextResponse.json({ clients: formattedClients });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** Cria um cliente, aplica a cor padrão e salva os metadados. */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const body = await request.json();
    const { name, segment, tone, audience, strategy, accent, logo_url, has_multiple_profiles, has_pre_calendar, ownerId } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "O nome do cliente é obrigatório." }, { status: 400 });
    }

    const db = getDb();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const cleanName = name.trim();
    const cleanSegment = segment?.trim() || "";
    const cleanTone = tone?.trim() || "";
    const cleanAudience = audience?.trim() || "";
    const cleanStrategy = strategy?.trim() || "";
    const cleanAccent = accent || "#ef5d3d";
    const effectiveOwnerId = ownerId || user.id;

    await db.prepare(`
      INSERT INTO clients (id, name, segment, tone, audience, strategy, accent, logo_url, has_multiple_profiles, has_pre_calendar, created_by_id, owner_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, cleanName, cleanSegment, cleanTone, cleanAudience, cleanStrategy, cleanAccent, logo_url || null, has_multiple_profiles ? 1 : 0, has_pre_calendar ? 1 : 0, user.id, effectiveOwnerId, now, now);

    const client = await db.prepare("SELECT * FROM clients WHERE id = ?").get(id);
    return NextResponse.json({ client, success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
