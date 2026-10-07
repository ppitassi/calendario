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
    const rawAction = body.action || body.status;
    let action = "approve";
    if (rawAction === "approved" || rawAction === "approve") {
      action = "approve";
    } else if (rawAction === "approved_with_notes" || rawAction === "approve_with_notes") {
      action = "approve_with_notes";
    } else if (rawAction === "rejected_with_notes" || rawAction === "reject_with_notes") {
      action = "reject_with_notes";
    } else {
      return NextResponse.json(
        { error: "Ação de avaliação inválida." },
        { status: 400 }
      );
    }

    const generalFeedback = body.generalFeedback || body.feedbackNotes || "";

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
      SELECT id, client_id, brand, month, title, created_by_id, assigned_to_id, is_pre_calendar
      FROM calendars
      WHERE share_token = ?
    `).get(token)) as any;

    if (!calendar) {
      return NextResponse.json(
        { error: "Calendário não encontrado para este link." },
        { status: 404 }
      );
    }

    const isPreCalendar = Boolean(
      Number(calendar.is_pre_calendar) === 1 ||
      calendar.is_pre_calendar === true ||
      calendar.is_pre_calendar === "1"
    );

    const now = new Date().toISOString();
    // No pré-calendário, aprovação significa que o copy foi aprovado e agora vai para produção das artes
    const targetCalendarStatus = action === "approve"
      ? (isPreCalendar ? "in_production" : "approved")
      : "in_production";

    // 2. Atualiza o calendário com a decisão do cliente
    await db.prepare(`
      UPDATE calendars
      SET
        client_feedback = ?,
        client_feedback_status = ?,
        client_feedback_at = ?,
        status = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      String(generalFeedback).trim(),
      action,
      now,
      targetCalendarStatus,
      now,
      calendar.id
    );

    // 3. Atualiza os comentários por postagem específica
    const rawComments = body.postComments;
    const commentsEntries: [string, string][] = [];
    if (Array.isArray(rawComments)) {
      for (const item of rawComments) {
        if (item && item.postId && typeof item.comment === "string") {
          commentsEntries.push([item.postId, item.comment]);
        }
      }
    } else if (rawComments && typeof rawComments === "object") {
      for (const [itemId, comment] of Object.entries(rawComments)) {
        if (itemId && typeof comment === "string") {
          commentsEntries.push([itemId, comment]);
        }
      }
    }

    const commentedItemIds = new Set<string>();
    for (const [itemId, comment] of commentsEntries) {
      if (itemId && comment.trim()) {
        commentedItemIds.add(itemId);
        await db.prepare(`
          UPDATE calendar_items
          SET client_comment = ?, status = 'Revisão', updated_at = ?
          WHERE id = ? AND calendar_id = ?
        `).run(comment.trim(), now, itemId, calendar.id);
      }
    }

    // Atualiza status das postagens de acordo com a aprovação
    if (action === "approve") {
      if (isPreCalendar) {
        // No pré-calendário aprovado, os posts que estavam em Ideia/Revisão passam para Produção (etapa de artes)
        await db.prepare(`
          UPDATE calendar_items
          SET status = 'Produção', updated_at = ?
          WHERE calendar_id = ? AND status IN ('Ideia', 'Revisão')
        `).run(now, calendar.id);
      } else {
        // No calendário completo aprovado, todos os posts sem ressalva viram Aprovado
        await db.prepare(`
          UPDATE calendar_items
          SET status = 'Aprovado', updated_at = ?
          WHERE calendar_id = ?
        `).run(now, calendar.id);
      }
    }

    // 4. Cria notificação para a equipe (criador, responsável e administradores)
    const actionLabel = action === "approve"
      ? (isPreCalendar ? "Pré-Calendário Aprovado (Copywriting)" : "Calendário Completo Aprovado")
      : action === "approve_with_notes"
      ? (isPreCalendar ? "Pré-Calendário Aprovado com Ressalvas" : "Calendário Aprovado com Ressalvas")
      : (isPreCalendar ? "Pré-Calendário Reprovado com Ressalvas" : "Calendário Reprovado com Ressalvas");

    const notifTitle = `${actionLabel}: ${calendar.brand}`;
    const notifMessage = isPreCalendar && action === "approve"
      ? `O cliente aprovou o pré-calendário de copywriting do mês ${calendar.month} (${calendar.brand}). A etapa de produção dos criativos já pode ser iniciada!`
      : `O cliente avaliou o calendário "${calendar.brand} - ${calendar.month}". Decisão: ${actionLabel}.${
          generalFeedback ? ` Observações: "${generalFeedback.slice(0, 120)}..."` : ""
        }`;

    const userIdsToNotify = new Set<string>();
    if (calendar.assigned_to_id) userIdsToNotify.add(calendar.assigned_to_id);
    if (calendar.created_by_id) userIdsToNotify.add(calendar.created_by_id);

    try {
      const admins = (await db.prepare("SELECT id FROM users WHERE role = 'admin' AND status = 'approved'").all()) as any[];
      for (const a of admins) {
        if (a && a.id) userIdsToNotify.add(a.id);
      }
    } catch {}

    const notifLink = `/?client=${calendar.client_id || ""}&month=${calendar.month || ""}`;
    for (const notifyUserId of userIdsToNotify) {
      const notifId = crypto.randomUUID();
      try {
        await db.prepare(`
          INSERT INTO notifications (id, user_id, type, title, message, link, is_read, created_at)
          VALUES (?, ?, 'client_review', ?, ?, ?, 0, ?)
        `).run(notifId, notifyUserId, notifTitle, notifMessage, notifLink, now);
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
