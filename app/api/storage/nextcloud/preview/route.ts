import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getNextcloudClient, normalizePath, encodePath } from "@/lib/storage/nextcloud/client";

/**
 * GET /api/storage/nextcloud/preview?path=/Clientes/Ativa/Artes/arte-01.png
 *
 * Stream do arquivo (thumbnail/imagem) autenticado do Nextcloud diretamente
 * para o browser para exibição no Finder modal sem expor credenciais ao client.
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return new Response("Não autorizado", { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const pathParam = searchParams.get("path");
    if (!pathParam) {
      return new Response("Caminho não informado", { status: 400 });
    }

    const cleanPath = normalizePath(pathParam);
    const nc = await getNextcloudClient();
    const url = nc.davUrl(cleanPath);

    // Faz streaming com Basic Auth do WebDAV
    const remoteRes = await nc.request("GET", url);

    if (!remoteRes.ok) {
      return new Response(`Erro ao obter arquivo: ${remoteRes.statusText}`, {
        status: remoteRes.status,
      });
    }

    const contentType = remoteRes.headers.get("content-type") || "application/octet-stream";
    const contentLength = remoteRes.headers.get("content-length");

    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", contentType);
    if (contentLength) {
      responseHeaders.set("Content-Length", contentLength);
    }
    responseHeaders.set("Cache-Control", "private, max-age=3600");

    return new Response(remoteRes.body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (err: any) {
    console.error("GET /api/storage/nextcloud/preview error:", err);
    return new Response(err.message || "Erro interno", { status: 500 });
  }
}
