/**
 * Endpoint de Primeiro Acesso (Setup do Administrador Inicial).
 * Só permite execução se o banco de dados não possuir nenhum usuário cadastrado.
 */

import { NextResponse } from "next/server";
import { getDb, hashPassword } from "@/lib/db";
import { createSession, SESSION_COOKIE, SafeUser } from "@/lib/auth";
import crypto from "node:crypto";

export async function POST(request: Request) {
  try {
    const db = getDb();

    // Bloqueia caso já exista qualquer usuário no banco
    const userCountRow = await db.prepare("SELECT COUNT(*) as count FROM users;").get();
    const count = Number(userCountRow?.count || 0);

    if (count > 0) {
      return NextResponse.json(
        { error: "O administrador inicial já foi configurado. Faça login para acessar." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, username, password } = body;

    if (!name || !username || !password) {
      return NextResponse.json(
        { error: "Nome completo, usuário e senha são obrigatórios." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "A senha deve conter no mínimo 8 caracteres." },
        { status: 400 }
      );
    }

    const cleanUsername = String(username).trim().toLowerCase();
    const cleanName = String(name).trim();
    const newUserId = crypto.randomUUID();
    const passwordHash = hashPassword(password);
    const now = new Date().toISOString();

    await db.prepare(`
      INSERT INTO users (id, username, name, password_hash, role, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'admin', 'approved', ?, ?)
    `).run(newUserId, cleanUsername, cleanName, passwordHash, now, now);

    const safeUser: SafeUser = {
      id: newUserId,
      username: cleanUsername,
      name: cleanName,
      role: "admin",
      status: "approved",
      created_at: now,
    };

    // Cria a sessão para entrar automaticamente
    const { token, expiresAt } = await createSession(newUserId);

    const response = NextResponse.json({
      success: true,
      message: "Administrador configurado com sucesso!",
      user: safeUser,
    });

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
    console.error("Setup error:", error);
    return NextResponse.json(
      { error: error.message || "Falha ao configurar administrador inicial." },
      { status: 500 }
    );
  }
}
