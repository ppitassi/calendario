/** Regras de storage aplicadas no código (espelhadas no app do Nextcloud). */

import { StoragePolicyError, STORAGE_POLICY } from "../storage-provider";
import { getNextcloudClient } from "./client";
import { listNodes, statNode } from "./webdav";

/** Exclusão de arquivos é proibida para qualquer role. Existe só para falhar explicitamente. */
export function assertFileDeleteForbidden(): never {
  throw new StoragePolicyError("Exclusão de arquivos não é permitida.");
}

/** Única remoção permitida: pasta vazia. */
export async function deleteEmptyDirectory(path: string): Promise<void> {
  if (!STORAGE_POLICY.deleteEmptyDirectory) assertFileDeleteForbidden();
  const node = await statNode(path);
  if (!node) return;
  if (node.type !== "directory") assertFileDeleteForbidden();
  const children = await listNodes(path);
  if (children.length > 0) {
    throw new StoragePolicyError("Não é permitido excluir diretórios com arquivos.");
  }
  const res = await (await getNextcloudClient()).deleteDirectoryNode(path);
  if (!res.ok && res.status !== 404) throw new Error(`Falha ao remover pasta (${res.status}).`);
}
