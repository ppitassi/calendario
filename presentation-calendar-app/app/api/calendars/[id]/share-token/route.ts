/**
 * Gera ou recupera o token único de compartilhamento para o cliente.
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import crypto from "node:crypto";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { id } = await params;
    const db = getDb();

    let body: any = {};
    try {
      body = await request.json();
    } catch {}

    const calendar = (await db.prepare(
      "SELECT id, share_token FROM calendars WHERE id = ?"
    ).get(id)) as any;

    if (!calendar) {
      return NextResponse.json({ error: "Calendário não encontrado." }, { status: 404 });
    }

    let token = calendar.share_token;
    if (!token || body.forceNew) {
      token = crypto.randomBytes(16).toString("hex");
      await db.prepare(
        "UPDATE calendars SET share_token = ?, updated_at = ? WHERE id = ?"
      ).run(token, new Date().toISOString(), id);
    }

    return NextResponse.json({
      success: true,
      shareToken: token,
      shareUrl: `/portal/${token}`,
    });
  } catch (error: any) {
    console.error("Erro ao gerar token de compartilhamento:", error);
    return NextResponse.json(
      { error: "Erro ao gerar token de compartilhamento." },
      { status: 500 }
    );
  }
}

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

    const calendar = (await db.prepare(
      "SELECT id, share_token, client_feedback, client_feedback_status, client_feedback_at FROM calendars WHERE id = ?"
    ).get(id)) as any;

    if (!calendar) {
      return NextResponse.json({ error: "Calendário não encontrado." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      shareToken: calendar.share_token || null,
      shareUrl: calendar.share_token ? `/portal/${calendar.share_token}` : null,
      clientFeedback: calendar.client_feedback || "",
      clientFeedbackStatus: calendar.client_feedback_status || "",
      clientFeedbackAt: calendar.client_feedback_at || "",
    });
  } catch (error: any) {
    console.error("Erro ao recuperar token de compartilhamento:", error);
    return NextResponse.json(
      { error: "Erro ao recuperar token de compartilhamento." },
      { status: 500 }
    );
  }
}
