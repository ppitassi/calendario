/** Varre a árvore EXISTENTE via PROPFIND e indexa em storage_nodes (sem criar nada no Nextcloud). */

import crypto from "node:crypto";
import { getDb } from "../../db";
import { getNextcloudClient } from "./client";
import { listNodes, statNode } from "./webdav";

export async function scanNextcloudDirectoryTree(): Promise<{ nodes: number }> {
  const nc = await getNextcloudClient();
  const db = getDb();
  const root = await statNode(nc.config.storageRoot);
  if (!root) throw new Error(`NEXTCLOUD_STORAGE_ROOT não encontrado: ${nc.config.storageRoot}`);

  const now = new Date().toISOString();
  let count = 0;

  const upsert = async (n: {
    remoteFileId: string; path: string; parentFileId?: string; name: string;
    type: string; mimeType?: string; size?: number; etag?: string;
  }) => {
    await db
      .prepare(
        `INSERT INTO storage_nodes (id, remote_file_id, remote_path, parent_remote_file_id, name, node_type, mime_type, size_bytes, etag, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (remote_file_id) DO UPDATE SET
           remote_path = excluded.remote_path,
           parent_remote_file_id = excluded.parent_remote_file_id,
           name = excluded.name, node_type = excluded.node_type,
           mime_type = excluded.mime_type, size_bytes = excluded.size_bytes,
           etag = excluded.etag, last_seen_at = excluded.last_seen_at`
      )
      .run(
        crypto.randomUUID(), n.remoteFileId, n.path, n.parentFileId || null, n.name, n.type,
        n.mimeType || null, n.size ?? null, n.etag || null, now
      );
    count++;
  };

  await upsert({ ...root, parentFileId: undefined });

  // BFS sequencial por diretório (Depth: infinity costuma estar desativado no Nextcloud).
  const queue = [root.path];
  while (queue.length) {
    const dir = queue.shift()!;
    for (const child of await listNodes(dir)) {
      await upsert(child);
      if (child.type === "directory") queue.push(child.path);
    }
  }
  return { nodes: count };
}
