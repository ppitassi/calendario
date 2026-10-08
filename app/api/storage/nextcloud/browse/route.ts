import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { resolveClientDirectory } from "@/lib/storage-mapping";
import { listNodes, statNode } from "@/lib/storage/nextcloud/webdav";
import { normalizePath } from "@/lib/storage/nextcloud/client";

/**
 * GET /api/storage/nextcloud/browse?path=/Clientes/Ativa&clientId=xyz
 *
 * Navega pela estrutura real do Nextcloud via WebDAV (PROPFIND).
 * Se nenhum path for informado, tenta resolver a pasta vinculada ao cliente,
 * ou a raiz do armazenamento do usuário.
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedPath = searchParams.get("path");
    const clientId = searchParams.get("clientId");

    let currentPath = requestedPath ? normalizePath(requestedPath) : "";
    let defaultClientPath: string | null = null;

    // Se clientId foi passado, busca a pasta configurada/mapeada
    if (clientId) {
      const clientDir = await resolveClientDirectory(clientId);
      if (clientDir?.path) {
        defaultClientPath = normalizePath(clientDir.path);
      }
    }

    // Se path não foi fornecido, usa a pasta do cliente ou raiz "/"
    if (!currentPath) {
      currentPath = defaultClientPath || "/";
    }

    // Executa PROPFIND na pasta atual
    let nodes = await listNodes(currentPath);

    // Se falhou ou pasta não encontrada e estávamos numa subpasta do cliente, tenta fallback
    if (!nodes && currentPath !== "/") {
      currentPath = "/";
      nodes = (await listNodes("/")) || [];
    }

    // Informações da pasta atual
    const currentStat = await statNode(currentPath);

    // Mapeamento e ordenação dos nós:
    // Pastas primeiro, depois arquivos alfabeticamente
    const items = (nodes || []).map((node) => {
      const ext = node.name.includes(".") ? node.name.split(".").pop()?.toLowerCase() || "" : "";
      const isImage = ["png", "jpg", "jpeg", "webp", "gif", "svg", "avif"].includes(ext);
      const isVideo = ["mp4", "mov", "webm", "m4v"].includes(ext);
      const isDoc = ["pdf", "psd", "ai", "doc", "docx", "txt"].includes(ext);

      return {
        id: node.remoteFileId,
        name: node.name,
        path: node.path,
        type: node.type,
        size: node.size || 0,
        mimeType: node.mimeType || "",
        extension: ext,
        isImage,
        isVideo,
        isDoc,
        lastModified: node.lastModified || "",
        etag: node.etag || "",
      };
    });

    items.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "directory" ? -1 : 1;
      }
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
    });

    return NextResponse.json({
      currentPath,
      currentName: currentStat?.name || (currentPath === "/" ? "Nextcloud" : currentPath.split("/").pop()),
      defaultClientPath,
      items,
    });
  } catch (error: any) {
    console.error("GET /api/storage/nextcloud/browse error:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao listar diretório do Nextcloud." },
      { status: 500 }
    );
  }
}
