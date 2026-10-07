/**
 * Schema do storage Nextcloud: assets (metadata/referência), storage_nodes (índice da árvore
 * existente) e client_storage_mappings. O binário NUNCA é guardado no banco.
 * Idempotente: pode rodar a cada bootstrap, depois das tabelas base.
 */

const ASSET_EXTRA_COLUMNS: Array<[string, string]> = [
  ["provider", "TEXT NOT NULL DEFAULT 'nextcloud'"],
  ["nextcloud_file_id", "TEXT NOT NULL DEFAULT ''"],
  ["nextcloud_path", "TEXT NOT NULL DEFAULT ''"],
  ["filename", "TEXT NOT NULL DEFAULT ''"],
  ["size_bytes", "BIGINT"],
  ["etag", "TEXT"],
  ["post_id", "TEXT"],
  ["preview_asset_id", "TEXT"],
  ["detached_at", "TEXT"],
  ["archived_at", "TEXT"],
  ["share_token", "TEXT"],
  ["share_expires_at", "TEXT"],
];

const NEW_TABLES = `
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS storage_nodes (
    id TEXT PRIMARY KEY,
    remote_file_id TEXT NOT NULL UNIQUE,
    remote_path TEXT NOT NULL,
    parent_remote_file_id TEXT,
    name TEXT NOT NULL,
    node_type TEXT NOT NULL CHECK (node_type IN ('file','directory')),
    mime_type TEXT,
    size_bytes BIGINT,
    etag TEXT,
    last_seen_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS client_storage_mappings (
    client_id TEXT PRIMARY KEY,
    storage_node_id TEXT NOT NULL REFERENCES storage_nodes(id)
  );
`;

const INDEXES = [
  "CREATE INDEX IF NOT EXISTS idx_storage_nodes_parent ON storage_nodes(parent_remote_file_id);",
  "CREATE INDEX IF NOT EXISTS idx_storage_nodes_path ON storage_nodes(remote_path);",
  "CREATE INDEX IF NOT EXISTS idx_assets_nextcloud_file ON assets(nextcloud_file_id);",
  "CREATE INDEX IF NOT EXISTS idx_assets_post ON assets(post_id);",
];

/** PostgreSQL (pool ou client). */
export async function initPgStorageSchema(pool: { query: (sql: string) => Promise<unknown> }) {
  await pool.query(NEW_TABLES);
  // Assets legados (Vercel Blob) deixam de ser obrigatórios.
  for (const stmt of [
    "ALTER TABLE assets ALTER COLUMN blob_url DROP NOT NULL;",
    "ALTER TABLE assets ALTER COLUMN pathname DROP NOT NULL;",
  ]) {
    try { await pool.query(stmt); } catch {}
  }
  for (const [name, def] of ASSET_EXTRA_COLUMNS) {
    try { await pool.query(`ALTER TABLE assets ADD COLUMN IF NOT EXISTS ${name} ${def};`); } catch {}
  }
  for (const idx of INDEXES) {
    try { await pool.query(idx); } catch {}
  }
}

/** SQLite (desenvolvimento local). */
export function initSqliteStorageSchema(db: any) {
  db.exec(NEW_TABLES);
  // SQLite não faz DROP NOT NULL: se a tabela legada está vazia, recria no formato novo.
  try {
    const cols = db.prepare("PRAGMA table_info(assets)").all() as Array<{ name: string; notnull: number }>;
    const legacy = cols.find((c) => c.name === "blob_url" && c.notnull === 1);
    if (legacy) {
      const row = db.prepare("SELECT COUNT(*) AS n FROM assets").get() as { n: number };
      if (Number(row.n) === 0) {
        db.exec(`DROP TABLE assets; CREATE TABLE assets (
          id TEXT PRIMARY KEY,
          work_unit_id TEXT REFERENCES work_units(id) ON DELETE CASCADE,
          task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
          blob_url TEXT, pathname TEXT, mime_type TEXT, original_filename TEXT,
          uploaded_by_id TEXT REFERENCES users(id),
          created_at TEXT NOT NULL
        );`);
      }
    }
  } catch {}
  for (const [name, def] of ASSET_EXTRA_COLUMNS) {
    try { db.exec(`ALTER TABLE assets ADD COLUMN ${name} ${def};`); } catch {}
  }
  for (const idx of INDEXES) {
    try { db.exec(idx); } catch {}
  }
}
