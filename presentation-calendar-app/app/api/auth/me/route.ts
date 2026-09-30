/** Reúne a identidade e os avisos necessários para iniciar a interface autenticada. */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

/**
 * Retorna usuário, dez notificações recentes e, para administradores, o total
 * de cadastros pendentes; sem sessão válida responde com `user: null`.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ user: null });
    }

    const db = getDb();
    let pendingUsersCount = 0;
    if (user.role === "admin") {
      const row = db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'pending'").get() as { count: number };
      pendingUsersCount = row?.count || 0;
    }

    const notifications = db.prepare(`
      SELECT id, type, title, message, link, is_read, created_at
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).all(user.id);

    return NextResponse.json({
      user,
      pendingUsersCount,
      notifications,
    });
  } catch (error: any) {
    console.error("Error in /api/auth/me:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
