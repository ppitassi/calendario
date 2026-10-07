import { NextResponse } from "next/server";
import { getDb, hashPassword, ensureDatabaseReady } from "@/lib/db";
import crypto from "node:crypto";

/**
 * Solicitação de redefinição de senha com re-aprovação obrigatória pelo administrador.
 * Atualiza o password_hash com a nova senha escolhida, marca o usuário como 'pending'
 * e ativa password_reset_pending = 1, notificando todos os administradores.
 */
export async function POST(request: Request) {
  try {
    await ensureDatabaseReady();
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Usuário e nova senha são obrigatórios." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "A nova senha deve conter no mínimo 8 caracteres." },
        { status: 400 }
      );
    }

    const cleanUsername = String(username).trim().toLowerCase();
    const db = getDb();

    const user = (await db.prepare(`
      SELECT id, username, name, role, status
      FROM users
      WHERE LOWER(username) = ?
    `).get(cleanUsername)) as {
      id: string;
      username: string;
      name: string;
      role: string;
      status: string;
    } | undefined;

    if (!user) {
      return NextResponse.json(
        { error: "Usuário não encontrado. Verifique o nome de usuário digitado." },
        { status: 404 }
      );
    }

    const newPasswordHash = hashPassword(password);
    const now = new Date().toISOString();

    // Atualiza a nova senha, define o status como 'pending' e flag password_reset_pending = 1
    await db.prepare(`
      UPDATE users
      SET password_hash = ?,
          status = 'pending',
          password_reset_pending = 1,
          updated_at = ?
      WHERE id = ?
    `).run(newPasswordHash, now, user.id);

    // Invalida sessões ativas existentes desse usuário por segurança
    try {
      await db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
    } catch {}

    // Notifica todos os administradores sobre a solicitação de redefinição
    const admins = (await db.prepare("SELECT id FROM users WHERE role = 'admin'").all()) as { id: string }[];
    for (const admin of admins) {
      const notifId = crypto.randomUUID();
      await db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, message, link, is_read, created_at)
        VALUES (?, ?, 'password_reset_request', 'Solicitação de troca de senha', ?, '/admin', 0, ?)
      `).run(
        notifId,
        admin.id,
        `O usuário "${user.name}" (@${user.username}) solicitou redefinição de senha e aguarda aprovação de acesso.`,
        now
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Solicitação de redefinição enviada com sucesso! O administrador recebeu seu pedido e precisa aprovar seu acesso antes que você possa entrar com a nova senha.",
    });
  } catch (error: any) {
    console.error("Erro na redefinição de senha:", error);
    return NextResponse.json(
      { error: error.message || "Erro interno ao processar solicitação de redefinição." },
      { status: 500 }
    );
  }
}
