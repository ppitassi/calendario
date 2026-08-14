import { readFile } from 'fs/promises';
import path from 'path';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

const contentTypes: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
};

export async function GET(_request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await params;
  if (!parts?.length || parts.some(part => !part || part === '.' || part === '..' || part.includes('/') || part.includes('\\'))) {
    return new Response('Not found', { status: 404 });
  }
  const uploadsRoot = path.resolve(/* turbopackIgnore: true */
    process.env.UPLOAD_STORAGE_ROOT ||
    path.join(/* turbopackIgnore: true */ process.cwd(), 'server', 'uploads'),
  );
  const filePath = path.resolve(uploadsRoot, ...parts);
  const relativePath = path.relative(uploadsRoot, filePath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const file = await readFile(filePath);
    return new Response(file, {
      headers: {
        'Content-Type': contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
