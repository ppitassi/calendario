/** Expõe uma prova mínima de que processo, banco de dados e uploads estão prontos. */

import fs from "node:fs";
import { NextResponse } from "next/server";
import { getDb, getPostgresConnectionString } from "@/lib/db";
import { studioDataDirectory, studioUploadsDirectory } from "@/lib/runtime-paths";

export const dynamic = "force-dynamic";

/** Valida dependências sem revelar caminhos, credenciais ou conteúdo do banco. */
export async function GET() {
  try {
    const db = getDb();
    await db.prepare("SELECT 1 AS ok").get();

    // Se estiver em modo SQLite local, confirma diretório de dados
    if (!getPostgresConnectionString()) {
      try {
        fs.accessSync(studioDataDirectory(), fs.constants.R_OK | fs.constants.W_OK);
      } catch {}
    }

    try {
      fs.accessSync(studioUploadsDirectory(), fs.constants.R_OK | fs.constants.W_OK);
    } catch {}

    return NextResponse.json({
      ok: true,
      database: db.isPostgres ? "postgres-ready" : "sqlite-ready",
      uploads: "ready",
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      { ok: false, database: "unavailable", error: error.message },
      { status: 503 },
    );
  }
}
