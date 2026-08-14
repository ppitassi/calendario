import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, readdir, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import sharp from "sharp";
import { getContext } from "../../../../lib/api-core";
import { storeAssetBuffer } from "../../../../lib/storage";

export const runtime = "nodejs";
const run = promisify(execFile);
const MAX_PDF_BYTES = 25 * 1024 * 1024;

type ColorBucket = { count: number; r: number; g: number; b: number };

function hex({ r, g, b }: Pick<ColorBucket, "r" | "g" | "b">) {
  return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")).join("")}`;
}

function distance(a: ColorBucket, b: ColorBucket) {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

async function digestPalette(files: string[]) {
  const buckets = new Map<number, ColorBucket>();
  for (const file of files) {
    const { data, info } = await sharp(file)
      .resize({ width: 320, height: 320, fit: "inside", withoutEnlargement: true })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    for (let index = 0; index < data.length; index += info.channels) {
      const r = data[index], g = data[index + 1], b = data[index + 2];
      if (r > 247 && g > 247 && b > 247) continue;
      const key = (r >> 4) << 8 | (g >> 4) << 4 | (b >> 4);
      const bucket = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 };
      bucket.count += 1;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      buckets.set(key, bucket);
    }
  }
  const ranked = [...buckets.values()]
    .map((bucket) => ({ count: bucket.count, r: bucket.r / bucket.count, g: bucket.g / bucket.count, b: bucket.b / bucket.count }))
    .sort((a, b) => b.count - a.count);
  const selected: ColorBucket[] = [];
  const chromatic = ranked.filter((color) => {
    const max = Math.max(color.r, color.g, color.b), min = Math.min(color.r, color.g, color.b);
    return max > 0 && (max - min) / max >= 0.12;
  });
  for (const color of [...chromatic, ...ranked]) {
    if (selected.every((existing) => distance(existing, color) >= 42)) selected.push(color);
    if (selected.length === 10) break;
  }
  return selected.map((color) => ({ hex: hex(color), frequency: color.count }));
}

export async function POST(req: NextRequest) {
  const context = await getContext(req);
  if (!context.isAuthenticated) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!context.permissions.has("canManageBrandSystem")) return NextResponse.json({ error: "Permissão insuficiente." }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Envie um manual em PDF." }, { status: 400 });
  if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) return NextResponse.json({ error: "O manual precisa ser um PDF." }, { status: 415 });
  if (!file.size || file.size > MAX_PDF_BYTES) return NextResponse.json({ error: "O PDF deve ter no máximo 25 MB." }, { status: 413 });

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.subarray(0, 5).toString("ascii") !== "%PDF-") return NextResponse.json({ error: "PDF inválido ou corrompido." }, { status: 422 });

  const temp = await mkdtemp(path.join(os.tmpdir(), "brand-manual-"));
  try {
    const input = path.join(temp, "manual.pdf");
    await sharp({ create: { width: 1, height: 1, channels: 3, background: "white" } }).png().toFile(path.join(temp, ".ready.png"));
    await writeFile(input, buffer, { flag: "wx" });
    await run("pdftoppm", ["-png", "-f", "1", "-l", "16", "-scale-to", "900", input, path.join(temp, "page")], { timeout: 60_000, maxBuffer: 1024 * 1024 });
    const pages = (await readdir(temp)).filter((name) => /^page-.*\.png$/i.test(name)).sort().map((name) => path.join(temp, name));
    if (!pages.length) return NextResponse.json({ error: "Não foi possível renderizar o PDF." }, { status: 422 });
    const colors = await digestPalette(pages);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const stored = await storeAssetBuffer({ buffer, folder: "brand-manuals", fileName: safeName, mimeType: "application/pdf" });
    return NextResponse.json({
      manual: { url: stored.url, name: file.name, size: file.size, digestedAt: new Date().toISOString(), sampledPages: pages.length },
      colors,
    });
  } catch (error) {
    console.error("[brand-manual] digest failed", error);
    return NextResponse.json({ error: "Não foi possível digerir o manual da marca." }, { status: 422 });
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
