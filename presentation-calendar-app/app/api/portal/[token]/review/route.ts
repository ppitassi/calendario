/**
 * Endpoint para submissão de aprovação, aprovação com ressalvas ou reprovação com ressalvas pelo cliente.
 */

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import crypto from "node:crypto";

export async function POST(
  request: Request,
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

    const body = await request.json();
    const { action, generalFeedback = "", postComments = {} } = body;

    if (!["approve", "approve_with_notes", "reject_with_notes"].includes(action)) {
      return NextResponse.json(
        { error: "Ação de avaliação inválida." },
        { status: 400 }
      );
    }

    // Se for aprovação ou reprovação COM RESSALVAS, o feedback geral não pode estar vazio
    if (
      (action === "approve_with_notes" || action === "reject_with_notes") &&
      !String(generalFeedback).trim()
    ) {
      return NextResponse.json(
        { error: "Por favor, preencha o campo de ressalvas detalhando os ajustes necessários." },
        { status: 400 }
      );
    }

    const db = getDb();

    // 1. Localiza o calendário
    const calendar = (await db.prepare(`
      SELECT id, brand, month, title, created_by_id, assigned_to_id
      FROM calendars
      WHERE share_token = ?
    `).get(token)) as any;

    if (!calendar) {
      return NextResponse.json(
        { error: "Calendário não encontrado para este link." },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();
    const calendarStatus = action === "approve" ? "approved" : "in_production";

    // 2. Atualiza o calendário com a decisão do cliente
    await db.prepare(`
      UPDATE calendars
      SET
        client_feedback = ?,
        client_feedback_status = ?,
        client_feedback_at = ?,
        status = CASE WHEN ? = 'approve' THEN 'approved' ELSE status END,
        updated_at = ?
      WHERE id = ?
    `).run(
      String(generalFeedback).trim(),
      action,
      now,
      action,
      now,
      calendar.id
    );

    // 3. Atualiza os comentários por postagem específica
    if (postComments && typeof postComments === "object") {
      for (const [itemId, comment] of Object.entries(postComments)) {
        if (itemId && typeof comment === "string") {
          await db.prepare(`
            UPDATE calendar_items
            SET client_comment = ?, updated_at = ?
            WHERE id = ? AND calendar_id = ?
          `).run(comment.trim(), now, itemId, calendar.id);
        }
      }
    }

    // 4. Cria notificação para a equipe
    const actionNames: Record<string, string> = {
      approve: "Aprovado pelo Cliente",
      approve_with_notes: "Aprovado com Ressalvas pelo Cliente",
      reject_with_notes: "Reprovado com Ressalvas pelo Cliente",
    };
    const actionLabel = actionNames[action] || action;

    const notifyUserId = calendar.assigned_to_id || calendar.created_by_id;
    if (notifyUserId) {
      const notifId = crypto.randomUUID();
      const notifTitle = `Revisão do Cliente: ${actionLabel}`;
      const notifMessage = `O cliente avaliou o calendário "${calendar.brand} - ${calendar.month}". Status: ${actionLabel}.${
        generalFeedback ? ` Observações: "${generalFeedback.slice(0, 100)}..."` : ""
      }`;

      try {
        await db.prepare(`
          INSERT INTO notifications (id, user_id, type, title, message, link, is_read, created_at)
          VALUES (?, ?, 'client_review', ?, ?, ?, 0, ?)
        `).run(notifId, notifyUserId, notifTitle, notifMessage, `/`, now);
      } catch (e) {
        console.error("Erro ao registrar notificação:", e);
      }
    }

    return NextResponse.json({
      success: true,
      action,
      clientFeedbackStatus: action,
      clientFeedbackAt: now,
    });
  } catch (error: any) {
    console.error("Erro ao processar revisão do cliente:", error);
    return NextResponse.json(
      { error: "Erro interno ao salvar feedback do cliente." },
      { status: 500 }
    );
  }
}
