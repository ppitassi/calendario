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

  // 1. Se estiver conectado ao Vercel Blob, redireciona diretamente para a CDN global
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { head } = await import("@vercel/blob");
      const blobInfo = await head(`uploads/${filename}`);
      if (blobInfo?.url) {
        return NextResponse.redirect(blobInfo.url, { status: 307 });
      }
    } catch (blobErr) {
      // Não interrompe: segue para o banco de dados
    }
  }

  // 2. Busca do banco de dados persistente (PostgreSQL / SQLite)
  try {
    const { getUploadedFile } = await import("@/lib/db");
    const file = await getUploadedFile(filename);
    if (file) {
      return new NextResponse(file.data as any, {
        status: 200,
        headers: {
          "Content-Type": file.mimeType || contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
          "X-Content-Type-Options": "nosniff",
          "Content-Disposition": "inline",
        },
      });
    }
  } catch (dbErr) {
    console.warn("[studio-uploads-db] Falha ao consultar arquivo no banco:", dbErr);
  }

  // 3. Fallback para disco local (instâncias persistentes ou dev local)
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
    return new NextResponse("Arquivo não encontrado", { status: 404 });
  }
}
