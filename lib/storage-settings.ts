/**
 * Configuração do Nextcloud editável pelo modal de Desenvolvedor.
 * Fica na tabela app_settings; a senha é cifrada (AES-256-GCM) e nunca volta ao frontend.
 * Variáveis NEXTCLOUD_* continuam valendo como fallback quando nada foi salvo.
 */

import crypto from "node:crypto";
import { getDb } from "./db";

export type NextcloudSettings = {
  baseUrl: string;
  username: string;
  appPassword: string;
  storageRoot: string;
};

const KEY = "nextcloud";

function encKey(): Buffer {
  const seed = process.env.SETTINGS_ENCRYPTION_KEY || process.env.STUDIO_ADMIN_PASSWORD || process.env.DATABASE_URL || "dev-only-key";
  return crypto.createHash("sha256").update(seed).digest();
}

function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", encKey(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}

function decrypt(blob: string): string {
  const [iv, tag, data] = blob.split(".").map((p) => Buffer.from(p, "base64"));
  const d = crypto.createDecipheriv("aes-256-gcm", encKey(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString("utf8");
}

type Stored = { baseUrl: string; username: string; storageRoot: string; passwordEnc?: string };

async function readStored(): Promise<Stored | null> {
  try {
    const row = (await getDb().prepare("SELECT value FROM app_settings WHERE key = ?").get(KEY)) as { value: string } | undefined;
    return row ? (JSON.parse(row.value) as Stored) : null;
  } catch {
    return null;
  }
}

let cache: { at: number; value: NextcloudSettings | null } | null = null;

export function invalidateNextcloudSettings() {
  cache = null;
}

/** Banco primeiro, env como fallback. Cache curto para não consultar a cada request. */
export async function loadNextcloudSettings(): Promise<NextcloudSettings | null> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  const s = await readStored();
  let value: NextcloudSettings | null = null;
  if (s && s.baseUrl && s.username && s.passwordEnc) {
    try {
      value = { baseUrl: s.baseUrl, username: s.username, storageRoot: s.storageRoot || "/", appPassword: decrypt(s.passwordEnc) };
    } catch {
      value = null; // chave de cifra mudou: cai no env
    }
  }
  if (!value && process.env.NEXTCLOUD_URL && process.env.NEXTCLOUD_USERNAME && process.env.NEXTCLOUD_APP_PASSWORD) {
    value = {
      baseUrl: process.env.NEXTCLOUD_URL,
      username: process.env.NEXTCLOUD_USERNAME,
      appPassword: process.env.NEXTCLOUD_APP_PASSWORD,
      storageRoot: process.env.NEXTCLOUD_STORAGE_ROOT || "/",
    };
  }
  cache = { at: Date.now(), value };
  return value;
}

/** Versão segura para o frontend: sem a senha. */
export async function getPublicNextcloudSettings() {
  const stored = await readStored();
  const eff = await loadNextcloudSettings();
  return {
    baseUrl: stored?.baseUrl ?? eff?.baseUrl ?? "",
    username: stored?.username ?? eff?.username ?? "",
    storageRoot: stored?.storageRoot ?? eff?.storageRoot ?? "/",
    hasPassword: Boolean(stored?.passwordEnc || eff?.appPassword),
    source: stored ? "database" : eff ? "env" : "none",
  };
}

/** Salva; se `appPassword` vier vazio, mantém a senha já guardada. */
export async function saveNextcloudSettings(input: { baseUrl: string; username: string; storageRoot: string; appPassword?: string }) {
  const prev = await readStored();
  const passwordEnc = input.appPassword ? encrypt(input.appPassword) : prev?.passwordEnc;
  if (!passwordEnc) throw new Error("Informe o app password.");
  const value: Stored = {
    baseUrl: input.baseUrl.trim().replace(/\/+$/, ""),
    username: input.username.trim(),
    storageRoot: "/" + input.storageRoot.split("/").filter(Boolean).join("/"),
    passwordEnc,
  };
  await getDb()
    .prepare(
      `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .run(KEY, JSON.stringify(value), new Date().toISOString());
  invalidateNextcloudSettings();
}
