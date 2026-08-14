import axios from "axios";
import { auth } from "../auth";
import { ClientData, PostData, UserProfile } from "../../types";

export const API_URL = "/api";
axios.defaults.withCredentials = true;

export type ProductionGalleryFilters = {
  page?: number;
  pageSize?: number;
  search?: string;
  clientId?: string;
  month?: string;
  status?: string;
  members?: string[];
  format?: string;
};

export type ProductionGalleryResponse = {
  items: PostData[];
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  page: number;
  pageSize: number;
  clients: ClientData[];
  members: UserProfile[];
};

export type ProductionGalleryWireResponse = Partial<
  Omit<ProductionGalleryResponse, "items">
> & {
  items?: PostData[];
  error?: string;
  message?: string;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function apiErrorMessage(payload: unknown, fallback: string) {
  if (!isRecord(payload)) return fallback;
  return typeof payload.error === "string"
    ? payload.error
    : typeof payload.message === "string"
      ? payload.message
      : fallback;
}

export function notifyPostsUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("posts-updated"));
  }
}

export async function downloadPdf(
  endpoint: string,
  fileName = "planejamento.pdf",
): Promise<void> {
  try {
    const response = await axios.get(endpoint, { responseType: "blob" });
    const contentType = String(response.headers["content-type"] || "");
    if (contentType.includes("application/json")) {
      const payload = JSON.parse(await response.data.text());
      if (!payload.downloadUrl)
        throw new Error(payload.error || "URL do PDF não retornada.");
      const directLink = document.createElement("a");
      directLink.href = payload.downloadUrl;
      directLink.rel = "noopener";
      document.body.appendChild(directLink);
      directLink.click();
      directLink.remove();
      return;
    }
    const url = window.URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error: any) {
    let message = "Erro ao gerar PDF.";
    const data = error.response?.data;
    if (data instanceof Blob) {
      try {
        const parsed = JSON.parse(await data.text());
        message = parsed.error || message;
      } catch {}
    } else if (data?.error) {
      message = data.error;
    }
    throw new Error(message);
  }
}

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const requestUrl = String(error.config?.url || "");
      if (
        !requestUrl.endsWith("/auth/login") &&
        !requestUrl.endsWith("/auth/validate-token") &&
        !requestUrl.endsWith("/auth/activity")
      ) {
        auth.handleSessionExpired();
      }
    }
    return Promise.reject(error);
  },
);
