/**
 * Conexão com banco de dados do Presentation Studio.
 * Suporta PostgreSQL (Vercel Postgres, Neon, Supabase, Railway) como banco principal
 * e fallback para SQLite local em desenvolvimento quando nenhuma URL for definida.
 */

import { Pool } from "pg";
import path from "node:path";
import fs from "node:fs";
import { studioDataDirectory } from "./runtime-paths";
import {
  toPostgresSql,
  normalizeRow,
  flattenParams,
  hashPassword,
  verifyPassword,
} from "./db-normalize";
import { initPgSchema, initSqliteSchema } from "./db-schema";

// Re-export helpers for backward compatibility
export { toPostgresSql, normalizeRow, hashPassword, verifyPassword };

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

    const cleanConnectionString = connectionString
      .replace(/([?&])sslmode=[^&]+(&|$)/, "$1")
      .replace(/[?&]$/, "");

    const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    const maxConns = process.env.POSTGRES_POOL_MAX
      ? parseInt(process.env.POSTGRES_POOL_MAX, 10)
      : (isServerless ? 3 : (isLocal ? 10 : 5));

    global.__studioPgPool = new Pool({
      connectionString: cleanConnectionString,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: maxConns,
      idleTimeoutMillis: isServerless ? 10000 : 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return global.__studioPgPool;
}

/** Cria o adaptador de execução para PostgreSQL */
function createPostgresAdapter(pool: Pool): StudioDb {
  const ensureSchema = async () => {
    if (global.__studioPgSchemaReady) return;
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
          prepare(txSql: string): PreparedQuery {
            return {
              async all(...params: any[]): Promise<any[]> {
                const cleanParams = flattenParams(params);
                const pgSql = toPostgresSql(txSql);
                const res = await client.query(pgSql, cleanParams);
                return res.rows.map(normalizeRow);
              },
              async get(...params: any[]): Promise<any | undefined> {
                const cleanParams = flattenParams(params);
                const pgSql = toPostgresSql(txSql);
                const res = await client.query(pgSql, cleanParams);
                return res.rows[0] ? normalizeRow(res.rows[0]) : undefined;
              },
              async run(...params: any[]): Promise<{ changes: number }> {
                const cleanParams = flattenParams(params);
                const pgSql = toPostgresSql(txSql);
                const res = await client.query(pgSql, cleanParams);
                return { changes: res.rowCount ?? 0 };
              },
            };
          },
          async exec(txSql: string): Promise<void> {
            await client.query(txSql);
          },
          async query<U = any>(txSql: string, params?: any[]): Promise<U[]> {
            const pgSql = toPostgresSql(txSql);
            const res = await client.query(pgSql, params || []);
            return res.rows.map(normalizeRow) as U[];
          },
          async queryOne<U = any>(txSql: string, params?: any[]): Promise<U | undefined> {
            const pgSql = toPostgresSql(txSql);
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
      let DatabaseSync: any;
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        DatabaseSync = require("node:sqlite").DatabaseSync;
      } catch {
        throw new Error(
          "Banco de dados não configurado. Adicione a variável DATABASE_URL ou POSTGRES_URL no painel da Vercel para conectar ao banco PostgreSQL."
        );
      }
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

/** Obtém a instância ativa do banco de dados (PostgreSQL se configurado, ou SQLite fallback) */
export function getDb(): StudioDb {
  const pgUrl = getPostgresConnectionString();
  if (pgUrl) {
    const pool = getPgPool(pgUrl);
    return createPostgresAdapter(pool);
  }
  return createSqliteAdapter();
}

/** Persiste arquivo enviado no banco de dados para sobreviver a ambientes serverless/Vercel */
export async function saveUploadedFile(
  filename: string,
  mimeType: string,
  buffer: Buffer
): Promise<void> {
  const db = getDb();
  const base64Data = buffer.toString("base64");
  const now = new Date().toISOString();
  if (db.isPostgres) {
    await db.prepare(`
      INSERT INTO uploaded_files (filename, mime_type, data, size_bytes, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (filename) DO UPDATE SET
        mime_type = EXCLUDED.mime_type,
        data = EXCLUDED.data,
        size_bytes = EXCLUDED.size_bytes,
        created_at = EXCLUDED.created_at;
    `).run(filename, mimeType, base64Data, buffer.length, now);
  } else {
    await db.prepare(`
      INSERT OR REPLACE INTO uploaded_files (filename, mime_type, data, size_bytes, created_at)
      VALUES (?, ?, ?, ?, ?);
    `).run(filename, mimeType, base64Data, buffer.length, now);
  }
}

/** Recupera arquivo enviado do banco de dados persistente */
export async function getUploadedFile(
  filename: string
): Promise<{ data: Buffer; mimeType: string } | null> {
  const db = getDb();
  const row = await db.prepare("SELECT mime_type, data FROM uploaded_files WHERE filename = ?").get(filename);
  if (!row || !row.data) return null;
  return {
    mimeType: row.mime_type || "application/octet-stream",
    data: Buffer.from(row.data, "base64"),
  };
}

/**
 * Garante que a inicialização do esquema e todas as migrações/backfills
 * tenham terminado antes de executar consultas críticas ou de bootstrap.
 */
export async function ensureDatabaseReady(): Promise<void> {
  const db = getDb();
  if (db.isPostgres) {
    await db.exec("SELECT 1;");
  }
}

