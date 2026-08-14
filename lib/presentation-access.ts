import { rows } from "./db";
import { ApiContext } from "./api-types";

export async function canAccessPresentationClient(ctx: ApiContext, clientId: string) {
  if (!ctx.userUid || !ctx.permissions.has("canViewPresentation")) return false;
  if (["admin", "gerente", "atendimento"].includes(ctx.userRole || "")) return Boolean((await rows("SELECT 1 FROM clients WHERE id=? LIMIT 1", [clientId]))[0]);
  return Boolean((await rows(`SELECT 1 FROM clients c WHERE c.id=? AND (
    EXISTS(SELECT 1 FROM client_members cm WHERE cm.client_id=c.id AND cm.user_id=? AND cm.removed_at IS NULL) OR
    EXISTS(SELECT 1 FROM work_items w JOIN work_item_assignees a ON a.work_item_id=w.id AND a.removed_at IS NULL WHERE w.client_id=c.id AND a.user_id=? AND w.deleted_at IS NULL)) LIMIT 1`,
    [clientId, ctx.userUid, ctx.userUid]))[0]);
}
