/**
 * Cliente WebDAV/OCS do Nextcloud — SOMENTE servidor. Credenciais vêm de variáveis
 * de ambiente e jamais são serializadas para o frontend.
 *
 * Implementado sobre fetch (PROPFIND/PUT/OCS) para dar acesso a oc:fileid e evitar
 * dependência ESM extra no runtime da Vercel. Não expõe nenhuma operação de DELETE de
 * arquivo: apenas `deleteEmptyDirectory` (ver policies.ts).
 */

import { StoragePolicyError } from "../storage-provider";

export type NextcloudConfig = {
  baseUrl: string;
  username: string;
  appPassword: string;
  storageRoot: string; // caminho (relativo ao usuário) onde a árvore existente começa
};

import { loadNextcloudSettings } from "../../storage-settings";

let cached: { key: string; client: NextcloudClient } | null = null;

export async function getNextcloudConfig(): Promise<NextcloudConfig> {
  const s = await loadNextcloudSettings();
  if (!s || !s.baseUrl || !s.username || !s.appPassword) {
    throw new Error("Nextcloud não configurado. Use Configurações de Desenvolvedor ou as variáveis NEXTCLOUD_*.");
  }
  return {
    baseUrl: s.baseUrl.replace(/\/+$/, ""),
    username: s.username,
    appPassword: s.appPassword,
    storageRoot: normalizePath(s.storageRoot || "/"),
  };
}

export function normalizePath(p: string): string {
  const clean = "/" + String(p || "").split("/").filter(Boolean).join("/");
  return clean;
}

export function encodePath(p: string): string {
  return normalizePath(p).split("/").map(encodeURIComponent).join("/");
}

export class NextcloudClient {
  readonly config: NextcloudConfig;
  private readonly auth: string;

  constructor(config: NextcloudConfig) {
    this.config = config;
    this.auth = "Basic " + Buffer.from(`${config.username}:${config.appPassword}`).toString("base64");
  }

  get davBase(): string {
    return `${this.config.baseUrl}/remote.php/dav/files/${encodeURIComponent(this.config.username)}`;
  }

  davUrl(path: string): string {
    return this.davBase + (normalizePath(path) === "/" ? "" : encodePath(path));
  }

  /** Requisição autenticada genérica (PROPFIND, MKCOL, OCS...). */
  async request(method: string, url: string, init: { headers?: Record<string, string>; body?: string } = {}) {
    if (method.toUpperCase() === "DELETE" && !url.includes("/ocs/")) {
      // Barreira de código: DELETE de nó DAV só passa por deleteEmptyDirectory.
      throw new StoragePolicyError("DELETE de arquivos é proibido.");
    }
    return fetch(url, {
      method,
      headers: { Authorization: this.auth, ...(init.headers || {}) },
      body: init.body,
      cache: "no-store",
    });
  }

  /** Primitiva de remoção de PASTA. Só deve ser chamada por policies.deleteEmptyDirectory. */
  async deleteDirectoryNode(path: string) {
    return fetch(this.davUrl(path) + "/", {
      method: "DELETE",
      headers: { Authorization: this.auth },
      cache: "no-store",
    });
  }

  /** Chamada OCS (shares) com resposta JSON. */
  async ocs(method: string, path: string, form?: Record<string, string>) {
    const url = `${this.config.baseUrl}/ocs/v2.php${path}`;
    const res = await this.request(method, url, {
      headers: {
        "OCS-APIRequest": "true",
        Accept: "application/json",
        ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      },
      body: form ? new URLSearchParams(form).toString() : undefined,
    });
    if (!res.ok) throw new Error(`Nextcloud OCS ${method} ${path} falhou (${res.status}).`);
    const json = (await res.json()) as { ocs?: { data?: any } };
    return json.ocs?.data;
  }
}

/** Singleton server-only. */
export async function getNextcloudClient(): Promise<NextcloudClient> {
  const config = await getNextcloudConfig();
  const key = JSON.stringify(config);
  if (!cached || cached.key !== key) cached = { key, client: new NextcloudClient(config) };
  return cached.client;
}
