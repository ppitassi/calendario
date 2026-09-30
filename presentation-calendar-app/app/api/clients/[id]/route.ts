/** Atualiza ou remove um cliente identificado na URL. */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

/** Remove o cliente; calendários e publicações relacionadas seguem as cascatas do esquema. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { id } = await params;
    const db = getDb();
    await db.prepare("DELETE FROM clients WHERE id = ?").run(id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** Atualiza somente os campos enviados e conserva os valores anteriores nos omitidos. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, segment, accent, logo_url, has_multiple_profiles } = body;

    const db = getDb();
    const existing = (await db.prepare("SELECT * FROM clients WHERE id = ?").get(id)) as any;

    if (!existing) {
      return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
    }

    const now = new Date().toISOString();

    await db.prepare(`
      UPDATE clients
      SET
        name = ?,
        segment = ?,
        accent = ?,
        logo_url = ?,
        has_multiple_profiles = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      name !== undefined ? name : existing.name,
      segment !== undefined ? segment : existing.segment,
      accent !== undefined ? accent : existing.accent,
      logo_url !== undefined ? logo_url : existing.logo_url,
      has_multiple_profiles !== undefined ? (has_multiple_profiles ? 1 : 0) : existing.has_multiple_profiles,
      now,
      id
    );

    const updated = await db.prepare("SELECT * FROM clients WHERE id = ?").get(id);
    return NextResponse.json({ client: updated, success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
