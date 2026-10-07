/** Mapeia cliente → pasta REAL já existente no Nextcloud (índice em storage_nodes). */

import { getDb } from "./db";

export async function mapClientDirectory(clientId: string, storageNodeId: string): Promise<void> {
  const node = (await getDb()
    .prepare("SELECT node_type FROM storage_nodes WHERE id = ?")
    .get(storageNodeId)) as { node_type: string } | undefined;
  if (!node) throw new Error("Pasta não encontrada no índice. Rode o scan da árvore.");
  if (node.node_type !== "directory") throw new Error("O mapeamento deve apontar para uma pasta.");
  await getDb()
    .prepare(
      `INSERT INTO client_storage_mappings (client_id, storage_node_id) VALUES (?, ?)
       ON CONFLICT (client_id) DO UPDATE SET storage_node_id = excluded.storage_node_id`
    )
    .run(clientId, storageNodeId);
}

export type ResolvedClientDirectory = { nodeId: string; remoteFileId: string; path: string };

export async function resolveClientDirectory(clientId: string): Promise<ResolvedClientDirectory | null> {
  const row = (await getDb()
    .prepare(
      `SELECT n.id, n.remote_file_id, n.remote_path
       FROM client_storage_mappings m JOIN storage_nodes n ON n.id = m.storage_node_id
       WHERE m.client_id = ?`
    )
    .get(clientId)) as { id: string; remote_file_id: string; remote_path: string } | undefined;
  return row ? { nodeId: row.id, remoteFileId: row.remote_file_id, path: row.remote_path } : null;
}
