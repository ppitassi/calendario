import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

/**
 * GET /api/admin/debug-db
 *
 * Diagnóstico exclusivo para admin:
 * - Tipo de banco ativo (PostgreSQL ou SQLite)
 * - Colunas reais de assets
 * - Foreign keys reais de assets
 * - Migrações aplicadas em schema_migrations
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Acesso restrito ao administrador." }, { status: 403 });
    }

    const db = getDb();

    if (db.isPostgres) {
      // 1. Colunas reais de assets no PostgreSQL
      const columns = await db.query(`
        SELECT column_name, is_nullable, data_type
        FROM information_schema.columns
        WHERE table_name = 'assets'
        ORDER BY ordinal_position;
      `);

      // 2. Foreign keys de assets no PostgreSQL
      const foreignKeys = await db.query(`
        SELECT
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.table_name = 'assets'
          AND tc.constraint_type = 'FOREIGN KEY';
      `);

      // 3. Migrações aplicadas no banco
      const migrations = await db.query(`
        SELECT version, name, applied_at
        FROM schema_migrations
        ORDER BY applied_at DESC;
      `);

      return NextResponse.json({
        database: "PostgreSQL",
        columns,
        foreignKeys,
        migrations,
      });
    } else {
      // SQLite
      const columns = await db.prepare("PRAGMA table_info(assets);").all();
      const foreignKeys = await db.prepare("PRAGMA foreign_key_list(assets);").all();

      return NextResponse.json({
        database: "SQLite",
        columns,
        foreignKeys,
      });
    }
  } catch (error: any) {
    console.error("GET /api/admin/debug-db error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
