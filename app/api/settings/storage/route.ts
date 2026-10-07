import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPublicNextcloudSettings, loadNextcloudSettings, saveNextcloudSettings } from "@/lib/storage-settings";
import { NextcloudClient, normalizePath } from "@/lib/storage/nextcloud/client";

async function requireAdmin() {
  const user = await getCurrentUser();
  return user && user.role === "admin" ? user : null;
}

/** Configuração atual, sem a senha. */
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  return NextResponse.json({ settings: await getPublicNextcloudSettings() });
}

/** Salva (senha em branco = mantém a atual). */
export async function PUT(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  try {
    const b = await request.json();
    const baseUrl = String(b.baseUrl || "").trim();
    if (!/^https?:\/\//i.test(baseUrl) || !String(b.username || "").trim()) {
      return NextResponse.json({ error: "Informe uma URL http(s) e o usuário." }, { status: 400 });
    }
    await saveNextcloudSettings({
      baseUrl,
      username: String(b.username),
      storageRoot: String(b.storageRoot || "/"),
      appPassword: b.appPassword ? String(b.appPassword) : undefined,
    });
    return NextResponse.json({ success: true, settings: await getPublicNextcloudSettings() });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

/** Testa a conexão com os valores do formulário (sem salvar). */
export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  try {
    const b = await request.json();
    const saved = await loadNextcloudSettings();
    const cfg = {
      baseUrl: String(b.baseUrl || saved?.baseUrl || "").replace(/\/+$/, ""),
      username: String(b.username || saved?.username || ""),
      appPassword: String(b.appPassword || saved?.appPassword || ""),
      storageRoot: normalizePath(String(b.storageRoot || saved?.storageRoot || "/")),
    };
    if (!cfg.baseUrl || !cfg.username || !cfg.appPassword) {
      return NextResponse.json({ ok: false, message: "Preencha URL, usuário e app password." });
    }
    const nc = new NextcloudClient(cfg);
    const res = await nc.request("PROPFIND", nc.davUrl(cfg.storageRoot), { headers: { Depth: "0" } });
    if (res.status === 207) return NextResponse.json({ ok: true, message: "Conexão OK e pasta raiz encontrada." });
    if (res.status === 401) return NextResponse.json({ ok: false, message: "Credenciais recusadas (usuário ou app password)." });
    if (res.status === 404) return NextResponse.json({ ok: false, message: "Conectou, mas a pasta raiz não existe." });
    return NextResponse.json({ ok: false, message: `Resposta inesperada do servidor (${res.status}).` });
  } catch (error: any) {
    return NextResponse.json({ ok: false, message: `Não foi possível conectar: ${error.message}` });
  }
}
