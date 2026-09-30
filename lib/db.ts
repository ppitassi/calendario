/**
 * Conexão com banco de dados do Presentation Studio.
 * Suporta PostgreSQL (Vercel Postgres, Neon, Supabase, Railway) como banco principal
 * e fallback para SQLite local em desenvolvimento quando nenhuma URL for definida.
 */

import { Pool, PoolClient } from "pg";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { studioDataDirectory } from "./runtime-paths";

/** Identifica string de conexão do PostgreSQL em variáveis comuns de hospedagem. */
export function getPostgresConnectionString(): string | null {
  const url =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NO_SSL;
  if (url) return String(url).trim();

  if (process.env.PGHOST && process.env.PGUSER && process.env.PGDATABASE) {
    const port = process.env.PGPORT || "5432";
    const pass = process.env.PGPASSWORD ? `:${encodeURIComponent(process.env.PGPASSWORD)}` : "";
    return `postgres://${encodeURIComponent(process.env.PGUSER)}${pass}@${process.env.PGHOST}:${port}/${process.env.PGDATABASE}`;
  }

  return null;
}

export interface PreparedQuery {
  all(...params: any[]): Promise<any[]>;
  get(...params: any[]): Promise<any | undefined>;
  run(...params: any[]): Promise<{ changes: number }>;
}

export interface StudioDb {
  isPostgres: boolean;
  prepare(sql: string): PreparedQuery;
  exec(sql: string): Promise<void>;
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  queryOne<T = any>(sql: string, params?: any[]): Promise<T | undefined>;
  transaction<T>(callback: (tx: StudioDb) => Promise<T>): Promise<T>;
}

// Converte placeholders "?" para "$1, $2, ..." do PostgreSQL
export function toPostgresSql(sql: string): string {
  let paramIndex = 1;
  return sql.replace(/\?/g, () => `$${paramIndex++}`);
}

/** Converte colunas agregadas de contagem (ex: count, calendars_count) de string para number */
function normalizeRow(row: any): any {
  if (!row || typeof row !== "object") return row;
  const normalized: any = { ...row };
  for (const key of Object.keys(normalized)) {
    if (key === "count" || key.endsWith("_count")) {
      const parsed = Number(normalized[key]);
      if (!isNaN(parsed)) {
        normalized[key] = parsed;
      }
    }
  }
  return normalized;
}

/** Achata parâmetros caso sejam passados como array único ou lista de argumentos */
function flattenParams(params: any[]): any[] {
  if (params.length === 1 && Array.isArray(params[0])) {
    return params[0];
  }
  return params;
}

// Pool global do PostgreSQL (reutilizado no Next.js serverless)
declare global {
  // eslint-disable-next-line no-var
  var __studioPgPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __studioSqliteDb: any | undefined;
  // eslint-disable-next-line no-var
  var __studioSchemaPromise: Promise<void> | undefined;
}

function getPgPool(connectionString: string): Pool {
  if (!global.__studioPgPool) {
    const isLocal =
      connectionString.includes("localhost") ||
      connectionString.includes("127.0.0.1");

    // Limpa parâmetros sslmode para não sobrescrever configuração explícita de ssl do Pool
    const cleanConnectionString = connectionString
      .replace(/([?&])sslmode=[^&]+(&|$)/, "$1")
      .replace(/[?&]$/, "");

    global.__studioPgPool = new Pool({
      connectionString: cleanConnectionString,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return global.__studioPgPool;
}

/** Esquema unificado executado no PostgreSQL */
async function initPgSchema(pool: Pool | PoolClient) {
  await pool.query(`
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
      updated_at TEXT NOT NULL,
      profiles TEXT DEFAULT '',
      posting_days TEXT DEFAULT '[]'
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
      updated_at TEXT NOT NULL,
      posting_days TEXT DEFAULT '[]'
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
      updated_at TEXT NOT NULL,
      profile TEXT DEFAULT '',
      is_collab INTEGER DEFAULT 0,
      collab_profile TEXT DEFAULT ''
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

  // Compatibilidade com colunas legadas
  const migrations = [
    { table: "calendar_items", col: "profile", def: "TEXT DEFAULT ''" },
    { table: "calendar_items", col: "is_collab", def: "INTEGER DEFAULT 0" },
    { table: "calendar_items", col: "collab_profile", def: "TEXT DEFAULT ''" },
    { table: "clients", col: "profiles", def: "TEXT DEFAULT ''" },
    { table: "clients", col: "posting_days", def: "TEXT DEFAULT '[]'" },
    { table: "calendars", col: "posting_days", def: "TEXT DEFAULT '[]'" },
    { table: "clients", col: "logo_url", def: "TEXT" },
    { table: "clients", col: "has_multiple_profiles", def: "INTEGER DEFAULT 0" },
  ];

  for (const { table, col, def } of migrations) {
    try {
      await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} ${def};`);
    } catch {}
  }

  // Provisiona administrador caso configurado em variável e ainda não exista
  const checkAdmin = await pool.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1;");
  if (checkAdmin.rows.length === 0) {
    const adminPassword = String(process.env.STUDIO_ADMIN_PASSWORD || "").trim();
    if (adminPassword.length >= 12) {
      const adminUsername = String(process.env.STUDIO_ADMIN_USERNAME || "admin").trim().toLowerCase();
      const adminName = String(process.env.STUDIO_ADMIN_NAME || "Administrador").trim();
      const adminId = crypto.randomUUID();
      const now = new Date().toISOString();
      const adminHash = hashPassword(adminPassword);
      await pool.query(
        `INSERT INTO users (id, username, name, password_hash, role, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'admin', 'approved', $5, $6)
         ON CONFLICT (username) DO NOTHING;`,
        [adminId, adminUsername, adminName, adminHash, now, now]
      );
    }
  }
}

/** Cria o adaptador de execução para PostgreSQL */
function createPostgresAdapter(pool: Pool): StudioDb {
  const ensureSchema = async () => {
    if (!global.__studioSchemaPromise) {
      global.__studioSchemaPromise = initPgSchema(pool).catch((err) => {
        global.__studioSchemaPromise = undefined;
        console.error("Erro ao inicializar esquema do PostgreSQL:", err);
        throw err;
      });
    }
    return global.__studioSchemaPromise;
  };

  const adapter: StudioDb = {
    isPostgres: true,
    prepare(sql: string): PreparedQuery {
      return {
        async all(...params: any[]): Promise<any[]> {
          await ensureSchema();
          const cleanParams = flattenParams(params);
          const pgSql = toPostgresSql(sql);
          const res = await pool.query(pgSql, cleanParams);
          return res.rows.map(normalizeRow);
        },
        async get(...params: any[]): Promise<any | undefined> {
          await ensureSchema();
          const cleanParams = flattenParams(params);
          const pgSql = toPostgresSql(sql);
          const res = await pool.query(pgSql, cleanParams);
          return res.rows[0] ? normalizeRow(res.rows[0]) : undefined;
        },
        async run(...params: any[]): Promise<{ changes: number }> {
          await ensureSchema();
          const cleanParams = flattenParams(params);
          const pgSql = toPostgresSql(sql);
          const res = await pool.query(pgSql, cleanParams);
          return { changes: res.rowCount ?? 0 };
        },
      };
    },
    async exec(sql: string): Promise<void> {
      await ensureSchema();
      await pool.query(sql);
    },
    async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
      await ensureSchema();
      const pgSql = toPostgresSql(sql);
      const res = await pool.query(pgSql, params || []);
      return res.rows.map(normalizeRow) as T[];
    },
    async queryOne<T = any>(sql: string, params?: any[]): Promise<T | undefined> {
      await ensureSchema();
      const pgSql = toPostgresSql(sql);
      const res = await pool.query(pgSql, params || []);
      return res.rows[0] ? (normalizeRow(res.rows[0]) as T) : undefined;
    },
    async transaction<T>(callback: (tx: StudioDb) => Promise<T>): Promise<T> {
      await ensureSchema();
      const client = await pool.connect();
      try {
        await client.query("BEGIN;");
        const txAdapter: StudioDb = {
          isPostgres: true,
          prepare(sql: string): PreparedQuery {
            return {
              async all(...params: any[]): Promise<any[]> {
                const cleanParams = flattenParams(params);
                const pgSql = toPostgresSql(sql);
                const res = await client.query(pgSql, cleanParams);
                return res.rows.map(normalizeRow);
              },
              async get(...params: any[]): Promise<any | undefined> {
                const cleanParams = flattenParams(params);
                const pgSql = toPostgresSql(sql);
                const res = await client.query(pgSql, cleanParams);
                return res.rows[0] ? normalizeRow(res.rows[0]) : undefined;
              },
              async run(...params: any[]): Promise<{ changes: number }> {
                const cleanParams = flattenParams(params);
                const pgSql = toPostgresSql(sql);
                const res = await client.query(pgSql, cleanParams);
                return { changes: res.rowCount ?? 0 };
              },
            };
          },
          async exec(sql: string): Promise<void> {
            await client.query(sql);
          },
          async query<U = any>(sql: string, params?: any[]): Promise<U[]> {
            const pgSql = toPostgresSql(sql);
            const res = await client.query(pgSql, params || []);
            return res.rows.map(normalizeRow) as U[];
          },
          async queryOne<U = any>(sql: string, params?: any[]): Promise<U | undefined> {
            const pgSql = toPostgresSql(sql);
            const res = await client.query(pgSql, params || []);
            return res.rows[0] ? (normalizeRow(res.rows[0]) as U) : undefined;
          },
          transaction() {
            throw new Error("Transações aninhadas não são suportadas.");
          },
        };

        const result = await callback(txAdapter);
        await client.query("COMMIT;");
        return result;
      } catch (err) {
        await client.query("ROLLBACK;");
        throw err;
      } finally {
        client.release();
      }
    },
  };

  return adapter;
}

/** Adaptador SQLite para fallback em desenvolvimento local quando não houver Postgres */
function createSqliteAdapter(): StudioDb {
  const getSqliteDb = () => {
    if (!global.__studioSqliteDb) {
      // Importa dinamicamente node:sqlite apenas quando necessário no fallback
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { DatabaseSync } = require("node:sqlite");
      const dbDir = studioDataDirectory();
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      const dbPath = path.join(dbDir, "studio.db");
      const db = new DatabaseSync(dbPath);
      db.exec("PRAGMA journal_mode = WAL;");
      db.exec("PRAGMA foreign_keys = ON;");
      initSqliteSchema(db);
      global.__studioSqliteDb = db;
    }
    return global.__studioSqliteDb;
  };

  return {
    isPostgres: false,
    prepare(sql: string): PreparedQuery {
      return {
        async all(...params: any[]): Promise<any[]> {
          const db = getSqliteDb();
          const cleanParams = flattenParams(params);
          const stmt = db.prepare(sql);
          const rows = stmt.all(...cleanParams);
          return rows.map(normalizeRow);
        },
        async get(...params: any[]): Promise<any | undefined> {
          const db = getSqliteDb();
          const cleanParams = flattenParams(params);
          const stmt = db.prepare(sql);
          const row = stmt.get(...cleanParams);
          return row ? normalizeRow(row) : undefined;
        },
        async run(...params: any[]): Promise<{ changes: number }> {
          const db = getSqliteDb();
          const cleanParams = flattenParams(params);
          const stmt = db.prepare(sql);
          const info = stmt.run(...cleanParams);
          return { changes: info.changes };
        },
      };
    },
    async exec(sql: string): Promise<void> {
      const db = getSqliteDb();
      db.exec(sql);
    },
    async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
      const db = getSqliteDb();
      const stmt = db.prepare(sql);
      const rows = stmt.all(...(params || []));
      return rows.map(normalizeRow) as T[];
    },
    async queryOne<T = any>(sql: string, params?: any[]): Promise<T | undefined> {
      const db = getSqliteDb();
      const stmt = db.prepare(sql);
      const row = stmt.get(...(params || []));
      return row ? (normalizeRow(row) as T) : undefined;
    },
    async transaction<T>(callback: (tx: StudioDb) => Promise<T>): Promise<T> {
      const db = getSqliteDb();
      db.exec("BEGIN TRANSACTION;");
      try {
        const result = await callback(this);
        db.exec("COMMIT;");
        return result;
      } catch (err) {
        db.exec("ROLLBACK;");
        throw err;
      }
    },
  };
}

function initSqliteSchema(db: any) {
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

  try { db.exec("ALTER TABLE calendar_items ADD COLUMN profile TEXT DEFAULT '';"); } catch {}
  try { db.exec("ALTER TABLE calendar_items ADD COLUMN is_collab INTEGER DEFAULT 0;"); } catch {}
  try { db.exec("ALTER TABLE calendar_items ADD COLUMN collab_profile TEXT DEFAULT '';"); } catch {}
  try { db.exec("ALTER TABLE clients ADD COLUMN profiles TEXT DEFAULT '';"); } catch {}
  try { db.exec("ALTER TABLE clients ADD COLUMN posting_days TEXT DEFAULT '[]';"); } catch {}
  try { db.exec("ALTER TABLE calendars ADD COLUMN posting_days TEXT DEFAULT '[]';"); } catch {}
  try { db.exec("ALTER TABLE clients ADD COLUMN logo_url TEXT;"); } catch {}
  try { db.exec("ALTER TABLE clients ADD COLUMN has_multiple_profiles INTEGER DEFAULT 0;"); } catch {}

  const existingAdmin = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
  if (!existingAdmin) {
    const adminPassword = String(process.env.STUDIO_ADMIN_PASSWORD || "").trim();
    if (adminPassword.length >= 12) {
      const adminUsername = String(process.env.STUDIO_ADMIN_USERNAME || "admin").trim().toLowerCase();
      const adminName = String(process.env.STUDIO_ADMIN_NAME || "Administrador").trim();
      const adminId = crypto.randomUUID();
      const now = new Date().toISOString();
      const adminHash = hashPassword(adminPassword);
      db.prepare(`
        INSERT INTO users (id, username, name, password_hash, role, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'admin', 'approved', ?, ?)
      `).run(adminId, adminUsername, adminName, adminHash, now, now);
    }
  }
}

/** Obtém a instância ativa do banco de dados (PostgreSQL se configurado, ou SQLite fallback) */
export function getDb(): StudioDb {
  const pgUrl = getPostgresConnectionString();
  if (pgUrl) {
    const pool = getPgPool(pgUrl);
    return createPostgresAdapter(pool);
  }
  return createSqliteAdapter();
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
