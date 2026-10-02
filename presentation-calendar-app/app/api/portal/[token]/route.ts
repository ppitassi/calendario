/**
 * API pública do Portal do Cliente acessada via share_token.
 * Não requer login com senha, pois a segurança é baseada no token único.
 */

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token || token.trim().length < 8) {
      return NextResponse.json(
        { error: "Token de visualização inválido." },
        { status: 400 }
      );
    }

    const db = getDb();

    // 1. Busca o calendário pelo token único
    const calendar = (await db.prepare(`
      SELECT
        cal.id,
        cal.client_id,
        cal.title,
        cal.month,
        cal.brand,
        cal.project,
        cal.accent,
        cal.strategy,
        cal.objective,
        cal.status,
        cal.is_pre_calendar,
        cal.client_feedback,
        cal.client_feedback_status,
        cal.client_feedback_at,
        c.name as client_name,
        c.logo_url as client_logo_url,
        c.profiles as client_profiles,
        c.has_multiple_profiles as client_has_multiple_profiles,
        c.has_pre_calendar as client_has_pre_calendar
      FROM calendars cal
      LEFT JOIN clients c ON c.id = cal.client_id
      WHERE cal.share_token = ?
    `).get(token)) as any;

    if (!calendar) {
      return NextResponse.json(
        { error: "Link de aprovação não encontrado ou expirado." },
        { status: 404 }
      );
    }

    // Normaliza status de pré-calendário considerando tanto o calendário quanto a configuração do cliente
    const isPre = Boolean(
      Number(calendar.is_pre_calendar) === 1 ||
      calendar.is_pre_calendar === true ||
      calendar.is_pre_calendar === "1" ||
      Number(calendar.isPreCalendar) === 1 ||
      calendar.isPreCalendar === true ||
      calendar.isPreCalendar === "1" ||
      Number(calendar.client_has_pre_calendar) === 1 ||
      calendar.client_has_pre_calendar === true ||
      calendar.client_has_pre_calendar === "1"
    );
    calendar.is_pre_calendar = isPre ? 1 : 0;
    calendar.isPreCalendar = isPre;
    calendar.client_has_pre_calendar = isPre ? 1 : 0;

    // 2. Busca todas as publicações deste calendário
    const items = (await db.prepare(`
      SELECT
        id,
        calendar_id,
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
        image_url,
        story_url,
        cta,
        hashtags,
        funnel_stage,
        profile,
        is_collab,
        collab_profile,
        order_index,
        client_comment
      FROM calendar_items
      WHERE calendar_id = ?
      ORDER BY date ASC, order_index ASC, id ASC
    `).all(calendar.id)) as any[];

    return NextResponse.json({
      success: true,
      calendar,
      client: {
        id: calendar.client_id,
        name: calendar.client_name || calendar.brand,
        logoUrl: calendar.client_logo_url || "",
        accent: calendar.accent || "#ef5d3d",
      },
      items,
    });
  } catch (error: any) {
    console.error("Erro ao carregar portal do cliente:", error);
    return NextResponse.json(
      { error: "Erro interno ao carregar portal do cliente." },
      { status: 500 }
    );
  }
}
