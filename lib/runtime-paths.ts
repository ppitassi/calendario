/**
 * Resolve os diretórios persistentes do Presentation Studio.
 *
 * Em desenvolvimento, os dados ficam dentro do subapp. Em produção, o operador
 * deve apontar um volume absoluto para impedir perda de SQLite/uploads a cada
 * atualização ou troca de release.
 */
import path from "node:path";

function isProductionRuntime() {
  return (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  );
}

/** Resolve uma variável de diretório e rejeita caminho relativo em produção. */
function resolveDirectory(variable: string, fallback: string) {
  const configured = String(process.env[variable] || "").trim();
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
  return resolveDirectory("STUDIO_DATA_DIR", path.join(process.cwd(), "data"));
}

/** Diretório dos uploads; por padrão, é uma subpasta do volume de dados. */
export function studioUploadsDirectory() {
  const configured = String(process.env.STUDIO_UPLOAD_DIR || "").trim();
  if (isProductionRuntime() && !configured) {
    throw new Error("STUDIO_UPLOAD_DIR_NOT_CONFIGURED");
  }
  if (configured) {
    if (isProductionRuntime() && !path.isAbsolute(configured)) {
      throw new Error("STUDIO_UPLOAD_DIR_MUST_BE_ABSOLUTE");
    }
    return path.resolve(configured);
  }
  return path.join(studioDataDirectory(), "uploads");
}
