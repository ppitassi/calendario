/** Lista calendários enriquecidos e cria novos planejamentos editoriais. */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import crypto from "node:crypto";

/**
 * Lista calendários com cliente, criador, responsável e total de itens;
 * `clientId` restringe a consulta a um cliente.
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");

    const db = getDb();
    let query = `
      SELECT
        cal.id,
        cal.client_id,
        cal.title,
        cal.month,
        cal.brand,
        cal.project,
        cal.accent,
        cal.strategy,
        cal.audience,
        cal.objective,
        cal.status,
        cal.created_by_id,
        cal.assigned_to_id,
        cal.created_at,
        cal.updated_at,
        c.name as client_name,
        c.segment as client_segment,
        creator.name as creator_name,
        creator.role as creator_role,
        assigned.name as assigned_name,
        assigned.role as assigned_role,
        (SELECT COUNT(*) FROM calendar_items ci WHERE ci.calendar_id = cal.id) as items_count
      FROM calendars cal
      LEFT JOIN clients c ON c.id = cal.client_id
      LEFT JOIN users creator ON creator.id = cal.created_by_id
      LEFT JOIN users assigned ON assigned.id = cal.assigned_to_id
    `;

    const params: any[] = [];
    if (clientId) {
      query += " WHERE cal.client_id = ?";
      params.push(clientId);
    }

    query += " ORDER BY cal.updated_at DESC";

    const calendars = await db.prepare(query).all(...params);
    return NextResponse.json({ calendars });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** Cria um calendário com padrões do cliente e avisa um responsável diferente do criador. */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const body = await request.json();
    const {
      clientId,
      title,
      month,
      brand,
      project,
      accent = "#ef5d3d",
      strategy = "",
      audience = "",
      objective = "",
      assignedToId = null,
      status = "draft",
    } = body;

    if (!clientId || !title || !month) {
      return NextResponse.json({ error: "Cliente, título e mês são obrigatórios." }, { status: 400 });
    }

    const db = getDb();
    const client = (await db.prepare("SELECT name, accent, has_pre_calendar FROM clients WHERE id = ?").get(clientId)) as { name: string; accent: string; has_pre_calendar?: number } | undefined;
    if (!client) {
      return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const effectiveBrand = brand?.trim() || client.name;
    const effectiveProject = project?.trim() || title;
    const effectiveAccent = accent || client.accent || "#ef5d3d";

    await db.prepare(`
      INSERT INTO calendars (
        id, client_id, title, month, brand, project, accent, strategy, audience, objective, status, is_pre_calendar, created_by_id, assigned_to_id, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      clientId,
      title.trim(),
      month,
      effectiveBrand,
      effectiveProject,
      effectiveAccent,
      strategy,
      audience,
      objective,
      status,
      client.has_pre_calendar ? 1 : 0,
      user.id,
      assignedToId || null,
      now,
      now
    );

    // Uma atribuição para outra pessoa gera um aviso direcionado a ela.
    if (assignedToId && assignedToId !== user.id) {
      const notifId = crypto.randomUUID();
      await db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, message, link, is_read, created_at)
        VALUES (?, ?, 'calendar_assigned', 'Novo calendário atribuído', ?, ?, 0, ?)
      `).run(
        notifId,
        assignedToId,
        `${user.name} atribuiu o calendário "${title}" para você.`,
        `/studio/${id}`,
        now
      );
    }

    const created = await db.prepare("SELECT * FROM calendars WHERE id = ?").get(id);
    return NextResponse.json({ calendar: created, success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
