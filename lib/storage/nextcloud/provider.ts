/** Implementação Nextcloud do StorageProvider. O resto do app importa apenas `nextcloudStorage`. */

import { getAsset } from "../../assets";
import type { StorageAsset, StorageNode, StorageProvider, UploadContext } from "../storage-provider";
import { getPlaybackSource } from "./playback";
import { scanNextcloudDirectoryTree } from "./scan-tree";
import { createUploadTarget } from "./upload";
import { listNodes, statNode } from "./webdav";

export class NextcloudStorageProvider implements StorageProvider {
  listDirectory(path: string): Promise<StorageNode[]> {
    return listNodes(path);
  }

  stat(path: string): Promise<StorageNode | null> {
    return statNode(path);
  }

  async resolveAsset(assetId: string): Promise<StorageAsset> {
    const asset = await getAsset(assetId);
    if (!asset) throw new Error("Asset não encontrado.");
    return asset;
  }

  getPlaybackSource(assetId: string, userId: string) {
    return getPlaybackSource(assetId, userId);
  }

  createUploadTarget(context: UploadContext) {
    return createUploadTarget(context);
  }

  async scanDirectoryTree(): Promise<void> {
    await scanNextcloudDirectoryTree();
  }
}

export const nextcloudStorage: StorageProvider = new NextcloudStorageProvider();
