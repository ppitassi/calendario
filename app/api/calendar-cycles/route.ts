import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import crypto from "node:crypto";
import type { CalendarCycle } from "@/lib/types";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month"); // e.g. "2026-11"

    const db = getDb();
    if (month) {
      const cycle = (await db
        .prepare("SELECT * FROM calendar_cycles WHERE month = ?")
        .get(month)) as CalendarCycle | undefined;

      return NextResponse.json({ cycle: cycle || null });
    }

    const cycles = (await db
      .prepare("SELECT * FROM calendar_cycles ORDER BY month DESC LIMIT 24")
      .all()) as CalendarCycle[];

    return NextResponse.json({ cycles: cycles || [] });
  } catch (error: any) {
    console.error("Erro ao consultar ciclos de calendário:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    if (user.role !== "admin" && user.role !== "social_media") {
      return NextResponse.json(
        { error: "Acesso negado: apenas administradores e social media podem definir prazos do ciclo." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { month, title, globalDeadline, notes } = body;

    if (!month || !globalDeadline) {
      return NextResponse.json(
        { error: "Os campos 'month' (ano-mês) e 'globalDeadline' (AAAA-MM-DD) são obrigatórios." },
        { status: 400 }
      );
    }

    const db = getDb();
    const existing = (await db
      .prepare("SELECT id FROM calendar_cycles WHERE month = ?")
      .get(month)) as { id: string } | undefined;

    const now = new Date().toISOString();
    let cycleId = existing?.id;

    if (existing) {
      await db
        .prepare(
          `UPDATE calendar_cycles 
           SET global_deadline = ?, title = COALESCE(?, title), notes = COALESCE(?, notes), updated_at = ?
           WHERE id = ?`
        )
        .run(globalDeadline, title || null, notes || null, now, existing.id);
    } else {
      cycleId = crypto.randomUUID();
      const defaultTitle = title || `Entrega dos Calendários de ${month}`;
      await db
        .prepare(
          `INSERT INTO calendar_cycles (id, month, title, global_deadline, notes, created_by_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(cycleId, month, defaultTitle, globalDeadline, notes || "", user.id, now, now);
    }

    // Vincula automaticamente todos os calendários do mesmo mês a este ciclo
    await db
      .prepare("UPDATE calendars SET cycle_id = ? WHERE month = ?")
      .run(cycleId, month);

    const savedCycle = await db
      .prepare("SELECT * FROM calendar_cycles WHERE id = ?")
      .get(cycleId);

    return NextResponse.json({ cycle: savedCycle });
  } catch (error: any) {
    console.error("Erro ao salvar ciclo de calendário:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
