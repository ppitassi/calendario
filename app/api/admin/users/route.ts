/** Centraliza a consulta e as mutações administrativas de contas do Studio. */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb, hashPassword } from "@/lib/db";
import crypto from "node:crypto";

/** Permite somente administrador e lista cadastros pendentes antes dos demais. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Acesso restrito ao administrador." }, { status: 403 });
    }

    const db = getDb();
    const users = await db.prepare(`
      SELECT id, username, name, role, status, password_reset_pending, created_at, updated_at
      FROM users
      ORDER BY
        CASE status
          WHEN 'pending' THEN 0
          WHEN 'approved' THEN 1
          ELSE 2
        END,
        created_at DESC
    `).all();

    return NextResponse.json({ users });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Multiplexa criação direta, aprovação, rejeição, exclusão e troca de papel;
 * cada operação volta a validar que o chamador continua administrador.
 */
export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Acesso restrito ao administrador." }, { status: 403 });
    }

    const body = await request.json();
    const { action, userId, name, username, password, role, newRole } = body;

    const db = getDb();
    const now = new Date().toISOString();

    // Criação administrativa: a conta já nasce aprovada e pode entrar imediatamente.
    if (action === "create") {
      if (!name || !username || !password) {
        return NextResponse.json({ error: "Nome, usuário e senha são obrigatórios." }, { status: 400 });
      }

      if (password.length < 8) {
        return NextResponse.json({ error: "A senha deve ter no mínimo 8 caracteres." }, { status: 400 });
      }

      const cleanUsername = String(username).trim().toLowerCase();
      const cleanName = String(name).trim();
      const cleanRole = ["admin", "social_media", "designer"].includes(role) ? role : "social_media";

      const existing = await db.prepare("SELECT id FROM users WHERE LOWER(username) = ?").get(cleanUsername);
      if (existing) {
        return NextResponse.json({ error: "Este nome de usuário já está em uso." }, { status: 400 });
      }

      const newUserId = crypto.randomUUID();
      const passwordHash = hashPassword(password);

      await db.prepare(`
        INSERT INTO users (id, username, name, password_hash, role, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'approved', ?, ?)
      `).run(newUserId, cleanUsername, cleanName, passwordHash, cleanRole, now, now);

      return NextResponse.json({
        success: true,
        message: `Usuário ${cleanName} criado e aprovado com sucesso!`,
        user: {
          id: newUserId,
          username: cleanUsername,
          name: cleanName,
          role: cleanRole,
          status: "approved",
          created_at: now,
        },
      });
    }

    // As demais ações exigem uma operação conhecida e um usuário-alvo existente.
    if (!userId || !["approve", "reject", "delete", "change_role"].includes(action)) {
      return NextResponse.json({ error: "Ação ou usuário inválido." }, { status: 400 });
    }

    const targetUser = (await db.prepare("SELECT id, name, username, role, password_reset_pending FROM users WHERE id = ?").get(userId)) as {
      id: string;
      name: string;
      username: string;
      role: string;
      password_reset_pending?: number;
    } | undefined;

    if (!targetUser) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    // A troca de papel também gera uma notificação para a pessoa afetada.
    if (action === "change_role") {
      const targetRole = newRole || role;
      if (!["admin", "social_media", "designer"].includes(targetRole)) {
        return NextResponse.json({ error: "Função inválida. Escolha Designer, Social Media ou Administrador." }, { status: 400 });
      }

      // Impede rebaixar o último administrador aprovado e deixar o sistema sem gestão.
      if (targetUser.role === "admin" && targetRole !== "admin") {
        const adminCount = (await db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND status = 'approved'").get()) as { count: number };
        if (Number(adminCount?.count || 0) <= 1) {
          return NextResponse.json({ error: "Não é possível alterar a função do único administrador ativo do sistema." }, { status: 400 });
        }
      }

      await db.prepare("UPDATE users SET role = ?, updated_at = ? WHERE id = ?").run(targetRole, now, userId);

      const roleLabels: Record<string, string> = {
        admin: "Administrador",
        designer: "Designer",
        social_media: "Social Media",
      };

      const notifId = crypto.randomUUID();
      await db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, message, link, is_read, created_at)
        VALUES (?, ?, 'role_change', 'Função atualizada', ?, '/', 0, ?)
      `).run(notifId, userId, `Sua função no sistema foi atualizada para ${roleLabels[targetRole] || targetRole}.`, now);

      return NextResponse.json({
        success: true,
        message: `Função de ${targetUser.name} alterada para ${roleLabels[targetRole] || targetRole} com sucesso!`,
        newRole: targetRole,
      });
    }

    // Aprovar pode ajustar o papel e sempre informa a pessoa recém-liberada.
    if (action === "approve") {
      const isPasswordReset = Number(targetUser.password_reset_pending || 0) === 1;
      const approvedRole = role && ["admin", "social_media", "designer"].includes(role) ? role : undefined;
      if (approvedRole) {
        await db.prepare("UPDATE users SET status = 'approved', password_reset_pending = 0, role = ?, updated_at = ? WHERE id = ?").run(approvedRole, now, userId);
      } else {
        await db.prepare("UPDATE users SET status = 'approved', password_reset_pending = 0, updated_at = ? WHERE id = ?").run(now, userId);
      }

      const notifId = crypto.randomUUID();
      const notifMsg = isPasswordReset
        ? "Sua redefinição de senha foi aprovada pelo administrador! Você já pode entrar com sua nova senha."
        : "Seu cadastro foi aprovado! Você já pode utilizar todas as ferramentas.";
      const notifTitle = isPasswordReset ? "Senha aprovada" : "Conta aprovada";

      await db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, message, link, is_read, created_at)
        VALUES (?, ?, 'approval', ?, ?, '/', 0, ?)
      `).run(notifId, userId, notifTitle, notifMsg, now);
      return NextResponse.json({ success: true, message: `Usuário ${targetUser.name} aprovado com sucesso!` });
    } else if (action === "reject") {
      // Rejeitar bloqueia o login; não cria notificação para uma conta sem acesso.
      await db.prepare("UPDATE users SET status = 'rejected', password_reset_pending = 0, updated_at = ? WHERE id = ?").run(now, userId);
      return NextResponse.json({ success: true, message: `Usuário ${targetUser.name} recusado.` });
    } else if (action === "delete") {
      // A autoexclusão é proibida para não invalidar a sessão no meio da operação.
      if (targetUser.id === currentUser.id) {
        return NextResponse.json({ error: "Você não pode excluir sua própria conta enquanto conectado." }, { status: 400 });
      }
      await db.prepare("DELETE FROM users WHERE id = ?").run(userId);
      return NextResponse.json({ success: true, message: `Usuário ${targetUser.name} excluído do banco.` });
    }

    return NextResponse.json({ error: "Ação desconhecida." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
