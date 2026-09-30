/** Expõe uma prova mínima de que processo, SQLite e volume de uploads estão prontos. */

import fs from "node:fs";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { studioDataDirectory, studioUploadsDirectory } from "@/lib/runtime-paths";

export const dynamic = "force-dynamic";

/** Valida dependências locais sem revelar caminhos, credenciais ou conteúdo do banco. */
export async function GET() {
  try {
    getDb().prepare("SELECT 1 AS ok").get();
    fs.accessSync(studioDataDirectory(), fs.constants.R_OK | fs.constants.W_OK);
    fs.accessSync(studioUploadsDirectory(), fs.constants.R_OK | fs.constants.W_OK);

    return NextResponse.json({
      ok: true,
      database: "ready",
      uploads: "ready",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      { ok: false, database: "unavailable", uploads: "unavailable" },
      { status: 503 },
    );
  }
}
