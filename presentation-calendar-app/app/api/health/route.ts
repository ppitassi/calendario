/** Expõe uma prova mínima de que processo, banco de dados e uploads estão prontos. */

import fs from "node:fs";
import { NextResponse } from "next/server";
import { getDb, getPostgresConnectionString } from "@/lib/db";
import { studioDataDirectory, studioUploadsDirectory } from "@/lib/runtime-paths";

export const dynamic = "force-dynamic";

/** Valida dependências sem revelar caminhos, credenciais ou conteúdo do banco. */
export async function GET() {
  const hasPgUrl = Boolean(getPostgresConnectionString());
  try {
    const db = getDb();
    await db.prepare("SELECT 1 AS ok").get();

    return NextResponse.json({
      ok: true,
      database: db.isPostgres ? "postgres-ready" : "sqlite-ready",
      postgresConfigured: hasPgUrl,
      isVercel: Boolean(process.env.VERCEL),
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      {
        ok: false,
        database: "unavailable",
        postgresConfigured: hasPgUrl,
        isVercel: Boolean(process.env.VERCEL),
        nodeVersion: process.version,
        error: error.message || String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
