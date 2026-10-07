import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { mapClientDirectory } from "@/lib/storage-mapping";
import { nextcloudStorage } from "@/lib/storage/nextcloud/provider";

export const maxDuration = 300;

/** Admin: reindexa a árvore existente do Nextcloud (PROPFIND). */
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    await nextcloudStorage.scanDirectoryTree();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("POST /api/storage/scan", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** Admin: lista pastas indexadas (filtro ?q=) e mapeamentos atuais. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  const q = new URL(request.url).searchParams.get("q") || "";
  const db = getDb();
  const directories = await db
    .prepare("SELECT id, remote_path, name FROM storage_nodes WHERE node_type = 'directory' AND remote_path LIKE ? ORDER BY remote_path LIMIT 200")
    .all(`%${q}%`);
  const mappings = await db.prepare("SELECT client_id, storage_node_id FROM client_storage_mappings").all();
  return NextResponse.json({ directories, mappings });
}

/** Admin: mapeia cliente → pasta existente. */
export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    const { clientId, storageNodeId } = await request.json();
    if (!clientId || !storageNodeId) return NextResponse.json({ error: "Parâmetros obrigatórios." }, { status: 400 });
    await mapClientDirectory(String(clientId), String(storageNodeId));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
