import { getCurrentUser } from "@/lib/auth";
import { ensureHub, getHub, saveHub, changeSharing } from "@/lib/client-hub";
import { hubJson, hubFailure, hubBody } from "@/lib/client-hub-http";
type Context = { params: Promise<{ id: string }> };
/** Equipe autenticada lê a ficha; designer não recebe links de edição. */
export async function GET(_request: Request, context: Context) {
  try {
    const user = await getCurrentUser();
    if (!user) return hubJson({ error: "Não autorizado." }, 401);
    return hubJson(await getHub((await context.params).id, user.role !== "designer"));
  } catch (error) { return hubFailure(error); }
}
/** Inicialização e compartilhamento são ações explícitas de admin/social media. */
export async function POST(request: Request, context: Context) {
  try {
    const user = await getCurrentUser();
    if (!user) return hubJson({ error: "Não autorizado." }, 401);
    if (user.role === "designer") return hubJson({ error: "Seu perfil tem acesso de leitura." }, 403);
    const { id } = await context.params, body = await hubBody(request);
    await ensureHub(id);
    if (body.action !== "initialize") await changeSharing(id, body.action);
    return hubJson(await getHub(id, true));
  } catch (error) { return hubFailure(error); }
}
/** O servidor aplica a permissão mesmo quando a requisição ignora os controles da interface. */
export async function PUT(request: Request, context: Context) {
  try {
    const user = await getCurrentUser();
    if (!user) return hubJson({ error: "Não autorizado." }, 401);
    if (user.role === "designer") return hubJson({ error: "Seu perfil tem acesso de leitura." }, 403);
    const { id } = await context.params, body = await hubBody(request);
    await ensureHub(id);
    await saveHub(id, body);
    return hubJson(await getHub(id, true));
  } catch (error) { return hubFailure(error); }
}
