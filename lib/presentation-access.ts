import { rows } from "./db";
import { ApiContext } from "./api-types";

export async function canAccessPresentationClient(ctx: ApiContext, clientId: string) {
  if (!ctx.userUid || !ctx.permissions.has("canViewPresentation")) return false;
  if (["admin", "gerente", "atendimento"].includes(ctx.userRole || "")) return Boolean((await rows("SELECT 1 FROM clients WHERE id=? LIMIT 1", [clientId]))[0]);
  return Boolean((await rows(`SELECT 1 FROM clients c WHERE c.id=? AND (
    JSON_CONTAINS(CASE WHEN JSON_VALID(c.owners) THEN c.owners ELSE JSON_ARRAY() END,JSON_QUOTE(?)) OR
    EXISTS(SELECT 1 FROM posts p WHERE p.clientId=c.id AND (p.currentAssigneeId=? OR p.actionAssigneeId=? OR p.assigneeId=?)) OR
    EXISTS(SELECT 1 FROM users u WHERE u.uid=? AND u.clientId=c.id)) LIMIT 1`,
    [clientId, ctx.userUid, ctx.userUid, ctx.userUid, ctx.userUid, ctx.userUid]))[0]);
}
