/**
 * Centraliza a conexão SQLite, cria o esquema idempotente, aplica compatibilidade
 * com bancos antigos e provisiona o primeiro administrador.
 */

import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { studioDataDirectory } from "./runtime-paths";

// Mantém uma única conexão durante os recarregamentos do servidor Next.js.
declare global {
  // eslint-disable-next-line no-var
  var __studioDb: DatabaseSync | undefined;
}

/** Abre o SQLite uma vez, ativa WAL/chaves estrangeiras e reutiliza a conexão global. */
export function getDb(): DatabaseSync {
  if (!global.__studioDb) {
    const dbDir = studioDataDirectory();
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    const dbPath = path.join(dbDir, "studio.db");
    const db = new DatabaseSync(dbPath);
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA foreign_keys = ON;");
    initSchema(db);
    global.__studioDb = db;
  }
  return global.__studioDb;
}

/** Gera um salt aleatório e armazena a senha como `salt:hash` usando scrypt. */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/** Recalcula o scrypt e compara os hashes em tempo constante; formato inválido falha fechado. */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  const verifyHash = crypto.scryptSync(password, salt, 64).toString("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(verifyHash, "hex"));
  } catch {
    return false;
  }
}

/** Cria tabelas, acrescenta colunas legadas ausentes e provisiona o administrador inicial. */
function initSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'social_media', 'designer')),
      status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      segment TEXT DEFAULT '',
      accent TEXT DEFAULT '#ef5d3d',
      logo_url TEXT,
      has_multiple_profiles INTEGER DEFAULT 0,
      created_by_id TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS calendars (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      month TEXT NOT NULL,
      brand TEXT NOT NULL,
      project TEXT NOT NULL,
      accent TEXT DEFAULT '#ef5d3d',
      strategy TEXT DEFAULT '',
      audience TEXT DEFAULT '',
      objective TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'sent_to_designer', 'in_production', 'sent_to_social_media', 'approved')),
      created_by_id TEXT NOT NULL REFERENCES users(id),
      assigned_to_id TEXT REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS calendar_items (
      id TEXT PRIMARY KEY,
      calendar_id TEXT NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'Post',
      status TEXT NOT NULL DEFAULT 'Ideia',
      channel TEXT DEFAULT 'Instagram',
      objective TEXT DEFAULT '',
      head TEXT DEFAULT '',
      subhead TEXT DEFAULT '',
      caption TEXT DEFAULT '',
      visual TEXT DEFAULT '',
      image_url TEXT DEFAULT '',
      cta TEXT DEFAULT '',
      hashtags TEXT DEFAULT '',
      funnel_stage TEXT DEFAULT 'Topo',
      internal_notes TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      link TEXT DEFAULT '',
      is_read INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);

  // Compatibilidade incremental: cada ALTER pode falhar quando a coluna já existe.
  try {
    db.exec("ALTER TABLE calendar_items ADD COLUMN profile TEXT DEFAULT '';");
  } catch {}
  try {
    db.exec("ALTER TABLE calendar_items ADD COLUMN is_collab INTEGER DEFAULT 0;");
  } catch {}
  try {
    db.exec("ALTER TABLE calendar_items ADD COLUMN collab_profile TEXT DEFAULT '';");
  } catch {}
  try {
    db.exec("ALTER TABLE clients ADD COLUMN profiles TEXT DEFAULT '';");
  } catch {}
  try {
    db.exec("ALTER TABLE clients ADD COLUMN posting_days TEXT DEFAULT '[]';");
  } catch {}
  try {
    db.exec("ALTER TABLE calendars ADD COLUMN posting_days TEXT DEFAULT '[]';");
  } catch {}
  try {
    db.exec("ALTER TABLE clients ADD COLUMN logo_url TEXT;");
  } catch {}
  try {
    db.exec("ALTER TABLE clients ADD COLUMN has_multiple_profiles INTEGER DEFAULT 0;");
  } catch {}

  // A primeira inicialização exige senha forte em produção; a senha temporária só existe localmente.
  const existingAdmin = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
  if (!existingAdmin) {
    const production = process.env.NODE_ENV === "production";
    const adminPassword =
      process.env.STUDIO_ADMIN_PASSWORD || (production ? "" : "admin123-local");
    if (adminPassword.length < 12) {
      throw new Error("STUDIO_ADMIN_PASSWORD deve ter ao menos 12 caracteres.");
    }

    const adminUsername = String(process.env.STUDIO_ADMIN_USERNAME || "admin").trim();
    const adminName = String(process.env.STUDIO_ADMIN_NAME || "Administrador").trim();
    if (!adminUsername || !adminName) {
      throw new Error("STUDIO_ADMIN_USERNAME e STUDIO_ADMIN_NAME são obrigatórios.");
    }

    if (!production && !process.env.STUDIO_ADMIN_PASSWORD) {
      console.warn(
        "[presentation-studio] Senha local temporária: admin123-local. Troque-a antes de usar dados reais.",
      );
    }

    const adminId = crypto.randomUUID();
    const now = new Date().toISOString();
    const adminHash = hashPassword(adminPassword);
    db.prepare(`
      INSERT INTO users (id, username, name, password_hash, role, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'admin', 'approved', ?, ?)
    `).run(adminId, adminUsername, adminName, adminHash, now, now);
  }
}
