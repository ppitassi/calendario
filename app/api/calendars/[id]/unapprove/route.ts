/**
 * Endpoint para revogar/desaprovar um calendário avaliado pelo cliente.
 * Apenas administradores têm permissão para realizar esta operação.
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import crypto from "node:crypto";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    if (user.role !== "admin") {
      return NextResponse.json(
        { error: "Apenas administradores podem desaprovar calendários." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const db = getDb();

    const calendar = (await db.prepare(`
      SELECT id, client_id, month, brand, is_pre_calendar, client_feedback_status, status
      FROM calendars WHERE id = ?
    `).get(id)) as any;

    if (!calendar) {
      return NextResponse.json({ error: "Calendário não encontrado." }, { status: 404 });
    }

    const now = new Date().toISOString();

    // 1. Reseta o feedback do cliente e o status do calendário para em produção
    await db.prepare(`
      UPDATE calendars
      SET
        client_feedback = NULL,
        client_feedback_status = NULL,
        client_feedback_at = NULL,
        status = 'in_production',
        updated_at = ?
      WHERE id = ?
    `).run(now, id);

    // 2. Se as postagens estavam 'Aprovado', voltam para 'Revisão'
    await db.prepare(`
      UPDATE calendar_items
      SET status = 'Revisão', updated_at = ?
      WHERE calendar_id = ? AND status = 'Aprovado'
    `).run(now, id);

    // 3. Notifica a equipe de que a aprovação foi revogada pelo administrador
    const isPre = Boolean(
      Number(calendar.is_pre_calendar) === 1 ||
      calendar.is_pre_calendar === true ||
      calendar.is_pre_calendar === "1"
    );
    const label = isPre ? "Pré-Calendário" : "Calendário";
    const notifTitle = `${label} Desaprovado: ${calendar.brand}`;
    const notifMessage = `O administrador ${user.name} desaprovou o ${label.toLowerCase()} do mês ${calendar.month} (${calendar.brand}). O status foi reaberto para revisão.`;
    const notifLink = `/?client=${calendar.client_id || ""}&month=${calendar.month || ""}`;

    try {
      const allUsers = (await db.prepare("SELECT id FROM users WHERE status = 'approved'").all()) as any[];
      for (const u of allUsers) {
        if (u && u.id) {
          const notifId = crypto.randomUUID();
          await db.prepare(`
            INSERT INTO notifications (id, user_id, type, title, message, link, is_read, created_at)
            VALUES (?, ?, 'admin_action', ?, ?, ?, 0, ?)
          `).run(notifId, u.id, notifTitle, notifMessage, notifLink, now);
        }
      }
    } catch (notifErr) {
      console.error("Erro ao emitir notificação de desaprovação:", notifErr);
    }

    // 4. Retorna os itens atualizados para sincronização imediata no cliente
    const updatedItems = (await db.prepare(`
      SELECT * FROM calendar_items WHERE calendar_id = ? ORDER BY date ASC, order_index ASC
    `).all(id)) as any[];

    const normalizedItems = updatedItems.map((item) => ({
      id: item.id,
      date: item.date,
      title: item.title,
      type: item.type,
      caption: item.caption,
      briefing: item.briefing,
      status: item.status,
      category: item.category,
      funnelStage: item.funnel_stage,
      imageUrl: item.image_url,
      storyUrl: item.story_url,
      profile: item.profile,
      isCollab: Boolean(item.is_collab),
      collabProfile: item.collab_profile,
      clientComment: item.client_comment,
      orderIndex: item.order_index,
    }));

    return NextResponse.json({
      success: true,
      message: `${label} desaprovado com sucesso.`,
      items: normalizedItems,
    });
  } catch (error: any) {
    console.error("Erro ao desaprovar calendário:", error);
    return NextResponse.json(
      { error: "Erro interno ao desaprovar calendário." },
      { status: 500 }
    );
  }
}
