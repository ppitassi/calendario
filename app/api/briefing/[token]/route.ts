import { findPublicHub, submitBriefing } from "@/lib/client-hub";
import { getDb } from "@/lib/db";
import { hubJson, hubFailure, hubBody } from "@/lib/client-hub-http";
type Context = { params: Promise<{ token: string }> };
/** O formulário externo nunca devolve respostas anteriores ou dados internos. */
export async function GET(_request: Request, { params }: Context) {
  try {
    const row = await findPublicHub((await params).token, "briefing");
    const client = await getDb().prepare("SELECT name FROM clients WHERE id = ?").get(row.client_id);
    return hubJson({ name: client.name, open: Boolean(row.briefing_open) });
  } catch (error) { return hubFailure(error); }
}
export async function POST(request: Request, { params }: Context) {
  try {
    const body = await hubBody(request);
    await submitBriefing((await params).token, body.answers);
    return hubJson({ success: true });
  } catch (error) { return hubFailure(error); }
}
