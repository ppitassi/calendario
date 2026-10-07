/**
 * Contrato de storage e política imutável. O restante do app só conhece estas
 * abstrações; nada de WebDAV/Nextcloud vaza para telas ou rotas.
 */

import type { Asset } from "../task-types";

export const STORAGE_POLICY = {
  provider: "nextcloud",
  fileDelete: false,
  fileOverwrite: false,
  deleteNonEmptyDirectory: false,
  deleteEmptyDirectory: true,
  useExistingDirectoryTree: true,
  proxyLargeFilesThroughVercel: false,
} as const;

export class StoragePolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoragePolicyError";
  }
}

export type StorageNode = {
  remoteFileId: string;
  path: string;
  parentFileId?: string;
  name: string;
  type: "file" | "directory";
  mimeType?: string;
  size?: number;
  etag?: string;
};

export type StorageAsset = Asset;

export type PlaybackSource = {
  url: string;
  expiresAt?: string;
  mimeType?: string;
  filename: string;
};

export type AssetType = "image" | "video" | "document" | "master" | "other";

export type UploadContext = {
  clientId: string;
  workUnitId?: string;
  taskId?: string;
  assetType: AssetType;
  filename: string;
  mimeType?: string;
  sizeBytes?: number;
  userId: string;
};

/** Destino de upload direto browser → Nextcloud (a Vercel nunca recebe o binário). */
export type UploadTarget = {
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  folderPath: string;
  filename: string;
  shareId: string;
  expiresAt: string;
  /** Token assinado a devolver em confirmUpload (impede registrar caminhos arbitrários). */
  intent?: string;
};

export interface StorageProvider {
  listDirectory(path: string): Promise<StorageNode[]>;
  stat(path: string): Promise<StorageNode | null>;
  resolveAsset(assetId: string): Promise<StorageAsset>;
  getPlaybackSource(assetId: string, userId: string): Promise<PlaybackSource>;
  createUploadTarget(context: UploadContext): Promise<UploadTarget>;
  scanDirectoryTree(): Promise<void>;
}
