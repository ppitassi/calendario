/**
 * Executa as migrações do PostgreSQL no momento de build ou via CLI.
 * Idempotente: se o banco já estiver migrado, encerra em milissegundos.
 */
import { Pool } from "pg";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";

// Carrega .env.local ou .env.production.local se existirem no ambiente local
for (const envFile of [".env.production.local", ".env.local", ".env"]) {
  const p = resolve(process.cwd(), envFile);
  if (existsSync(p)) {
    dotenv.config({ path: p, override: false });
  }
}

function getConnectionString() {
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

async function run() {
  const connStr = getConnectionString();
  if (!connStr) {
    console.log("[migrate-pg] Nenhuma string de conexão PostgreSQL configurada. Pulando migrações no build.");
    process.exit(0);
  }

  const isLocal = connStr.includes("localhost") || connStr.includes("127.0.0.1");
  const cleanConn = connStr.replace(/([?&])sslmode=[^&]+(&|$)/, "$1").replace(/[?&]$/, "");

  const pool = new Pool({
    connectionString: cleanConn,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    console.log("[migrate-pg] Conectando ao PostgreSQL para verificar/aplicar migrações...");
    // Importa o inicializador de schema dinamicamente
    const { initPgSchema } = await import("../lib/db-schema.js").catch(async () => {
      return await import("../lib/db-schema.ts");
    });
    await initPgSchema(pool);
    console.log("[migrate-pg] Migrações verificadas com sucesso.");
  } catch (err) {
    console.warn("[migrate-pg] Aviso: Não foi possível aplicar migrações durante o build (será aplicado em runtime se necessário):", err.message);
  } finally {
    await pool.end();
  }
}

run();
