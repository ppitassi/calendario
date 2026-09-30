/**
 * Lê o cookie de sessão, resolve o usuário aprovado e cria ou remove sessões
 * persistidas no SQLite. O hash de senha pertence a `lib/db.ts`.
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

  const session = db.prepare(`
    SELECT user_id, expires_at
    FROM sessions
    WHERE token = ? AND expires_at > ?
  `).get(token, now) as { user_id: string; expires_at: string } | undefined;

  if (!session) return null;

  const user = db.prepare(`
    SELECT id, username, name, role, status, created_at
    FROM users
    WHERE id = ? AND status = 'approved'
  `).get(session.user_id) as SafeUser | undefined;

  return user || null;
}

/** Gera um token aleatório, grava uma sessão de 30 dias e devolve sua expiração. */
export function createSession(userId: string): { token: string; expiresAt: Date } {
  const db = getDb();
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO sessions (token, user_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).run(token, userId, expiresAt.toISOString(), now);

  return { token, expiresAt };
}

/** Apaga do SQLite a sessão identificada pelo token recebido. */
export function deleteSession(token: string) {
  const db = getDb();
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export { SESSION_COOKIE };
