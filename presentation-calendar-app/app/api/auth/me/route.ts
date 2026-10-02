/** Reúne a identidade e os avisos necessários para iniciar a interface autenticada. */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

/**
 * Retorna usuário, dez notificações recentes e, para administradores, o total
 * de cadastros pendentes; sem sessão válida responde com `user: null`.
 * Se o banco não possuir nenhum usuário, sinaliza `needsSetup: true`.
 */
export async function GET() {
  try {
    let user = null;
    try {
      user = await getCurrentUser();
    } catch (authErr) {
      console.error("Auth resolve error:", authErr);
    }

    if (!user) {
      // Verifica se o sistema precisa de configuração inicial
      let totalUsers = 0;
      try {
        const db = getDb();
        const countRow = await db.prepare("SELECT COUNT(*) as count FROM users;").get();
        totalUsers = Number(countRow?.count || 0);
      } catch (dbErr: any) {
        console.error("Database check in /api/auth/me failed:", dbErr);
        return NextResponse.json({
          user: null,
          needsSetup: true,
          dbError: dbErr?.message || "Banco de dados desconectado ou em inicialização.",
        });
      }

      return NextResponse.json({
        user: null,
        needsSetup: totalUsers === 0,
      });
    }

    const db = getDb();
    let pendingUsersCount = 0;
    if (user.role === "admin") {
      try {
        const row = (await db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'pending'").get()) as { count: number };
        pendingUsersCount = Number(row?.count || 0);
      } catch {}
    }

    let notifications: any[] = [];
    try {
      notifications = await db.prepare(`
        SELECT id, type, title, message, link, is_read, created_at
        FROM notifications
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 10
      `).all(user.id);
    } catch {}

    return NextResponse.json({
      user,
      pendingUsersCount,
      notifications,
      needsSetup: false,
    });
  } catch (error: any) {
    console.error("Error in /api/auth/me:", error);
    return NextResponse.json({
      user: null,
      needsSetup: true,
      dbError: error.message || "Falha na verificação de autenticação.",
    });
  }
}
