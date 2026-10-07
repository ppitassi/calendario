/**
 * Resolve os diretórios persistentes do Presentation Studio.
 *
 * Em desenvolvimento, os dados ficam dentro do subapp. Em produção, o operador
 * deve apontar um volume absoluto para impedir perda de SQLite/uploads a cada
 * atualização ou troca de release.
 */
import path from "node:path";

function isPostgresConfigured() {
  return Boolean(
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NO_SSL ||
    (process.env.PGHOST && process.env.PGUSER && process.env.PGDATABASE)
  );
}

function isProductionRuntime() {
  return (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  );
}

/** Resolve uma variável de diretório e rejeita caminho relativo em produção. */
function resolveDirectory(variable: string, fallback: string) {
  const configured = String(process.env[variable] || "").trim();
  // No Vercel ou quando Postgres estiver configurado, diretório persistente em disco não é obrigatório
  if (isPostgresConfigured() || Boolean(process.env.VERCEL)) {
    return path.resolve(configured || fallback);
  }
  if (isProductionRuntime() && !configured) {
    throw new Error(`${variable}_NOT_CONFIGURED`);
  }
  if (isProductionRuntime() && !path.isAbsolute(configured)) {
    throw new Error(`${variable}_MUST_BE_ABSOLUTE`);
  }
  return path.resolve(configured || fallback);
}

/** Diretório do SQLite e de outros estados duráveis do Studio. */
export function studioDataDirectory() {
  const defaultDir = process.env.VERCEL ? "/tmp/presentation-studio/data" : path.join(process.cwd(), "data");
  return resolveDirectory("STUDIO_DATA_DIR", defaultDir);
}

/** Diretório dos uploads; por padrão, é uma subpasta do volume de dados. */
export function studioUploadsDirectory() {
  const configured = String(process.env.STUDIO_UPLOAD_DIR || "").trim();
  if (configured) {
    if (isProductionRuntime() && !isPostgresConfigured() && !path.isAbsolute(configured)) {
      throw new Error("STUDIO_UPLOAD_DIR_MUST_BE_ABSOLUTE");
    }
    return path.resolve(configured);
  }
  const defaultUploads = process.env.VERCEL ? "/tmp/presentation-studio/uploads" : path.join(process.cwd(), "data", "uploads");
  return defaultUploads;
}
