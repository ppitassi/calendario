import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { statNode } from "@/lib/storage/nextcloud/webdav";
import { createAsset } from "@/lib/assets";
import { normalizePath } from "@/lib/storage/nextcloud/client";

/**
 * POST /api/storage/nextcloud/import
 * Body: { path: "/Clientes/Ativa/Artes/arte-01.png", itemId: "item_xyz", calendarId?: "cal_abc" }
 *
 * Registra o asset referenciando o arquivo existente no Nextcloud (sem duplicar binário),
 * vincula à publicação (calendar_items.image_url = /api/assets/[id]/view)
 * e retorna a URL pronta.
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const body = await request.json();
    const { path, itemId, calendarId } = body;

    if (!path || !itemId) {
      return NextResponse.json(
        { error: "Caminho do arquivo e ID da publicação são obrigatórios." },
        { status: 400 }
      );
    }

    const cleanPath = normalizePath(path);
    const node = await statNode(cleanPath);

    if (!node || node.type !== "file") {
      return NextResponse.json(
        { error: "Arquivo não encontrado no Nextcloud." },
        { status: 404 }
      );
    }

    const db = getDb();

    // 1. Verifica se já existe um asset registrado para este remoteFileId
    let existingAsset = (await db
      .prepare("SELECT id FROM assets WHERE nextcloud_file_id = ? AND detached_at IS NULL")
      .get(node.remoteFileId)) as { id: string } | undefined;

    let assetId = existingAsset?.id;

    if (!assetId) {
      const created = await createAsset({
        nextcloudFileId: node.remoteFileId,
        nextcloudPath: node.path,
        filename: node.name,
        mimeType: node.mimeType,
        sizeBytes: node.size,
        etag: node.etag,
        workUnitId: calendarId || undefined,
        taskId: itemId,
        uploadedById: user.id,
      });
      assetId = created.id;
    }

    const assetViewUrl = `/api/assets/${assetId}/view`;

    // 2. Atualiza a publicação vinculada
    await db
      .prepare(
        `UPDATE calendar_items
         SET image_url = ?, status = CASE WHEN status = 'Ideia' THEN 'Produção' ELSE status END, updated_at = ?
         WHERE id = ?`
      )
      .run(assetViewUrl, new Date().toISOString(), itemId);

    // 3. Atualiza referência em assets
    await db
      .prepare("UPDATE assets SET task_id = ?, post_id = ? WHERE id = ?")
      .run(itemId, itemId, assetId);

    // 4. Registra histórico/atividade
    try {
      await db
        .prepare(
          `INSERT INTO activity_events (id, entity_type, entity_id, actor_id, event_type, metadata, created_at)
           VALUES (?, ?, ?, ?, 'attachment_added', ?, ?)`
        )
        .run(
          crypto.randomUUID(),
          "calendar_item",
          itemId,
          user.id,
          JSON.stringify({ assetId, filename: node.name, source: "nextcloud_file_picker" }),
          new Date().toISOString()
        );
    } catch {}

    return NextResponse.json({
      success: true,
      assetId,
      imageUrl: assetViewUrl,
      filename: node.name,
      size: node.size,
    });
  } catch (error: any) {
    console.error("POST /api/storage/nextcloud/import error:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao importar arquivo do Nextcloud." },
      { status: 500 }
    );
  }
}
