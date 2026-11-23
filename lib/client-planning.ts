import type { StudioDb } from "./db";

type Profile = { segment?: string; tone?: string; audience?: string; strategy?: string };
/** Propaga apenas valores herdados em rascunhos ainda não compartilhados. */
export async function syncClientPlanning(db: StudioDb, clientId: string, previous: Profile, next: Profile) {
  for (const field of ["segment", "tone", "audience", "strategy"] as const) {
    if (next[field] === undefined || next[field] === previous[field]) continue;
    await db.prepare(`UPDATE calendars SET ${field} = ?, updated_at = ?
      WHERE client_id = ? AND deleted_at IS NULL AND status = 'draft'
      AND (share_token IS NULL OR share_token = '')
      AND (COALESCE(${field}, '') = '' OR ${field} = ?)`)
      .run(next[field], new Date().toISOString(), clientId, previous[field] || "");
  }
}
