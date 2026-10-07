/**
 * Lê o cookie de sessão, resolve o usuário aprovado e cria ou remove sessões
 * persistidas no banco. O hash de senha pertence a `lib/db.ts`.
 */

import { cookies } from "next/headers";
import crypto from "node:crypto";
import { getDb } from "./db";

/** Representação que pode sair da autenticação; nunca contém `password_hash`. */
export type SafeUser = {
  id: string;
  username: string;
  name: string;
  role: "admin" | "social_media" | "designer";
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

const SESSION_COOKIE = "studio_session";
const SESSION_DURATION_DAYS = 30;

/** Lê o token do cookie e retorna apenas sessão vigente de usuário aprovado. */
export async function getCurrentUser(): Promise<SafeUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = getDb();
  const now = new Date().toISOString();

  const user = (await db.prepare(`
    SELECT u.id, u.username, u.name, u.role, u.status, u.created_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > ? AND u.status = 'approved'
  `).get(token, now)) as SafeUser | undefined;

  return user || null;
}

/** Gera um token aleatório, grava uma sessão de 30 dias e devolve sua expiração. */
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const db = getDb();
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date().toISOString();

  await db.prepare(`
    INSERT INTO sessions (token, user_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).run(token, userId, expiresAt.toISOString(), now);

  return { token, expiresAt };
}

/** Apaga do banco a sessão identificada pelo token recebido. */
export async function deleteSession(token: string): Promise<void> {
  const db = getDb();
  await db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export { SESSION_COOKIE };
