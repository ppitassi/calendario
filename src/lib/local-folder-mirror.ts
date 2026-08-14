const DB_NAME = "content-planner-local-mirror";
const STORE = "handles";
const HANDLE_KEY = "public-directory";

export type MirrorAsset = {
  assetId: string;
  checksum: string;
  logicalPath: string;
  url: string;
};

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storedHandle(): Promise<any | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).get(HANDLE_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  }).finally(() => db.close());
}

async function saveHandle(handle: any) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(handle, HANDLE_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  db.close();
}

export function localFolderSupported() {
  return typeof window !== "undefined" && "showDirectoryPicker" in window && typeof indexedDB !== "undefined";
}

export function mirrorDeviceId() {
  const key = "content-planner-mirror-device";
  let id = localStorage.getItem(key);
  if (!id) {
    id = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

export async function selectPublicMirrorFolder() {
  if (!localFolderSupported()) throw new Error("Este navegador nao oferece acesso gravavel a pastas.");
  const handle = await (window as any).showDirectoryPicker({ id: "content-planner-public", mode: "readwrite" });
  await saveHandle(handle);
  return handle;
}

export async function mirrorPermission(request = false) {
  const handle = await storedHandle();
  if (!handle) return "missing" as const;
  const options = { mode: "readwrite" };
  let permission = await handle.queryPermission(options);
  if (permission !== "granted" && request) permission = await handle.requestPermission(options);
  return permission as "granted" | "denied" | "prompt";
}

async function sha256(blob: Blob) {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function receipt(asset: MirrorAsset, status: string, error?: string) {
  await fetch("/api/media/mirror-receipts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...asset, deviceId: mirrorDeviceId(), status, error }),
  });
}

export async function mirrorUploadedAsset(asset: MirrorAsset, source?: Blob) {
  const handle = await storedHandle();
  if (!handle || await mirrorPermission(true) !== "granted") {
    await receipt(asset, localFolderSupported() ? "pending" : "unavailable", "Pasta local nao conectada.");
    return { status: "pending" as const };
  }
  try {
    const blob: Blob = source ?? await fetch(asset.url).then((response) => {
      if (!response.ok) throw new Error(`Download ${response.status}`);
      return response.blob();
    });
    if (await sha256(blob) !== asset.checksum) throw new Error("Checksum local divergente.");
    const parts = asset.logicalPath.split("/").filter(Boolean);
    let directory = handle;
    for (const segment of parts.slice(0, -1)) directory = await directory.getDirectoryHandle(segment, { create: true });
    const fileHandle = await directory.getFileHandle(parts.at(-1), { create: true });
    const writer = await fileHandle.createWritable();
    await writer.write(blob);
    await writer.close();
    await receipt(asset, "synced");
    return { status: "synced" as const };
  } catch (error) {
    await receipt(asset, "failed", error instanceof Error ? error.message : "Falha ao gravar o arquivo.").catch(() => undefined);
    return { status: "failed" as const, error };
  }
}

export async function reconcileLocalMirror() {
  const response = await fetch(`/api/media/mirror-manifest?deviceId=${encodeURIComponent(mirrorDeviceId())}`);
  if (!response.ok) throw new Error("Nao foi possivel obter o manifesto local.");
  const payload = await response.json();
  const assets = (payload.assets || payload.data?.assets || []) as Array<MirrorAsset & { mirrorState: string }>;
  const pending = assets.filter((asset) => asset.mirrorState !== "synced");
  const results: Array<{ status: "pending" | "synced" | "failed"; error?: unknown }> = [];
  for (const asset of pending) results.push(await mirrorUploadedAsset(asset));
  return { total: pending.length, synced: results.filter((item) => item.status === "synced").length };
}
