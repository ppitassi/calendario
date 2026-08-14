import axios from "axios";
import { API_URL } from "./core";

export type MediaAssetSummary = { assetId: string; originalName: string; mimeType: string; sizeBytes: number; checksum: string; logicalPath: string; visibility: "public" | "protected"; url: string };

export type BrandManualDigest = {
  manual: { url: string; name: string; size: number; digestedAt: string; sampledPages: number };
  colors: Array<{ hex: string; frequency: number }>;
};

export async function uploadBrandManual(file: File): Promise<BrandManualDigest> {
  const form = new FormData();
  form.append("file", file);
  const response = await axios.post(`${API_URL}/agency/brand-manual`, form);
  return response.data;
}

export async function getPostMediaAssets(ownerId: string): Promise<MediaAssetSummary[]> {
  const response = await axios.get(`${API_URL}/media/assets`, { params: { ownerId } });
  return response.data;
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
  const res = await axios.post(`${API_URL}/upload-base64`, {
    base64,
    fileName,
    subfolder,
    clientName,
    postDate,
    designerName,
    clientId,
    targetUserId,
    ownerId,
  });
  return res.data.url;
}

export async function uploadProfileImage(
  base64: string,
  fileName: string,
): Promise<{
  url: string;
  assetId: string;
  thumbnailUrl?: string | null;
  thumbnailAssetId?: string | null;
}> {
  const res = await axios.post(`${API_URL}/upload-base64`, {
    base64,
    fileName,
    subfolder: "avatars",
  });
  return res.data;
}

export async function uploadPostImage(
  base64: string,
  fileName: string,
  clientName: string,
  postDate: string | undefined,
  clientId: string,
  postId: string,
): Promise<{
  url: string;
  assetId: string;
  thumbnailUrl?: string | null;
  thumbnailAssetId?: string | null;
}> {
  const res = await axios.post(`${API_URL}/upload-base64`, {
    base64,
    fileName,
    subfolder: "posts",
    clientName,
    postDate,
    clientId,
    ownerId: postId,
  });
  return res.data;
}

export async function uploadAudio(
  base64: string,
  fileName: string,
  subfolder?: string,
  clientId?: string,
): Promise<string> {
  const res = await axios.post(`${API_URL}/upload-audio`, {
    base64,
    fileName,
    subfolder,
    clientId,
  });
  return res.data.url;
}

export async function uploadMediaFile(
  file: File,
  clientId: string,
  postDate?: string,
  ownerId?: string,
  category = "media",
  itemIndex?: number,
): Promise<{ url: string; provider: string; assetId: string; logicalPath: string; checksum: string; visibility: "public" | "protected"; mirrorState: string }> {
  let initialized;
  try {
    initialized = await axios.post(`${API_URL}/uploads/media/init`, {
      clientId,
      postDate,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      ownerId,
      category,
      itemIndex,
    });
  } catch (error: any) {
    throw error;
  }
  const uploadUrl = String(
    initialized.data.uploadUrl || "/api/uploads/media",
  );
  const upload = await fetch(
    uploadUrl.startsWith("/api/") ? uploadUrl : initialized.data.uploadUrl,
    {
      method: "PUT",
      headers: {
        "Content-Type": file.type,
        "X-Requested-With": "XMLHttpRequest",
        "X-Upload-Intent-Id": initialized.data.intentId,
      },
      body: file,
    },
  );
  if (!upload.ok)
    throw new Error(`Falha ao persistir mídia (${upload.status}).`);
  const finalized = await axios.post(`${API_URL}/uploads/media/finalize`, {
    intentId: initialized.data.intentId,
  });
  return finalized.data;
}
