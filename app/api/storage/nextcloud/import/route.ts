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

    (request as any)._debugPublicationId = itemId;

    // 1. Valida existência da publicação (calendar_items)
    const pub = (await db
      .prepare("SELECT id, calendar_id, status FROM calendar_items WHERE id = ? AND deleted_at IS NULL")
      .get(itemId)) as { id: string; calendar_id: string; status: string } | undefined;

    if (!pub) {
      return NextResponse.json(
        { error: "Publicação não encontrada no calendário." },
        { status: 404 }
      );
    }

    // 2. Verifica se existe uma task canônica associada a esta publicação
    // (tasks com source_item_id = pub.id)
    const associatedTask = (await db
      .prepare("SELECT id, work_unit_id FROM tasks WHERE source_item_id = ? AND deleted_at IS NULL LIMIT 1")
      .get(itemId)) as { id: string; work_unit_id: string } | undefined;

    const validTaskId = associatedTask?.id || null;
    (request as any)._debugTaskId = validTaskId;
    const effectiveWorkUnitId = associatedTask?.work_unit_id || calendarId || pub.calendar_id || null;

    console.log("[ASSET IMPORT DEBUG]", {
      publicationId: pub.id,
      taskId: validTaskId,
      postId: pub.id,
      fileName: node.name,
      route: "/api/storage/nextcloud/import",
      hasCanonicalTask: Boolean(validTaskId),
    });

    // 3. Verifica se já existe um asset registrado para este remoteFileId
    let existingAsset = (await db
      .prepare("SELECT id FROM assets WHERE nextcloud_file_id = ? AND detached_at IS NULL")
      .get(node.remoteFileId)) as { id: string } | undefined;

    let assetId = existingAsset?.id;

    if (!assetId) {
      const assetInsertData = {
        nextcloudFileId: node.remoteFileId,
        nextcloudPath: node.path,
        filename: node.name,
        mimeType: node.mimeType,
        sizeBytes: node.size,
        etag: node.etag,
        workUnitId: effectiveWorkUnitId,
        taskId: validTaskId,
        postId: itemId,
        publicationId: itemId,
        uploadedById: user.id,
      };

      console.log("[ASSET INSERT DATA]", assetInsertData);

      const created = await createAsset(assetInsertData);
      assetId = created.id;
    } else {
      console.log("[ASSET UPDATE LINK]", {
        assetId,
        publicationId: itemId,
        taskId: validTaskId,
      });

      // Atualiza os vínculos do asset existente
      await db
        .prepare(
          `UPDATE assets
           SET post_id = ?, publication_id = ?, task_id = COALESCE(?, task_id), detached_at = NULL
           WHERE id = ?`
        )
        .run(itemId, itemId, validTaskId, assetId);
    }

    const assetViewUrl = `/api/assets/${assetId}/view`;

    // 4. Atualiza a publicação vinculada
    await db
      .prepare(
        `UPDATE calendar_items
         SET image_url = ?, status = CASE WHEN status = 'Ideia' THEN 'Produção' ELSE status END, updated_at = ?
         WHERE id = ?`
      )
      .run(assetViewUrl, new Date().toISOString(), itemId);

    // 5. Registra histórico/atividade
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
    const errorPayload = {
      message: error?.message || "Erro desconhecido",
      detail: error?.detail || null,
      constraint: error?.constraint || null,
      table: error?.table || null,
      column: error?.column || null,
      code: error?.code || null,
      publicationId: (request as any)?._debugPublicationId || null,
      resolvedTaskId: (request as any)?._debugTaskId || null,
      stack: error?.stack || null,
    };

    console.error("[NEXTCLOUD IMPORT FAILED]", errorPayload);

    return NextResponse.json(
      {
        error: error.message || "Erro ao importar arquivo do Nextcloud.",
        diagnostics: errorPayload,
      },
      { status: 500 }
    );
  }
}
