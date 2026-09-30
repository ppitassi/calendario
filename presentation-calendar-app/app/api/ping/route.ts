import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const envKeys = Object.keys(process.env).filter(
    (k) => !k.toLowerCase().includes("secret") && !k.toLowerCase().includes("password")
  );

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    isVercel: Boolean(process.env.VERCEL),
    nodeVersion: process.version,
    hasPostgresUrl: Boolean(process.env.POSTGRES_URL || process.env.DATABASE_URL),
    availableEnvKeys: envKeys,
  });
}
