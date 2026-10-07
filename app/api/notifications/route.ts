/**
 * API para gerenciamento de notificações do usuário autenticado.
 * Suporta listagem com contagem de não lidas, marcar como lida e limpar histórico.
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const db = getDb();
    const notifications = await db.prepare(`
      SELECT id, type, title, message, link, is_read, created_at
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 30
    `).all(user.id);

    const unreadCountRow = await db.prepare(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = ? AND is_read = 0
    `).get(user.id) as { count: number } | undefined;

    const unreadCount = Number(unreadCountRow?.count || 0);

    return NextResponse.json({
      notifications: notifications || [],
      unreadCount,
    });
  } catch (error: any) {
    console.error("Erro ao listar notificações:", error);
    return NextResponse.json(
      { error: "Erro interno ao listar notificações." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const db = getDb();

    if (body.all) {
      await db.prepare(`
        UPDATE notifications
        SET is_read = 1
        WHERE user_id = ?
      `).run(user.id);
    } else if (body.id) {
      await db.prepare(`
        UPDATE notifications
        SET is_read = 1
        WHERE id = ? AND user_id = ?
      `).run(body.id, user.id);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao atualizar notificações:", error);
    return NextResponse.json(
      { error: "Erro interno ao atualizar notificações." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const db = getDb();

    if (id) {
      await db.prepare(`
        DELETE FROM notifications
        WHERE id = ? AND user_id = ?
      `).run(id, user.id);
    } else {
      await db.prepare(`
        DELETE FROM notifications
        WHERE user_id = ?
      `).run(user.id);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao limpar notificações:", error);
    return NextResponse.json(
      { error: "Erro interno ao limpar notificações." },
      { status: 500 }
    );
  }
}
