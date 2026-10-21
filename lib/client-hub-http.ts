import { NextResponse } from "next/server";
import { HubError } from "./client-hub-validation";
/** Dados de clientes e links não devem ser guardados em caches compartilhados. */
export function hubJson(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" } });
}
export function hubFailure(error: unknown) {
  if (error instanceof HubError) return hubJson({ error: error.message }, error.status);
  if (error instanceof SyntaxError) return hubJson({ error: "JSON inválido." }, 400);
  console.error("[client-hub]", error);
  return hubJson({ error: "Não foi possível concluir a operação." }, 500);
}
/** Limita o corpo real, inclusive quando Content-Length está ausente. */
export async function hubBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.body) throw new HubError("Dados ausentes.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 512_000) { await reader.cancel(); throw new HubError("Documento muito grande.", 413); }
    chunks.push(value);
  }
  const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new HubError("Dados inválidos.");
  return parsed;
}
