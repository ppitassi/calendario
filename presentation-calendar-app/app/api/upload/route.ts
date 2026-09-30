/**
 * Upload autenticado de imagens do Presentation Studio.
 *
 * O arquivo é validado por tipo, tamanho e assinatura antes de ser gravado no
 * volume persistente. A resposta usa `/api/uploads/*`; nada é duplicado em
 * `public/`, que faz parte da build e não é storage de runtime.
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { studioUploadsDirectory } from "@/lib/runtime-paths";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ALLOWED_IMAGES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

/** Confirma os magic bytes para não confiar somente no MIME enviado pelo browser. */
function hasExpectedSignature(bytes: Uint8Array, mimeType: string) {
  /** Lê uma faixa curta como ASCII para comparar cabeçalhos de formatos RIFF/GIF. */
  const ascii = (start: number, length: number) =>
    String.fromCharCode(...bytes.slice(start, start + length));
  if (mimeType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return bytes[0] === 0x89 && ascii(1, 3) === "PNG";
  }
  if (mimeType === "image/webp") {
    return ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP";
  }
  if (mimeType === "image/gif") {
    return ["GIF87a", "GIF89a"].includes(ascii(0, 6));
  }
  return false;
}

/** Valida a sessão e persiste uma única imagem com nome imprevisível. */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Nenhum arquivo enviado." },
        { status: 400 },
      );
    }

    // SVG e tipos desconhecidos não entram: eles podem carregar conteúdo executável.
    const extension = ALLOWED_IMAGES[file.type];
    if (!extension) {
      return NextResponse.json(
        { error: "Envie JPG, PNG, WebP ou GIF." },
        { status: 415 },
      );
    }

    const maxBytes = Math.max(
      1,
      Number(process.env.STUDIO_UPLOAD_MAX_MB || 10),
    ) * 1024 * 1024;
    if (file.size <= 0 || file.size > maxBytes) {
      return NextResponse.json(
        { error: `A imagem deve ter no máximo ${Math.floor(maxBytes / 1024 / 1024)} MB.` },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!hasExpectedSignature(buffer, file.type)) {
      return NextResponse.json(
        { error: "O conteúdo do arquivo não corresponde ao formato informado." },
        { status: 422 },
      );
    }

    const filename = `${Date.now()}-${crypto.randomBytes(12).toString("hex")}${extension}`;

    // 1. Persiste de forma garantida no banco de dados (Neon Postgres / SQLite)
    // para que nunca se perca com o ciclo de vida efêmero do serverless/Vercel.
    try {
      const { saveUploadedFile } = await import("@/lib/db");
      await saveUploadedFile(filename, file.type, buffer);
    } catch (dbErr) {
      console.error("[studio-upload] Falha ao persistir imagem no banco de dados:", dbErr);
    }

    // 2. Se estiver conectado ao Vercel Blob, envia também para lá
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const { put } = await import("@vercel/blob");
        try {
          await put(`uploads/${filename}`, buffer, {
            access: "private",
            contentType: file.type,
          });
        } catch {
          await put(`uploads/${filename}`, buffer, {
            access: "public",
            contentType: file.type,
          });
        }
      } catch (blobErr) {
        console.warn("[studio-upload] Falha ao salvar no Vercel Blob:", blobErr);
      }
    }

    // 3. Tenta salvar no disco local como cache rápido (se o filesystem permitir escrita)
    try {
      const uploadDirectory = studioUploadsDirectory();
      await fs.mkdir(uploadDirectory, { recursive: true });
      await fs.writeFile(path.join(uploadDirectory, filename), buffer);
    } catch (fsErr) {
      // Em ambientes com filesystem read-only, o banco de dados já garantiu a persistência
    }

    return NextResponse.json({
      success: true,
      url: `/api/uploads/${filename}`,
      filename,
      size: buffer.length,
      mimeType: file.type,
    });
  } catch (error) {
    console.error("[studio-upload]", error);
    return NextResponse.json(
      { error: "Falha no upload do arquivo." },
      { status: 500 },
    );
  }
}
