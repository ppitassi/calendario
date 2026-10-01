/** Garante que exista um calendário para a combinação de cliente e mês. */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import crypto from "node:crypto";

/**
 * Retorna o calendário já existente ou cria um novo e preenche publicações nos
 * dias da semana configurados no cliente.
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const body = await request.json();
    const { clientId, month } = body;

    if (!clientId || !month) {
      return NextResponse.json(
        { error: "clientId e month são obrigatórios." },
        { status: 400 }
      );
    }

    const db = getDb();

    // Procura primeiro o registro existente para não duplicar cliente/mês.
    let calendar = (await db
      .prepare(
        `SELECT
          cal.*,
          c.name as client_name,
          c.segment as client_segment,
          c.logo_url as client_logo_url,
          c.has_multiple_profiles as client_has_multiple_profiles,
          c.posting_days as client_posting_days,
          (SELECT COUNT(*) FROM calendar_items ci WHERE ci.calendar_id = cal.id) as items_count
        FROM calendars cal
        LEFT JOIN clients c ON c.id = cal.client_id
        WHERE cal.client_id = ? AND cal.month = ?
        LIMIT 1`
      )
      .get(clientId, month)) as any;

    if (!calendar) {
      const client = (await db
        .prepare("SELECT * FROM clients WHERE id = ?")
        .get(clientId)) as any;

      if (!client) {
        return NextResponse.json(
          { error: "Cliente não encontrado." },
          { status: 404 }
        );
      }

      let clientPostingDays: number[] = [];
      try {
        clientPostingDays = JSON.parse(client.posting_days || "[]");
      } catch {
        clientPostingDays = [];
      }

      let clientWeekdayFormats: Record<string, string> = {};
      try {
        clientWeekdayFormats = JSON.parse(client.weekday_formats || "{}");
      } catch {
        clientWeekdayFormats = {};
      }

      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const title = `Planejamento ${month}`;

      await db.prepare(
        `INSERT INTO calendars (
          id, client_id, title, month, brand, project, accent, strategy, audience, objective, status, posting_days, weekday_formats, created_by_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        clientId,
        title,
        month,
        client.name,
        title,
        client.accent || "#ef5d3d",
        "",
        "",
        "",
        "draft",
        JSON.stringify(clientPostingDays),
        JSON.stringify(clientWeekdayFormats),
        user.id,
        now,
        now
      );

      // No calendário novo, cria uma publicação em cada dia semanal configurado.
      if (clientPostingDays.length > 0) {
        const [yearStr, monthStr] = month.split("-");
        const y = parseInt(yearStr, 10);
        const m = parseInt(monthStr, 10) - 1;
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        let clientProfiles: string[] = [];
        try {
          clientProfiles = client.profiles ? JSON.parse(client.profiles) : [];
        } catch {
          if (client.profiles && typeof client.profiles === "string") {
            clientProfiles = client.profiles.split(",").map((s: string) => s.trim()).filter(Boolean);
          }
        }
        const defaultProfile = clientProfiles.length === 1 ? clientProfiles[0] : "";

        const insertItem = db.prepare(`
          INSERT INTO calendar_items (
            id, calendar_id, date, title, type, status, channel, objective, head, subhead,
            caption, visual, image_url, story_url, cta, hashtags, funnel_stage, internal_notes,
            profile, is_collab, collab_profile, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (id) DO NOTHING
        `);

        for (let day = 1; day <= daysInMonth; day++) {
          const d = new Date(y, m, day);
          if (clientPostingDays.includes(d.getDay())) {
            const dateStr = `${month}-${String(day).padStart(2, "0")}`;
            const dayOfWeek = d.getDay();
            const formatForDay = clientWeekdayFormats[dayOfWeek] || "Feed e Story";

            await insertItem.run(
              crypto.randomUUID(),
              id,
              dateStr,
              defaultProfile || "Publicação",
              formatForDay,
              "Ideia",
              "Instagram",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "",
              "Topo",
              "",
              defaultProfile,
              0,
              "",
              now,
              now
            );
          }
        }
      }

      calendar = (await db
        .prepare(
          `SELECT
            cal.*,
            c.name as client_name,
            c.segment as client_segment,
            c.logo_url as client_logo_url,
            c.has_multiple_profiles as client_has_multiple_profiles,
            c.posting_days as client_posting_days,
            (SELECT COUNT(*) FROM calendar_items ci WHERE ci.calendar_id = cal.id) as items_count
          FROM calendars cal
          LEFT JOIN clients c ON c.id = cal.client_id
          WHERE cal.id = ?`
        )
        .get(id)) as any;
    }

    if (calendar) {
      try {
        calendar.posting_days = JSON.parse(calendar.posting_days || "[]");
      } catch {
        calendar.posting_days = [];
      }
    }

    return NextResponse.json({ calendar, success: true });
  } catch (error: any) {
    console.error("Error in calendars/ensure:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
