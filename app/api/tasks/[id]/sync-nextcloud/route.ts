import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { resolveClientDirectory } from "@/lib/storage-mapping";
import { listNodes } from "@/lib/storage/nextcloud/webdav";
import { createAsset } from "@/lib/assets";

/**
 * POST /api/tasks/[id]/sync-nextcloud
 * Escaneia a pasta do cliente no Nextcloud mapeada para este calendário/tarefa
 * e associa arquivos de imagem/vídeo que a equipe já salvou diretamente no Nextcloud
 * sem duplicar binários ou fazer uploads adicionais.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const resolvedParams = await params;
    const workUnitOrTaskId = resolvedParams.id;
    const body = await request.json().catch(() => ({}));
    const subtaskId = body.taskId ? String(body.taskId) : null;

    const db = getDb();

    // 1. Localiza a demanda mãe (calendário ou work_unit) e cliente
    let clientId: string | null = null;
    let calendarId: string | null = null;

    const cal = await db
      .prepare("SELECT id, client_id FROM calendars WHERE id = ?")
      .get(workUnitOrTaskId) as { id: string; client_id: string } | undefined;

    if (cal) {
      calendarId = cal.id;
      clientId = cal.client_id;
    } else {
      const wu = await db
        .prepare("SELECT id, client_id, source_id FROM work_units WHERE id = ?")
        .get(workUnitOrTaskId) as { id: string; client_id: string; source_id: string } | undefined;
      if (wu) {
        clientId = wu.client_id;
        calendarId = wu.source_id || wu.id;
      } else {
        // Pode ser um task direto
        const t = await db
          .prepare("SELECT id, client_id, work_unit_id FROM tasks WHERE id = ?")
          .get(workUnitOrTaskId) as { id: string; client_id: string; work_unit_id: string } | undefined;
        if (t) {
          clientId = t.client_id;
        }
      }
    }

    if (!clientId) {
      return NextResponse.json(
        { error: "Cliente não identificado para esta demanda." },
        { status: 400 }
      );
    }

    // 2. Resolve a pasta mapeada do cliente no Nextcloud
    const clientDir = await resolveClientDirectory(clientId);
    if (!clientDir) {
      return NextResponse.json(
        {
          error:
            "A pasta do cliente ainda não foi vinculada ao Nextcloud. Vincule a pasta em Configurações > Storage.",
          needsMapping: true,
        },
        { status: 404 }
      );
    }

    // 3. Lista nós da pasta do cliente (WebDAV PROPFIND)
    const remoteNodes = await listNodes(clientDir.path);
    const mediaNodes = remoteNodes.filter((n) => {
      if (n.type !== "file") return false;
      const lower = n.name.toLowerCase();
      const isImg = /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(lower);
      const isVid = /\.(mp4|mov|webm|m4v)$/i.test(lower);
      return isImg || isVid;
    });

    if (mediaNodes.length === 0) {
      return NextResponse.json({
        importedCount: 0,
        message: "Nenhum arquivo de imagem ou vídeo encontrado na pasta do cliente no Nextcloud.",
      });
    }

    // 4. Busca os itens de publicação do calendário
    const targetCalendarId = calendarId || workUnitOrTaskId;
    const items = await db
      .prepare(
        "SELECT id, title, date, image_url, type FROM calendar_items WHERE calendar_id = ? AND deleted_at IS NULL"
      )
      .all(targetCalendarId) as Array<{
        id: string;
        title: string;
        date: string;
        image_url: string | null;
        type: string;
      }>;

    let attachedCount = 0;
    const matchedFiles: string[] = [];

    // Helper para normalizar strings de comparação (remover acentos, espaços e caracteres especiais)
    const cleanStr = (s: string) =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");

    for (const node of mediaNodes) {
      // Cria/garante registro do asset em `assets` para termos o ID que gera /api/assets/[id]/view
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
          workUnitId: workUnitOrTaskId,
          taskId: subtaskId || undefined,
          uploadedById: user.id,
        });
        assetId = created.id;
      }

      const assetViewUrl = `/api/assets/${assetId}/view`;
      const fileNameClean = cleanStr(node.name);

      // Se temos uma subtask específica selecionada pelo designer
      if (subtaskId) {
        // Associa especificamente a esta subtask
        await db
          .prepare(
            `UPDATE calendar_items
             SET image_url = ?, updated_at = ?
             WHERE id = ?`
          )
          .run(assetViewUrl, new Date().toISOString(), subtaskId);

        await db
          .prepare("UPDATE assets SET task_id = ?, post_id = ? WHERE id = ?")
          .run(subtaskId, subtaskId, assetId);

        attachedCount++;
        matchedFiles.push(node.name);
        break; // associou o primeiro encontrado para a subtask aberta
      }

      // Se não tem subtask específica, tenta casar com os itens do calendário por título, data ou numeração
      let matchedItem: (typeof items)[0] | undefined = undefined;

      for (const it of items) {
        const titleClean = cleanStr(it.title || "");
        const dateClean = (it.date || "").replace(/-/g, "");

        if (
          (titleClean.length > 3 && fileNameClean.includes(titleClean)) ||
          (dateClean.length >= 6 && fileNameClean.includes(dateClean))
        ) {
          matchedItem = it;
          break;
        }
      }

      // Se casou com um item que ainda não tem imagem ou para atualizar
      if (matchedItem) {
        await db
          .prepare(
            `UPDATE calendar_items
             SET image_url = ?, updated_at = ?
             WHERE id = ?`
          )
          .run(assetViewUrl, new Date().toISOString(), matchedItem.id);

        await db
          .prepare("UPDATE assets SET post_id = ?, task_id = ? WHERE id = ?")
          .run(matchedItem.id, matchedItem.id, assetId);

        attachedCount++;
        matchedFiles.push(node.name);
      }
    }

    // Se nenhum casou por nome específico e temos itens sem imagem, vincula o primeiro disponível
    if (attachedCount === 0 && items.length > 0 && mediaNodes.length > 0) {
      const firstItemWithoutImg = items.find((i) => !i.image_url) || items[0];
      const firstNode = mediaNodes[0];

      let asset = (await db
        .prepare("SELECT id FROM assets WHERE nextcloud_file_id = ?")
        .get(firstNode.remoteFileId)) as { id: string } | undefined;

      let assetId = asset?.id;
      if (!assetId) {
        const created = await createAsset({
          nextcloudFileId: firstNode.remoteFileId,
          nextcloudPath: firstNode.path,
          filename: firstNode.name,
          mimeType: firstNode.mimeType,
          sizeBytes: firstNode.size,
          etag: firstNode.etag,
          workUnitId: workUnitOrTaskId,
          postId: firstItemWithoutImg.id,
          uploadedById: user.id,
        });
        assetId = created.id;
      }

      const viewUrl = `/api/assets/${assetId}/view`;
      await db
        .prepare("UPDATE calendar_items SET image_url = ? WHERE id = ?")
        .run(viewUrl, firstItemWithoutImg.id);

      attachedCount = 1;
      matchedFiles.push(firstNode.name);
    }

    return NextResponse.json({
      success: true,
      importedCount: attachedCount,
      totalFilesInFolder: mediaNodes.length,
      matchedFiles,
      message:
        attachedCount > 0
          ? `${attachedCount} arte(s) vinculada(s) com sucesso a partir do Nextcloud!`
          : `${mediaNodes.length} arquivo(s) encontrado(s) no Nextcloud. Nenhum novo vínculo foi necessário.`,
    });
  } catch (error: any) {
    console.error("POST /api/tasks/[id]/sync-nextcloud", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
