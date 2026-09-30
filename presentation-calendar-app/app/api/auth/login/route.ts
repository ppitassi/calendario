/** Autentica uma conta aprovada e entrega a sessão em cookie protegido. */

import { NextResponse } from "next/server";
import { getDb, verifyPassword } from "@/lib/db";
import { createSession, SESSION_COOKIE, SafeUser } from "@/lib/auth";

/**
 * Normaliza o usuário, valida a senha, bloqueia contas pendentes ou recusadas
 * e grava em cookie HTTP-only a sessão recém-criada.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: "Usuário e senha são obrigatórios." }, { status: 400 });
    }

    const db = getDb();
    const cleanUsername = String(username).trim().toLowerCase();

    const user = (await db.prepare(`
      SELECT id, username, name, password_hash, role, status, created_at
      FROM users
      WHERE LOWER(username) = ?
    `).get(cleanUsername)) as (SafeUser & { password_hash: string }) | undefined;

    if (!user) {
      // Verifica se o banco está completamente vazio para orientar o primeiro cadastro
      const countRow = await db.prepare("SELECT COUNT(*) as count FROM users").get();
      if (Number(countRow?.count || 0) === 0) {
        return NextResponse.json({
          error: "Nenhum usuário cadastrado ainda. Use a aba 'Solicitar Acesso' para criar o primeiro administrador.",
          needsSetup: true,
        }, { status: 400 });
      }
      return NextResponse.json({ error: "Usuário ou senha inválidos." }, { status: 401 });
    }

    const isValid = verifyPassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: "Usuário ou senha inválidos." }, { status: 401 });
    }

    if (user.status === "pending") {
      return NextResponse.json({
        error: "Seu cadastro está aguardando aprovação do administrador.",
        status: "pending"
      }, { status: 403 });
    }

    if (user.status === "rejected") {
      return NextResponse.json({
        error: "Seu cadastro foi recusado pelo administrador.",
        status: "rejected"
      }, { status: 403 });
    }

    const { token, expiresAt } = await createSession(user.id);

    const safeUser: SafeUser = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      status: user.status,
      created_at: user.created_at,
    };

    const response = NextResponse.json({ user: safeUser, success: true });
    response.cookies.set({
      name: SESSION_COOKIE,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      expires: expiresAt,
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json({ error: error.message || "Erro interno no servidor." }, { status: 500 });
  }
}
