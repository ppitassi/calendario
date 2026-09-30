/** Recebe novos cadastros, sempre sujeitos à aprovação administrativa. */

import { NextResponse } from "next/server";
import { getDb, hashPassword } from "@/lib/db";
import crypto from "node:crypto";

/**
 * Cria um usuário pendente, limita o papel solicitado a designer ou social
 * media e avisa todos os administradores sobre a solicitação.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password, name, role } = body;

    if (!username || !password || !name) {
      return NextResponse.json({ error: "Nome, usuário e senha são obrigatórios." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "A senha deve conter no mínimo 8 caracteres." }, { status: 400 });
    }

    const assignedRole = role === "designer" ? "designer" : "social_media";
    const cleanUsername = String(username).trim().toLowerCase();
    const cleanName = String(name).trim();

    const db = getDb();
    const existing = await db.prepare("SELECT id FROM users WHERE LOWER(username) = ?").get(cleanUsername);
    if (existing) {
      return NextResponse.json({ error: "Este nome de usuário já está em uso." }, { status: 400 });
    }

    const userId = crypto.randomUUID();
    const now = new Date().toISOString();
    const passwordHash = hashPassword(password);

    // O cadastro nasce pendente; somente um administrador pode liberá-lo.
    await db.prepare(`
      INSERT INTO users (id, username, name, password_hash, role, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(userId, cleanUsername, cleanName, passwordHash, assignedRole, now, now);

    // Cada administrador recebe seu próprio registro de notificação.
    const admins = (await db.prepare("SELECT id FROM users WHERE role = 'admin'").all()) as { id: string }[];
    const roleLabel = assignedRole === "designer" ? "Designer" : "Social Media";
    for (const admin of admins) {
      const notifId = crypto.randomUUID();
      await db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, message, link, is_read, created_at)
        VALUES (?, ?, 'user_registration', 'Novo cadastro pendente', ?, '/admin', 0, ?)
      `).run(
        notifId,
        admin.id,
        `Usuário "${cleanName}" (@${cleanUsername}) solicitou acesso como ${roleLabel}.`,
        now
      );
    }

    return NextResponse.json({
      success: true,
      status: "pending",
      message: "Cadastro realizado com sucesso! Aguarde a aprovação do administrador para efetuar login.",
    });
  } catch (error: any) {
    console.error("Register error:", error);
    return NextResponse.json({ error: error.message || "Erro interno no servidor." }, { status: 500 });
  }
}
