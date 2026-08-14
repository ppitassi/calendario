import sharp from "sharp";
import { createHash, randomBytes } from "crypto";
import { matchesFileSignature, storeAssetBuffer } from "../storage";

export function imageDimensions(buffer: Buffer, mime: string) {
  if (mime === "image/png" && buffer.length >= 24)
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  if (mime === "image/webp" && buffer.length >= 30) {
    const kind = buffer.subarray(12, 16).toString();
    if (kind === "VP8X")
      return {
        width: 1 + buffer.readUIntLE(24, 3),
        height: 1 + buffer.readUIntLE(27, 3),
      };
    if (kind === "VP8 ")
      return {
        width: buffer.readUInt16LE(26) & 0x3fff,
        height: buffer.readUInt16LE(28) & 0x3fff,
      };
  }
  if (mime === "image/jpeg") {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (length < 2) break;
      if (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      )
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        };
      offset += length + 2;
    }
  }
  return null;
}

export async function uploadBase64(
  data: any,
  audio = false,
) {
  const {
    base64,
    subfolder = audio ? "audio" : "profiles",
    fileName,
  } = data;
  if (!base64)
    throw new Error(audio ? "Nenhum áudio enviado" : "Nenhuma imagem enviada");
  const match = String(base64).match(
    /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\r\n]+)$/i,
  );
  if (!match) throw new Error("Arquivo base64 inválido.");
  const allowed = audio
    ? new Map([
      ["audio/mpeg", "mp3"],
      ["audio/wav", "wav"],
      ["audio/ogg", "ogg"],
      ["audio/webm", "webm"],
    ])
    : new Map([
      ["image/jpeg", "jpg"],
      ["image/png", "png"],
      ["image/webp", "webp"],
      ["image/svg+xml", "svg"],
    ]);
  const ext = allowed.get(match[1].toLowerCase());
  if (!ext) throw new Error("Tipo de arquivo não permitido.");
  const payload = match[2];
  let buffer = Buffer.from(payload, "base64");
  const limits: Record<string, number> = {
    avatars: 5,
    profiles: 5,
    logos: 10,
    branding: 10,
    posts: 25,
    audio: 25,
  };
  const maxBytes =
    (process.env.VERCEL
      ? Math.min(3, limits[String(subfolder)] || 10)
      : limits[String(subfolder)] || (audio ? 25 : 10)) *
    1024 *
    1024;
  if (!buffer.length || buffer.length > maxBytes)
    throw new Error("Arquivo vazio ou acima do limite permitido.");
  const inputMime = match[1].toLowerCase();
  const isSvg = inputMime === "image/svg+xml";
  if (isSvg) {
    if (!["logos", "branding"].includes(String(subfolder)))
      throw new Error("SVG permitido somente para logos.");
    const svg = buffer.toString("utf8");
    const unsafeSvg =
      !/<svg(?:\s|>)/i.test(svg) ||
      /<(?:script|foreignObject|iframe|object|embed)(?:\s|>)/i.test(svg) ||
      /<!DOCTYPE|<!ENTITY/i.test(svg) ||
      /\bon[a-z]+\s*=/i.test(svg) ||
      /(?:href|xlink:href)\s*=\s*["']\s*(?:https?:|\/\/|file:|javascript:)/i.test(svg);
    if (unsafeSvg) throw new Error("SVG contém conteúdo externo ou executável.");
  }
  const signatureOk = isSvg || matchesFileSignature(
    buffer.subarray(0, 32),
    inputMime,
  );
  if (!signatureOk)
    throw new Error("Conteúdo não corresponde ao tipo declarado.");
  if (!audio) {
    const dimensions = isSvg
      ? await sharp(buffer, { density: 192, failOn: "error" }).metadata()
      : imageDimensions(buffer, inputMime);
    if (!dimensions)
      throw new Error("Imagem corrompida ou formato nao suportado.");
    const minSide = ["avatars", "profiles", "logos", "branding"].includes(
      String(subfolder),
    )
      ? 32
      : 100;
    const width = Number(dimensions.width || 0);
    const height = Number(dimensions.height || 0);
    if (width < minSide || height < minSide)
      throw new Error("Imagem com dimensoes menores que o permitido.");
    if (
      width > 12000 ||
      height > 12000 ||
      width * height > 64_000_000
    )
      throw new Error("Imagem com dimensoes excessivas.");
    if (["avatars", "profiles"].includes(String(subfolder))) {
      buffer = await sharp(buffer, {
        limitInputPixels: 64_000_000,
        failOn: "error",
      })
        .rotate()
        .resize({
          width: 1024,
          height: 1024,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 84 })
        .toBuffer();
    } else if (["logos", "branding"].includes(String(subfolder))) {
      const pipeline = isSvg
        ? sharp(buffer, {
          density: 192,
          limitInputPixels: 64_000_000,
          failOn: "error",
        }).rotate()
        : sharp(buffer, {
          limitInputPixels: 64_000_000,
          failOn: "error",
        }).rotate();
      buffer =
        isSvg
          ? await pipeline.png({ compressionLevel: 9 }).toBuffer()
          : inputMime === "image/png"
          ? await pipeline.png({ compressionLevel: 9 }).toBuffer()
          : inputMime === "image/webp"
            ? await pipeline.webp({ quality: 92, alphaQuality: 100 }).toBuffer()
            : await pipeline.jpeg({ quality: 94 }).toBuffer();
    }
  }
  const folderAliases: Record<string, string> = {
    audio: "audio",
    profiles: "profiles",
    avatars: "profiles",
    logos: "client-logos",
    branding: "branding",
    posts: "posts",
  };
  const folder =
    folderAliases[String(subfolder)] || (audio ? "audio" : "profiles");
  const outputMime =
    isSvg
      ? "image/png"
      : !audio && ["avatars", "profiles"].includes(String(subfolder))
      ? "image/webp"
      : inputMime;
  const outputExt = outputMime === "image/webp"
    ? "webp"
    : outputMime === "image/png"
      ? "png"
      : ext;
  const cleanName = `${String(fileName || randomBytes(12).toString("hex")).replace(/[^a-zA-Z0-9._-]/g, "_")}.${outputExt}`;
  const stored = await storeAssetBuffer({
    buffer,
    folder,
    fileName: cleanName,
    mimeType: outputMime,
    requireRemote: audio,
  });
  let thumbnail: Awaited<ReturnType<typeof storeAssetBuffer>> | null = null;
  if (!audio && ["logos", "branding", "posts"].includes(String(subfolder))) {
    const thumbBuffer = await sharp(buffer, {
      limitInputPixels: 64_000_000,
      failOn: "error",
    })
      .rotate()
      .resize({
        width: 640,
        height: 640,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 78 })
      .toBuffer();
    thumbnail = await storeAssetBuffer({
      buffer: thumbBuffer,
      folder: `${folder}-thumbnails`,
      fileName: `${cleanName}.webp`,
      mimeType: "image/webp",
    });
  }
  const metadata = audio
    ? null
    : await sharp(buffer, { limitInputPixels: 64_000_000 }).metadata();
  return {
    ...stored,
    mimeType: outputMime,
    sizeBytes: buffer.length,
    width: metadata?.width || null,
    height: metadata?.height || null,
    checksum: createHash("sha256").update(buffer).digest("hex"),
    originalName: String(fileName || "asset"),
    thumbnail,
  };
}
