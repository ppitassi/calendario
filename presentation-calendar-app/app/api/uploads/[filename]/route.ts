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

  const filePath = path.join(studioUploadsDirectory(), filename);
  try {
    const fileBuffer = await fs.readFile(filePath);
    const contentType = MIME_MAP[path.extname(filename).toLowerCase()];
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
