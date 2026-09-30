/** Entrega imagens persistidas pelo Studio sem permitir navegação de diretórios. */
import { NextResponse } from "next/server";
import { studioUploadsDirectory } from "@/lib/runtime-paths";
import fs from "node:fs/promises";
import path from "node:path";

const MIME_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/** Valida o nome gerado pelo servidor e devolve o arquivo com cache imutável. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;

  // A expressão aceita somente o formato criado no POST; separadores nunca passam.
  if (!/^\d+-[a-f0-9]{12}(?:[a-f0-9]{12})?\.(jpg|png|webp|gif)$/.test(filename)) {
    return new NextResponse("Arquivo não encontrado", { status: 404 });
  }

  const ext = path.extname(filename).toLowerCase();
  const contentType = MIME_MAP[ext] || "application/octet-stream";

  // Se estiver conectado ao Vercel Blob, tenta buscar do storage na nuvem primeiro
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { get } = await import("@vercel/blob");
      let result = null;
      try {
        result = await get(`uploads/${filename}`, { access: "private" });
      } catch {
        // Fallback se o blob foi gravado sem restrição privada
        result = await get(`uploads/${filename}`, { access: "public" });
      }

      if (result && result.statusCode === 200 && result.stream) {
        return new NextResponse(result.stream as any, {
          status: 200,
          headers: {
            "Content-Type": result.blob?.contentType || contentType,
            "Cache-Control": "public, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": "inline",
          },
        });
      }
    } catch (blobErr) {
      console.warn("[studio-blob] Falha ao recuperar blob, tentando disco local:", blobErr);
    }
  }

  const filePath = path.join(studioUploadsDirectory(), filename);
  try {
    const fileBuffer = await fs.readFile(filePath);
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    });
  } catch {
    // Arquivo ausente e erro de leitura são indistinguíveis para o visitante.
    return new NextResponse("Arquivo não encontrado", { status: 404 });
  }
}
