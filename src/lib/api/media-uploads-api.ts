import axios from "axios";
import { API_URL } from "./core";

export type MediaAssetSummary = {
  assetId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  logicalPath: string;
  visibility: "public" | "protected";
  url: string;
};

export type BrandManualDigest = {
  manual: { url: string; name: string; size: number; digestedAt: string; sampledPages: number };
  colors: Array<{ hex: string; frequency: number }>;
};

export async function uploadBrandManual(file: File): Promise<BrandManualDigest> {
  const form = new FormData();
  form.append("file", file);
  return (await axios.post(`${API_URL}/agency/brand-manual`, form)).data;
}

export async function getPostMediaAssets(ownerId: string): Promise<MediaAssetSummary[]> {
  const response = await axios.get(`${API_URL}/work-items/${ownerId}/assets`);
  return response.data.map((asset: any) => ({
    assetId: asset.id,
    originalName: asset.originalName,
    mimeType: asset.mimeType,
    sizeBytes: Number(asset.byteSize),
    checksum: asset.checksum || "",
    logicalPath: "",
    visibility: asset.category === "post_document" ? "protected" : "public",
    url: asset.url,
  }));
}

export async function uploadImage(
  base64: string,
  fileName: string,
  subfolder?: string,
  clientName?: string,
  postDate?: string,
  designerName?: string,
  clientId?: string,
  targetUserId?: string,
  ownerId?: string,
): Promise<string> {
  return (await axios.post(`${API_URL}/upload-base64`, {
    base64, fileName, subfolder, clientName, postDate, designerName,
    clientId, targetUserId, ownerId,
  })).data.url;
}

export async function uploadProfileImage(base64: string, fileName: string): Promise<{
  url: string;
  assetId: string;
  thumbnailUrl?: string | null;
  thumbnailAssetId?: string | null;
}> {
  return (await axios.post(`${API_URL}/upload-base64`, {
    base64, fileName, subfolder: "avatars",
  })).data;
}

export async function uploadPostImage(
  _base64: string,
  _fileName: string,
  _clientName: string,
  _postDate: string | undefined,
  _clientId: string,
  _postId: string,
): Promise<never> {
  throw new Error("Use o envio de arquivo do item de trabalho.");
}

export async function uploadAudio(
  base64: string,
  fileName: string,
  subfolder?: string,
  clientId?: string,
): Promise<string> {
  return (await axios.post(`${API_URL}/upload-audio`, {
    base64, fileName, subfolder, clientId,
  })).data.url;
}

export async function uploadMediaFile(
  file: File,
  _clientId: string,
  _postDate?: string,
  ownerId?: string,
  category = "media",
  itemIndex?: number,
): Promise<{ url: string; provider: string; assetId: string; logicalPath: string; checksum: string; visibility: "public" | "protected"; mirrorState: string }> {
  if (!ownerId) throw new Error("Salve o item de trabalho antes de enviar arquivos.");
  const form = new FormData();
  form.append("file", file);
  form.append("category", category);
  if (itemIndex != null) form.append("sortOrder", String(itemIndex));
  const response = await axios.post(`${API_URL}/work-items/${ownerId}/assets`, form);
  return {
    url: response.data.url,
    provider: "local",
    assetId: response.data.id,
    logicalPath: "",
    checksum: response.data.checksum || "",
    visibility: category.includes("document") ? "protected" : "public",
    mirrorState: "local",
  };
}
