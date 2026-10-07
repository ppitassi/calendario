/** Atualiza ou remove um cliente identificado na URL. */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

/** Remove o cliente; calendários e publicações relacionadas seguem as cascatas do esquema. */
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
    await db.prepare("DELETE FROM clients WHERE id = ?").run(id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** Atualiza somente os campos enviados e conserva os valores anteriores nos omitidos. */
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
    const { name, segment, tone, audience, strategy, accent, logo_url, has_multiple_profiles, has_pre_calendar, profiles } = body;

    const db = getDb();
    const existing = (await db.prepare("SELECT * FROM clients WHERE id = ?").get(id)) as any;

    if (!existing) {
      return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
    }

    const now = new Date().toISOString();
    let finalProfiles = existing.profiles;
    if (profiles !== undefined) {
      finalProfiles = Array.isArray(profiles) ? JSON.stringify(profiles) : String(profiles);
    }

    const finalSegment = segment !== undefined ? segment : existing.segment;
    const finalTone = tone !== undefined ? tone : existing.tone;
    const finalAudience = audience !== undefined ? audience : existing.audience;
    const finalStrategy = strategy !== undefined ? strategy : existing.strategy;

    await db.prepare(`
      UPDATE clients
      SET
        name = ?,
        segment = ?,
        tone = ?,
        audience = ?,
        strategy = ?,
        accent = ?,
        logo_url = ?,
        has_multiple_profiles = ?,
        has_pre_calendar = ?,
        profiles = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      name !== undefined ? name : existing.name,
      finalSegment ?? "",
      finalTone ?? "",
      finalAudience ?? "",
      finalStrategy ?? "",
      accent !== undefined ? accent : existing.accent,
      logo_url !== undefined ? logo_url : existing.logo_url,
      has_multiple_profiles !== undefined ? (has_multiple_profiles ? 1 : 0) : existing.has_multiple_profiles,
      has_pre_calendar !== undefined ? (has_pre_calendar ? 1 : 0) : existing.has_pre_calendar,
      finalProfiles,
      now,
      id
    );

    // Sincroniza os novos dados estratégicos nos calendários deste cliente
    try {
      await db.prepare(`
        UPDATE calendars
        SET
          segment = ?,
          tone = ?,
          audience = ?,
          updated_at = ?
        WHERE client_id = ?
      `).run(
        finalSegment ?? "",
        finalTone ?? "",
        finalAudience ?? "",
        now,
        id
      );
    } catch (err) {
      console.error("Erro ao sincronizar dados estratégicos nos calendários:", err);
    }

    const updated = await db.prepare("SELECT * FROM clients WHERE id = ?").get(id);
    return NextResponse.json({ client: updated, success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
