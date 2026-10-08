/** PROPFIND, parsing e operações de leitura (stat/list) sobre o WebDAV do Nextcloud. */

import type { StorageNode } from "../storage-provider";
import { getNextcloudClient, normalizePath } from "./client";

const PROPFIND_BODY = `<?xml version="1.0"?>
<d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns" xmlns:nc="http://nextcloud.org/ns">
  <d:prop>
    <oc:fileid/><d:getcontentlength/><d:getcontenttype/><d:getetag/><d:resourcetype/><d:getlastmodified/>
  </d:prop>
</d:propfind>`;

function tag(block: string, name: string): string | undefined {
  const m = block.match(new RegExp(`<(?:\\w+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${name}>`));
  return m ? m[1].trim() : undefined;
}

function decodeXml(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&apos;/g, "'");
}

/** Converte a resposta multistatus em nós (path relativo à raiz do usuário). */
export function parseMultistatus(xml: string, username: string): StorageNode[] {
  const prefix = `/remote.php/dav/files/${username}`;
  const nodes: StorageNode[] = [];
  const re = /<(?:\w+:)?response>([\s\S]*?)<\/(?:\w+:)?response>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const block = m[1];
    const hrefRaw = tag(block, "href");
    if (!hrefRaw) continue;
    let href = decodeURIComponent(decodeXml(hrefRaw));
    const idx = href.indexOf(prefix);
    if (idx >= 0) href = href.slice(idx + prefix.length);
    const isDir = /<(?:\w+:)?collection\b/.test(block);
    const path = normalizePath(href);
    const fileId = tag(block, "fileid");
    if (!fileId) continue;
    const len = tag(block, "getcontentlength");
    const lastMod = tag(block, "getlastmodified");
    nodes.push({
      remoteFileId: fileId,
      path,
      name: path === "/" ? "/" : path.split("/").pop() || "",
      type: isDir ? "directory" : "file",
      mimeType: tag(block, "getcontenttype"),
      size: len ? Number(len) : undefined,
      etag: tag(block, "getetag") ? decodeXml(tag(block, "getetag")!).replace(/"/g, "") : undefined,
      lastModified: lastMod,
    });
  }
  return nodes;
}

async function propfind(path: string, depth: 0 | 1): Promise<StorageNode[] | null> {
  const nc = await getNextcloudClient();
  const res = await nc.request("PROPFIND", nc.davUrl(path), {
    headers: { Depth: String(depth), "Content-Type": "application/xml" },
    body: PROPFIND_BODY,
  });
  if (res.status === 404) return null;
  if (res.status !== 207) throw new Error(`PROPFIND ${path} falhou (${res.status}).`);
  return parseMultistatus(await res.text(), nc.config.username);
}

export async function statNode(path: string): Promise<StorageNode | null> {
  const nodes = await propfind(path, 0);
  return nodes && nodes[0] ? nodes[0] : null;
}

export async function listNodes(path: string): Promise<StorageNode[]> {
  const target = normalizePath(path);
  const nodes = (await propfind(target, 1)) || [];
  const self = nodes.find((n) => n.path === target);
  return nodes
    .filter((n) => n.path !== target)
    .map((n) => ({ ...n, parentFileId: self?.remoteFileId }));
}

/** Gera nome único sem sobrescrever: "arquivo.mp4" → "arquivo (2).mp4". */
export async function uniqueFilename(folder: string, filename: string): Promise<string> {
  const existing = new Set((await listNodes(folder)).map((n) => n.name.toLowerCase()));
  if (!existing.has(filename.toLowerCase())) return filename;
  const dot = filename.lastIndexOf(".");
  const base = dot > 0 ? filename.slice(0, dot) : filename;
  const ext = dot > 0 ? filename.slice(dot) : "";
  for (let i = 2; i < 10000; i++) {
    const candidate = `${base} (${i})${ext}`;
    if (!existing.has(candidate.toLowerCase())) return candidate;
  }
  return `${base} (${Date.now()})${ext}`;
}
