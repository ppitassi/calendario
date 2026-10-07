import type { Pool, PoolClient } from "pg";
import crypto from "node:crypto";
import { hashPassword } from "./db-normalize";
import { initPgStorageSchema, initSqliteStorageSchema } from "./storage-schema";

declare global {
  // eslint-disable-next-line no-var
  var __studioPgSchemaReady: boolean | undefined;
}

interface MigrationStep {
  version: string;
  name: string;
  run: (client: Pool | PoolClient) => Promise<void>;
}

const PG_MIGRATIONS: MigrationStep[] = [
  {
    version: "001_initial_tables",
    name: "Tabelas fundamentais e storage",
    run: async (pool) => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('admin', 'social_media', 'designer')),
          status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected')),
          password_reset_pending INTEGER DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
          token TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS clients (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          segment TEXT DEFAULT '',
          tone TEXT DEFAULT '',
          audience TEXT DEFAULT '',
          strategy TEXT DEFAULT '',
          accent TEXT DEFAULT '#ef5d3d',
          logo_url TEXT,
          has_multiple_profiles INTEGER DEFAULT 0,
          has_pre_calendar INTEGER DEFAULT 0,
          owner_id TEXT REFERENCES users(id),
          created_by_id TEXT NOT NULL REFERENCES users(id),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          profiles TEXT DEFAULT '',
          posting_days TEXT DEFAULT '[]'
        );

        CREATE TABLE IF NOT EXISTS calendars (
          id TEXT PRIMARY KEY,
          client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          month TEXT NOT NULL,
          brand TEXT NOT NULL,
          project TEXT NOT NULL,
          accent TEXT DEFAULT '#ef5d3d',
          strategy TEXT DEFAULT '',
          audience TEXT DEFAULT '',
          objective TEXT DEFAULT '',
          segment TEXT DEFAULT '',
          tone TEXT DEFAULT '',
          status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'sent_to_designer', 'in_production', 'sent_to_social_media', 'approved')),
          owner_id TEXT REFERENCES users(id),
          executor_id TEXT REFERENCES users(id),
          created_by_id TEXT NOT NULL REFERENCES users(id),
          assigned_to_id TEXT REFERENCES users(id),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          posting_days TEXT DEFAULT '[]'
        );

        CREATE TABLE IF NOT EXISTS calendar_items (
          id TEXT PRIMARY KEY,
          calendar_id TEXT NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
          date TEXT NOT NULL,
          title TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'Feed',
          status TEXT NOT NULL DEFAULT 'Ideia',
          channel TEXT DEFAULT 'Instagram',
          objective TEXT DEFAULT '',
          head TEXT DEFAULT '',
          subhead TEXT DEFAULT '',
          caption TEXT DEFAULT '',
          visual TEXT DEFAULT '',
          image_url TEXT DEFAULT '',
          cta TEXT DEFAULT '',
          hashtags TEXT DEFAULT '',
          funnel_stage TEXT DEFAULT 'Topo',
          internal_notes TEXT DEFAULT '',
          owner_id TEXT REFERENCES users(id),
          assignee_id TEXT REFERENCES users(id),
          created_by_id TEXT REFERENCES users(id),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          profile TEXT DEFAULT '',
          is_collab INTEGER DEFAULT 0,
          collab_profile TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS notifications (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          link TEXT DEFAULT '',
          is_read INTEGER DEFAULT 0,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS uploaded_files (
          filename TEXT PRIMARY KEY,
          mime_type TEXT NOT NULL,
          data TEXT NOT NULL,
          size_bytes INTEGER DEFAULT 0,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS work_units (
          id TEXT PRIMARY KEY,
          client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
          type TEXT NOT NULL CHECK (type IN ('calendar', 'extra_request', 'campaign', 'project')),
          source_id TEXT,
          title TEXT NOT NULL,
          description TEXT,
          owner_id TEXT REFERENCES users(id),
          executor_id TEXT REFERENCES users(id),
          assignee_id TEXT REFERENCES users(id),
          created_by_id TEXT REFERENCES users(id),
          priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
          status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'waiting', 'awaiting_approval', 'completed')),
          due_date TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT
        );

        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          work_unit_id TEXT REFERENCES work_units(id) ON DELETE CASCADE,
          client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
          owner_id TEXT REFERENCES users(id),
          assignee_id TEXT REFERENCES users(id),
          created_by_id TEXT REFERENCES users(id),
          title TEXT NOT NULL,
          description TEXT,
          type TEXT NOT NULL,
          position INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'waiting', 'awaiting_approval', 'completed')),
          due_date TEXT,
          source_item_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT
        );

        CREATE TABLE IF NOT EXISTS assets (
          id TEXT PRIMARY KEY,
          work_unit_id TEXT REFERENCES work_units(id) ON DELETE CASCADE,
          task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
          blob_url TEXT,
          pathname TEXT,
          mime_type TEXT,
          original_filename TEXT,
          uploaded_by_id TEXT REFERENCES users(id),
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS activity_events (
          id TEXT PRIMARY KEY,
          entity_type TEXT NOT NULL DEFAULT 'task',
          entity_id TEXT NOT NULL,
          task_id TEXT,
          actor_id TEXT NOT NULL REFERENCES users(id),
          event_type TEXT NOT NULL,
          field_name TEXT,
          old_value TEXT,
          new_value TEXT,
          metadata TEXT,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS task_events (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          actor_id TEXT NOT NULL REFERENCES users(id),
          event_type TEXT NOT NULL,
          field_name TEXT,
          old_value TEXT,
          new_value TEXT,
          metadata TEXT,
          created_at TEXT NOT NULL
        );

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
      `);
    },
  },
  {
    version: "002_columns_compatibility",
    name: "Colunas complementares e compatibilidade de legados",
    run: async (pool) => {
      const migrations = [
        { table: "clients", col: "owner_id", def: "TEXT" },
        { table: "clients", col: "profiles", def: "TEXT DEFAULT ''" },
        { table: "clients", col: "posting_days", def: "TEXT DEFAULT '[]'" },
        { table: "clients", col: "weekday_formats", def: "TEXT DEFAULT '{}'" },
        { table: "clients", col: "logo_url", def: "TEXT" },
        { table: "clients", col: "has_multiple_profiles", def: "INTEGER DEFAULT 0" },
        { table: "clients", col: "has_pre_calendar", def: "INTEGER DEFAULT 0" },
        { table: "clients", col: "tone", def: "TEXT DEFAULT ''" },
        { table: "clients", col: "audience", def: "TEXT DEFAULT ''" },
        { table: "clients", col: "strategy", def: "TEXT DEFAULT ''" },

        { table: "calendars", col: "owner_id", def: "TEXT" },
        { table: "calendars", col: "executor_id", def: "TEXT" },
        { table: "calendars", col: "deleted_at", def: "TEXT" },
        { table: "calendars", col: "posting_days", def: "TEXT DEFAULT '[]'" },
        { table: "calendars", col: "weekday_formats", def: "TEXT DEFAULT '{}'" },
        { table: "calendars", col: "share_token", def: "TEXT" },
        { table: "calendars", col: "client_feedback", def: "TEXT DEFAULT ''" },
        { table: "calendars", col: "client_feedback_status", def: "TEXT DEFAULT ''" },
        { table: "calendars", col: "client_feedback_at", def: "TEXT DEFAULT ''" },
        { table: "calendars", col: "is_pre_calendar", def: "INTEGER DEFAULT 0" },
        { table: "calendars", col: "segment", def: "TEXT DEFAULT ''" },
        { table: "calendars", col: "tone", def: "TEXT DEFAULT ''" },
        { table: "calendars", col: "audience", def: "TEXT DEFAULT ''" },

        { table: "calendar_items", col: "owner_id", def: "TEXT" },
        { table: "calendar_items", col: "assignee_id", def: "TEXT" },
        { table: "calendar_items", col: "created_by_id", def: "TEXT" },
        { table: "calendar_items", col: "deleted_at", def: "TEXT" },
        { table: "calendar_items", col: "profile", def: "TEXT DEFAULT ''" },
        { table: "calendar_items", col: "is_collab", def: "INTEGER DEFAULT 0" },
        { table: "calendar_items", col: "collab_profile", def: "TEXT DEFAULT ''" },
        { table: "calendar_items", col: "story_url", def: "TEXT DEFAULT ''" },
        { table: "calendar_items", col: "order_index", def: "INTEGER DEFAULT 0" },
        { table: "calendar_items", col: "client_comment", def: "TEXT DEFAULT ''" },
        { table: "calendar_items", col: "is_extra", def: "INTEGER DEFAULT 0" },
        { table: "calendar_items", col: "extra_format", def: "TEXT DEFAULT ''" },

        { table: "work_units", col: "owner_id", def: "TEXT" },
        { table: "work_units", col: "executor_id", def: "TEXT" },
        { table: "work_units", col: "assignee_id", def: "TEXT" },
        { table: "work_units", col: "created_by_id", def: "TEXT" },
        { table: "work_units", col: "deleted_at", def: "TEXT" },
        { table: "work_units", col: "description", def: "TEXT" },
        { table: "work_units", col: "priority", def: "TEXT DEFAULT 'normal'" },

        { table: "tasks", col: "owner_id", def: "TEXT" },
        { table: "tasks", col: "assignee_id", def: "TEXT" },
        { table: "tasks", col: "created_by_id", def: "TEXT" },
        { table: "tasks", col: "deleted_at", def: "TEXT" },
        { table: "tasks", col: "description", def: "TEXT" },
        { table: "tasks", col: "position", def: "INTEGER DEFAULT 0" },

        { table: "users", col: "password_reset_pending", def: "INTEGER DEFAULT 0" },

        { table: "assets", col: "provider", def: "TEXT NOT NULL DEFAULT 'nextcloud'" },
        { table: "assets", col: "nextcloud_file_id", def: "TEXT NOT NULL DEFAULT ''" },
        { table: "assets", col: "nextcloud_path", def: "TEXT NOT NULL DEFAULT ''" },
        { table: "assets", col: "filename", def: "TEXT NOT NULL DEFAULT ''" },
        { table: "assets", col: "size_bytes", def: "BIGINT" },
        { table: "assets", col: "etag", def: "TEXT" },
        { table: "assets", col: "post_id", def: "TEXT" },
        { table: "assets", col: "preview_asset_id", def: "TEXT" },
        { table: "assets", col: "detached_at", def: "TEXT" },
        { table: "assets", col: "archived_at", def: "TEXT" },
        { table: "assets", col: "share_token", def: "TEXT" },
        { table: "assets", col: "share_expires_at", def: "TEXT" },
      ];

      for (const { table, col, def } of migrations) {
        try {
          await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} ${def};`);
        } catch {}
      }

      // Assets legados (Vercel Blob) deixam de ser obrigatórios
      for (const stmt of [
        "ALTER TABLE assets ALTER COLUMN blob_url DROP NOT NULL;",
        "ALTER TABLE assets ALTER COLUMN pathname DROP NOT NULL;",
      ]) {
        try { await pool.query(stmt); } catch {}
      }
    },
  },
  {
    version: "003_data_backfills",
    name: "Preenchimento de dados e herança de ownership (executa uma única vez)",
    run: async (pool) => {
      const backfillUpdates = [
        "UPDATE clients SET owner_id = created_by_id WHERE (owner_id IS NULL OR owner_id = '');",
        "UPDATE calendars SET owner_id = (SELECT owner_id FROM clients WHERE clients.id = calendars.client_id) WHERE (owner_id IS NULL OR owner_id = '');",
        "UPDATE calendars SET owner_id = created_by_id WHERE (owner_id IS NULL OR owner_id = '');",
        "UPDATE calendars SET executor_id = assigned_to_id WHERE (executor_id IS NULL OR executor_id = '') AND assigned_to_id IS NOT NULL;",
        "UPDATE calendar_items SET owner_id = (SELECT owner_id FROM calendars WHERE calendars.id = calendar_items.calendar_id) WHERE (owner_id IS NULL OR owner_id = '');",
        "UPDATE calendar_items SET created_by_id = (SELECT created_by_id FROM calendars WHERE calendars.id = calendar_items.calendar_id) WHERE (created_by_id IS NULL OR created_by_id = '');",
        "UPDATE work_units SET owner_id = (SELECT owner_id FROM clients WHERE clients.id = work_units.client_id) WHERE (owner_id IS NULL OR owner_id = '');",
        "UPDATE tasks SET owner_id = (SELECT owner_id FROM clients WHERE clients.id = tasks.client_id) WHERE (owner_id IS NULL OR owner_id = '');",

        // Backfill de Artes Extras legadas (calendar_items onde is_extra = 1) para Work Units e Tasks canônicas
        `INSERT INTO work_units (id, client_id, type, source_id, title, description, owner_id, executor_id, priority, status, due_date, created_by_id, created_at, updated_at)
         SELECT 
           ('wu_extra_' || ci.id) AS id,
           c.id AS client_id,
           'extra_request' AS type,
           ci.id AS source_id,
           ci.title,
           ci.client_comment AS description,
           c.owner_id AS owner_id,
           ci.assignee_id AS executor_id,
           'normal' AS priority,
           CASE 
             WHEN ci.status IN ('Aprovado', 'approved', 'completed') THEN 'completed'
             WHEN ci.status IN ('Revisão', 'review', 'awaiting_approval') THEN 'awaiting_approval'
             WHEN ci.status IN ('Produção', 'in_progress', 'in_production') THEN 'in_progress'
             ELSE 'not_started'
           END AS status,
           ci.date AS due_date,
           COALESCE(ci.created_by_id, c.created_by_id) AS created_by_id,
           ci.created_at,
           ci.created_at AS updated_at
         FROM calendar_items ci
         JOIN calendars cal ON cal.id = ci.calendar_id
         JOIN clients c ON c.id = cal.client_id
         WHERE ci.is_extra = 1 AND ci.deleted_at IS NULL
         ON CONFLICT (id) DO NOTHING;`,

        `INSERT INTO tasks (id, work_unit_id, client_id, owner_id, assignee_id, created_by_id, title, description, type, position, status, due_date, source_item_id, created_at, updated_at)
         SELECT
           ('task_extra_' || ci.id) AS id,
           ('wu_extra_' || ci.id) AS work_unit_id,
           c.id AS client_id,
           c.owner_id AS owner_id,
           ci.assignee_id,
           COALESCE(ci.created_by_id, c.created_by_id) AS created_by_id,
           ci.title,
           ci.client_comment AS description,
           COALESCE(ci.extra_format, 'extra') AS type,
           0 AS position,
           CASE 
             WHEN ci.status IN ('Aprovado', 'approved', 'completed') THEN 'completed'
             WHEN ci.status IN ('Revisão', 'review', 'awaiting_approval') THEN 'awaiting_approval'
             WHEN ci.status IN ('Produção', 'in_progress', 'in_production') THEN 'in_progress'
             ELSE 'not_started'
           END AS status,
           ci.date AS due_date,
           ci.id AS source_item_id,
           ci.created_at,
           ci.created_at AS updated_at
         FROM calendar_items ci
         JOIN calendars cal ON cal.id = ci.calendar_id
         JOIN clients c ON c.id = cal.client_id
         WHERE ci.is_extra = 1 AND ci.deleted_at IS NULL
         ON CONFLICT (id) DO NOTHING;`
      ];

      for (const sql of backfillUpdates) {
        try {
          await pool.query(sql);
        } catch {}
      }
    },
  },
  {
    version: "004_performance_indexes",
    name: "Criação de índices para operações rápidas em grande escala",
    run: async (pool) => {
      const indexes = [
        "CREATE INDEX IF NOT EXISTS idx_tasks_work_unit ON tasks(work_unit_id);",
        "CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);",
        "CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);",
        "CREATE INDEX IF NOT EXISTS idx_tasks_assignee_status ON tasks(assignee_id, status);",
        "CREATE INDEX IF NOT EXISTS idx_tasks_owner ON tasks(owner_id);",
        "CREATE INDEX IF NOT EXISTS idx_tasks_client ON tasks(client_id);",
        "CREATE INDEX IF NOT EXISTS idx_tasks_deleted ON tasks(deleted_at);",

        "CREATE INDEX IF NOT EXISTS idx_work_units_client ON work_units(client_id);",
        "CREATE INDEX IF NOT EXISTS idx_work_units_type ON work_units(type);",
        "CREATE INDEX IF NOT EXISTS idx_work_units_executor ON work_units(executor_id);",
        "CREATE INDEX IF NOT EXISTS idx_work_units_deleted ON work_units(deleted_at);",

        "CREATE INDEX IF NOT EXISTS idx_assets_work_unit ON assets(work_unit_id);",
        "CREATE INDEX IF NOT EXISTS idx_assets_task ON assets(task_id);",
        "CREATE INDEX IF NOT EXISTS idx_assets_nextcloud_file ON assets(nextcloud_file_id);",
        "CREATE INDEX IF NOT EXISTS idx_assets_post ON assets(post_id);",

        "CREATE INDEX IF NOT EXISTS idx_activity_events_entity ON activity_events(entity_type, entity_id);",
        "CREATE INDEX IF NOT EXISTS idx_activity_events_task ON activity_events(task_id);",
        "CREATE INDEX IF NOT EXISTS idx_activity_events_actor ON activity_events(actor_id);",
        "CREATE INDEX IF NOT EXISTS idx_activity_events_created ON activity_events(created_at);",

        "CREATE INDEX IF NOT EXISTS idx_storage_nodes_parent ON storage_nodes(parent_remote_file_id);",
        "CREATE INDEX IF NOT EXISTS idx_storage_nodes_path ON storage_nodes(remote_path);",

        // Índices críticos para queries frequentes de clientes e calendários
        "CREATE INDEX IF NOT EXISTS idx_calendars_client ON calendars(client_id);",
        "CREATE INDEX IF NOT EXISTS idx_calendars_client_month ON calendars(client_id, month);",
        "CREATE INDEX IF NOT EXISTS idx_calendar_items_calendar ON calendar_items(calendar_id);",
        "CREATE INDEX IF NOT EXISTS idx_calendar_items_assignee ON calendar_items(assignee_id);",
        "CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);",
        "CREATE INDEX IF NOT EXISTS idx_sessions_token_expires ON sessions(token, expires_at);",
      ];

      for (const idxSql of indexes) {
        try {
          await pool.query(idxSql);
        } catch {}
      }
    },
  },
  {
    version: "005_admin_seed",
    name: "Provisionamento de usuário administrador inicial",
    run: async (pool) => {
      const checkAdmin = await pool.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1;");
      if (checkAdmin.rows.length === 0) {
        const adminPassword = String(process.env.STUDIO_ADMIN_PASSWORD || "").trim();
        if (adminPassword.length >= 12) {
          const adminUsername = String(process.env.STUDIO_ADMIN_USERNAME || "admin").trim().toLowerCase();
          const adminName = String(process.env.STUDIO_ADMIN_NAME || "Administrador").trim();
          const adminId = crypto.randomUUID();
          const now = new Date().toISOString();
          const adminHash = hashPassword(adminPassword);
          await pool.query(
            `INSERT INTO users (id, username, name, password_hash, role, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, 'admin', 'approved', $5, $6)
             ON CONFLICT (username) DO NOTHING;`,
            [adminId, adminUsername, adminName, adminHash, now, now]
          );
        }
      }
    },
  },
  {
    version: "006_calendar_reference_events",
    name: "Tabelas e constraints para datas e referências editoriais",
    run: async (pool) => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS calendar_reference_events (
          id TEXT PRIMARY KEY,
          canonical_key TEXT UNIQUE NOT NULL,
          title TEXT NOT NULL,
          description TEXT DEFAULT '',
          type TEXT NOT NULL,
          tags TEXT DEFAULT '[]',
          starts_on DATE NOT NULL,
          ends_on DATE NOT NULL,
          all_day INTEGER DEFAULT 1,
          country TEXT DEFAULT 'BR',
          state TEXT DEFAULT '',
          city_code TEXT DEFAULT '',
          scope TEXT DEFAULT 'country',
          verification_status TEXT DEFAULT 'verified',
          relevance TEXT DEFAULT 'official',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT valid_reference_period CHECK (ends_on > starts_on)
        );

        CREATE TABLE IF NOT EXISTS calendar_event_sources (
          id TEXT PRIMARY KEY,
          event_id TEXT NOT NULL REFERENCES calendar_reference_events(id) ON DELETE CASCADE,
          normalized_url TEXT NOT NULL,
          label TEXT NOT NULL,
          nature TEXT NOT NULL DEFAULT 'official',
          role TEXT NOT NULL DEFAULT 'evidence',
          is_primary INTEGER DEFAULT 1,
          publisher TEXT DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS publication_reference_events (
          id TEXT PRIMARY KEY,
          publication_id TEXT NOT NULL REFERENCES calendar_items(id) ON DELETE CASCADE,
          reference_event_id TEXT NOT NULL REFERENCES calendar_reference_events(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (publication_id, reference_event_id)
        );

        CREATE INDEX IF NOT EXISTS idx_reference_events_starts ON calendar_reference_events (starts_on);
        CREATE INDEX IF NOT EXISTS idx_reference_events_ends ON calendar_reference_events (ends_on);
        CREATE INDEX IF NOT EXISTS idx_event_sources_event ON calendar_event_sources (event_id);
      `);
    },
  },
  {
    version: "007_calendar_cycles",
    name: "Tabela de ciclos globais de entrega e relacionamento com calendários",
    run: async (pool) => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS calendar_cycles (
          id TEXT PRIMARY KEY,
          month TEXT UNIQUE NOT NULL,
          title TEXT NOT NULL,
          global_deadline TEXT NOT NULL,
          notes TEXT DEFAULT '',
          created_by_id TEXT REFERENCES users(id),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_calendar_cycles_month ON calendar_cycles (month);

        ALTER TABLE calendars ADD COLUMN IF NOT EXISTS cycle_id TEXT REFERENCES calendar_cycles(id);
      `);
    },
  },
];

/**
 * Inicialização otimizada para PostgreSQL com controle de versão via `schema_migrations`.
 * Executa uma única query rápida para validar a versão atual.
 * Se já migrado, não executa NENHUM DDL ou backfill, garantindo cold starts instantâneos.
 */
export async function initPgSchema(pool: Pool | PoolClient) {
  if (global.__studioPgSchemaReady) {
    return;
  }

  // 1. Garante que a tabela de controle de migrações existe
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(100) PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // 2. Consulta migrações já registradas
  const res = await pool.query("SELECT version FROM schema_migrations;");
  const applied = new Set(res.rows.map((r: { version: string }) => r.version));

  // Verifica se há alguma migração pendente
  const pending = PG_MIGRATIONS.filter((m) => !applied.has(m.version));
  if (pending.length === 0) {
    global.__studioPgSchemaReady = true;
    return;
  }

  // 3. Trava consultiva (advisory lock) do PostgreSQL para evitar concorrência entre instâncias
  // Número aleatório fixo único para este app
  const ADVISORY_LOCK_ID = 948271049;
  let lockAcquired = false;

  try {
    const lockRes = await pool.query("SELECT pg_try_advisory_lock($1) AS acquired;", [ADVISORY_LOCK_ID]);
    lockAcquired = Boolean(lockRes.rows[0]?.acquired);

    if (!lockAcquired) {
      // Outro processo está migrando agora; aguarda a liberação
      await pool.query("SELECT pg_advisory_lock($1);", [ADVISORY_LOCK_ID]);
      lockAcquired = true;
    }

    // Re-checa versões sob a trava
    const recheckRes = await pool.query("SELECT version FROM schema_migrations;");
    const recheckApplied = new Set(recheckRes.rows.map((r: { version: string }) => r.version));

    for (const migration of PG_MIGRATIONS) {
      if (!recheckApplied.has(migration.version)) {
        await migration.run(pool);
        await pool.query(
          "INSERT INTO schema_migrations (version, name, applied_at) VALUES ($1, $2, NOW()) ON CONFLICT (version) DO NOTHING;",
          [migration.version, migration.name]
        );
      }
    }

    global.__studioPgSchemaReady = true;
  } finally {
    if (lockAcquired) {
      try {
        await pool.query("SELECT pg_advisory_unlock($1);", [ADVISORY_LOCK_ID]);
      } catch {}
    }
  }
}

/** Inicialização de esquema e migrações para SQLite (desenvolvimento local) */
export function initSqliteSchema(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'social_media', 'designer')),
      status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected')),
      password_reset_pending INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      segment TEXT DEFAULT '',
      tone TEXT DEFAULT '',
      audience TEXT DEFAULT '',
      strategy TEXT DEFAULT '',
      accent TEXT DEFAULT '#ef5d3d',
      logo_url TEXT,
      has_multiple_profiles INTEGER DEFAULT 0,
      has_pre_calendar INTEGER DEFAULT 0,
      owner_id TEXT REFERENCES users(id),
      created_by_id TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      profiles TEXT DEFAULT '',
      posting_days TEXT DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS calendars (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      month TEXT NOT NULL,
      brand TEXT NOT NULL,
      project TEXT NOT NULL,
      accent TEXT DEFAULT '#ef5d3d',
      strategy TEXT DEFAULT '',
      audience TEXT DEFAULT '',
      objective TEXT DEFAULT '',
      segment TEXT DEFAULT '',
      tone TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'sent_to_designer', 'in_production', 'sent_to_social_media', 'approved')),
      owner_id TEXT REFERENCES users(id),
      executor_id TEXT REFERENCES users(id),
      created_by_id TEXT NOT NULL REFERENCES users(id),
      assigned_to_id TEXT REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      posting_days TEXT DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS calendar_items (
      id TEXT PRIMARY KEY,
      calendar_id TEXT NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'Feed',
      status TEXT NOT NULL DEFAULT 'Ideia',
      channel TEXT DEFAULT 'Instagram',
      objective TEXT DEFAULT '',
      head TEXT DEFAULT '',
      subhead TEXT DEFAULT '',
      caption TEXT DEFAULT '',
      visual TEXT DEFAULT '',
      image_url TEXT DEFAULT '',
      cta TEXT DEFAULT '',
      hashtags TEXT DEFAULT '',
      funnel_stage TEXT DEFAULT 'Topo',
      internal_notes TEXT DEFAULT '',
      owner_id TEXT REFERENCES users(id),
      assignee_id TEXT REFERENCES users(id),
      created_by_id TEXT REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      profile TEXT DEFAULT '',
      is_collab INTEGER DEFAULT 0,
      collab_profile TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      link TEXT DEFAULT '',
      is_read INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS uploaded_files (
      filename TEXT PRIMARY KEY,
      mime_type TEXT NOT NULL,
      data TEXT NOT NULL,
      size_bytes INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS work_units (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('calendar', 'extra_request', 'campaign', 'project')),
      source_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      owner_id TEXT REFERENCES users(id),
      executor_id TEXT REFERENCES users(id),
      assignee_id TEXT REFERENCES users(id),
      created_by_id TEXT REFERENCES users(id),
      priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
      status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'waiting', 'awaiting_approval', 'completed')),
      due_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      work_unit_id TEXT REFERENCES work_units(id) ON DELETE CASCADE,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      owner_id TEXT REFERENCES users(id),
      assignee_id TEXT REFERENCES users(id),
      created_by_id TEXT REFERENCES users(id),
      title TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'waiting', 'awaiting_approval', 'completed')),
      due_date TEXT,
      source_item_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      work_unit_id TEXT REFERENCES work_units(id) ON DELETE CASCADE,
      task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
      blob_url TEXT,
      pathname TEXT,
      mime_type TEXT,
      original_filename TEXT,
      uploaded_by_id TEXT REFERENCES users(id),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity_events (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL DEFAULT 'task',
      entity_id TEXT NOT NULL,
      task_id TEXT,
      actor_id TEXT NOT NULL REFERENCES users(id),
      event_type TEXT NOT NULL,
      field_name TEXT,
      old_value TEXT,
      new_value TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_events (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      actor_id TEXT NOT NULL REFERENCES users(id),
      event_type TEXT NOT NULL,
      field_name TEXT,
      old_value TEXT,
      new_value TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS calendar_reference_events (
      id TEXT PRIMARY KEY,
      canonical_key TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      type TEXT NOT NULL,
      tags TEXT DEFAULT '[]',
      starts_on TEXT NOT NULL,
      ends_on TEXT NOT NULL,
      all_day INTEGER DEFAULT 1,
      country TEXT DEFAULT 'BR',
      state TEXT DEFAULT '',
      city_code TEXT DEFAULT '',
      scope TEXT DEFAULT 'country',
      verification_status TEXT DEFAULT 'verified',
      relevance TEXT DEFAULT 'official',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS calendar_event_sources (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES calendar_reference_events(id) ON DELETE CASCADE,
      normalized_url TEXT NOT NULL,
      label TEXT NOT NULL,
      nature TEXT NOT NULL DEFAULT 'official',
      role TEXT NOT NULL DEFAULT 'evidence',
      is_primary INTEGER DEFAULT 1,
      publisher TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS publication_reference_events (
      id TEXT PRIMARY KEY,
      publication_id TEXT NOT NULL REFERENCES calendar_items(id) ON DELETE CASCADE,
      reference_event_id TEXT NOT NULL REFERENCES calendar_reference_events(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      UNIQUE (publication_id, reference_event_id)
    );

    CREATE TABLE IF NOT EXISTS calendar_cycles (
      id TEXT PRIMARY KEY,
      month TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      global_deadline TEXT NOT NULL,
      notes TEXT DEFAULT '',
      created_by_id TEXT REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_calendar_cycles_month ON calendar_cycles (month);
  `);

  const sqliteMigrations = [
    { table: "calendars", col: "cycle_id", def: "TEXT" },
    { table: "clients", col: "owner_id", def: "TEXT" },
    { table: "clients", col: "profiles", def: "TEXT DEFAULT ''" },
    { table: "clients", col: "posting_days", def: "TEXT DEFAULT '[]'" },
    { table: "clients", col: "weekday_formats", def: "TEXT DEFAULT '{}'" },
    { table: "clients", col: "logo_url", def: "TEXT" },
    { table: "clients", col: "has_multiple_profiles", def: "INTEGER DEFAULT 0" },
    { table: "clients", col: "has_pre_calendar", def: "INTEGER DEFAULT 0" },
    { table: "clients", col: "tone", def: "TEXT DEFAULT ''" },
    { table: "clients", col: "audience", def: "TEXT DEFAULT ''" },
    { table: "clients", col: "strategy", def: "TEXT DEFAULT ''" },

    { table: "calendars", col: "owner_id", def: "TEXT" },
    { table: "calendars", col: "executor_id", def: "TEXT" },
    { table: "calendars", col: "deleted_at", def: "TEXT" },
    { table: "calendars", col: "posting_days", def: "TEXT DEFAULT '[]'" },
    { table: "calendars", col: "weekday_formats", def: "TEXT DEFAULT '{}'" },
    { table: "calendars", col: "share_token", def: "TEXT" },
    { table: "calendars", col: "client_feedback", def: "TEXT DEFAULT ''" },
    { table: "calendars", col: "client_feedback_status", def: "TEXT DEFAULT ''" },
    { table: "calendars", col: "client_feedback_at", def: "TEXT DEFAULT ''" },
    { table: "calendars", col: "is_pre_calendar", def: "INTEGER DEFAULT 0" },
    { table: "calendars", col: "segment", def: "TEXT DEFAULT ''" },
    { table: "calendars", col: "tone", def: "TEXT DEFAULT ''" },
    { table: "calendars", col: "audience", def: "TEXT DEFAULT ''" },

    { table: "calendar_items", col: "owner_id", def: "TEXT" },
    { table: "calendar_items", col: "assignee_id", def: "TEXT" },
    { table: "calendar_items", col: "created_by_id", def: "TEXT" },
    { table: "calendar_items", col: "deleted_at", def: "TEXT" },
    { table: "calendar_items", col: "profile", def: "TEXT DEFAULT ''" },
    { table: "calendar_items", col: "is_collab", def: "INTEGER DEFAULT 0" },
    { table: "calendar_items", col: "collab_profile", def: "TEXT DEFAULT ''" },
    { table: "calendar_items", col: "story_url", def: "TEXT DEFAULT ''" },
    { table: "calendar_items", col: "order_index", def: "INTEGER DEFAULT 0" },
    { table: "calendar_items", col: "client_comment", def: "TEXT DEFAULT ''" },
    { table: "calendar_items", col: "is_extra", def: "INTEGER DEFAULT 0" },
    { table: "calendar_items", col: "extra_format", def: "TEXT DEFAULT ''" },

    { table: "work_units", col: "owner_id", def: "TEXT" },
    { table: "work_units", col: "executor_id", def: "TEXT" },
    { table: "work_units", col: "assignee_id", def: "TEXT" },
    { table: "work_units", col: "created_by_id", def: "TEXT" },
    { table: "work_units", col: "deleted_at", def: "TEXT" },
    { table: "work_units", col: "description", def: "TEXT" },
    { table: "work_units", col: "priority", def: "TEXT DEFAULT 'normal'" },

    { table: "tasks", col: "owner_id", def: "TEXT" },
    { table: "tasks", col: "assignee_id", def: "TEXT" },
    { table: "tasks", col: "created_by_id", def: "TEXT" },
    { table: "tasks", col: "deleted_at", def: "TEXT" },
    { table: "tasks", col: "description", def: "TEXT" },
    { table: "tasks", col: "position", def: "INTEGER DEFAULT 0" },

    { table: "users", col: "password_reset_pending", def: "INTEGER DEFAULT 0" },
  ];

  for (const { table, col, def } of sqliteMigrations) {
    try {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
      if (!cols.some((c: any) => c.name === col)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
      }
    } catch {}
  }

  const sqliteBackfill = [
    "UPDATE clients SET owner_id = created_by_id WHERE (owner_id IS NULL OR owner_id = '');",
    "UPDATE calendars SET owner_id = (SELECT owner_id FROM clients WHERE clients.id = calendars.client_id) WHERE (owner_id IS NULL OR owner_id = '');",
    "UPDATE calendars SET owner_id = created_by_id WHERE (owner_id IS NULL OR owner_id = '');",
    "UPDATE calendars SET executor_id = assigned_to_id WHERE (executor_id IS NULL OR executor_id = '') AND assigned_to_id IS NOT NULL;",
    "UPDATE calendar_items SET owner_id = (SELECT owner_id FROM calendars WHERE calendars.id = calendar_items.calendar_id) WHERE (owner_id IS NULL OR owner_id = '');",
    "UPDATE calendar_items SET created_by_id = (SELECT created_by_id FROM calendars WHERE calendars.id = calendar_items.calendar_id) WHERE (created_by_id IS NULL OR created_by_id = '');",
    "UPDATE work_units SET owner_id = (SELECT owner_id FROM clients WHERE clients.id = work_units.client_id) WHERE (owner_id IS NULL OR owner_id = '');",
    "UPDATE tasks SET owner_id = (SELECT owner_id FROM clients WHERE clients.id = tasks.client_id) WHERE (owner_id IS NULL OR owner_id = '');",

    `INSERT OR IGNORE INTO work_units (id, client_id, type, source_id, title, description, owner_id, executor_id, priority, status, due_date, created_by_id, created_at, updated_at)
     SELECT 
       ('wu_extra_' || ci.id) AS id,
       c.id AS client_id,
       'extra_request' AS type,
       ci.id AS source_id,
       ci.title,
       ci.client_comment AS description,
       c.owner_id AS owner_id,
       ci.assignee_id AS executor_id,
       'normal' AS priority,
       CASE 
         WHEN ci.status IN ('Aprovado', 'approved', 'completed') THEN 'completed'
         WHEN ci.status IN ('Revisão', 'review', 'awaiting_approval') THEN 'awaiting_approval'
         WHEN ci.status IN ('Produção', 'in_progress', 'in_production') THEN 'in_progress'
         ELSE 'not_started'
       END AS status,
       ci.date AS due_date,
       COALESCE(ci.created_by_id, c.created_by_id) AS created_by_id,
       ci.created_at,
       ci.created_at AS updated_at
     FROM calendar_items ci
     JOIN calendars cal ON cal.id = ci.calendar_id
     JOIN clients c ON c.id = cal.client_id
     WHERE ci.is_extra = 1 AND (ci.deleted_at IS NULL);`,

    `INSERT OR IGNORE INTO tasks (id, work_unit_id, client_id, owner_id, assignee_id, created_by_id, title, description, type, position, status, due_date, source_item_id, created_at, updated_at)
     SELECT
       ('task_extra_' || ci.id) AS id,
       ('wu_extra_' || ci.id) AS work_unit_id,
       c.id AS client_id,
       c.owner_id AS owner_id,
       ci.assignee_id,
       COALESCE(ci.created_by_id, c.created_by_id) AS created_by_id,
       ci.title,
       ci.client_comment AS description,
       COALESCE(ci.extra_format, 'extra') AS type,
       0 AS position,
       CASE 
         WHEN ci.status IN ('Aprovado', 'approved', 'completed') THEN 'completed'
         WHEN ci.status IN ('Revisão', 'review', 'awaiting_approval') THEN 'awaiting_approval'
         WHEN ci.status IN ('Produção', 'in_progress', 'in_production') THEN 'in_progress'
         ELSE 'not_started'
       END AS status,
       ci.date AS due_date,
       ci.id AS source_item_id,
       ci.created_at,
       ci.created_at AS updated_at
     FROM calendar_items ci
     JOIN calendars cal ON cal.id = ci.calendar_id
     JOIN clients c ON c.id = cal.client_id
     WHERE ci.is_extra = 1 AND (ci.deleted_at IS NULL);`
  ];

  for (const sql of sqliteBackfill) {
    try {
      db.exec(sql);
    } catch {}
  }

  const sqliteIndexes = [
    "CREATE INDEX IF NOT EXISTS idx_tasks_work_unit ON tasks(work_unit_id);",
    "CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);",
    "CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);",
    "CREATE INDEX IF NOT EXISTS idx_tasks_assignee_status ON tasks(assignee_id, status);",
    "CREATE INDEX IF NOT EXISTS idx_tasks_owner ON tasks(owner_id);",
    "CREATE INDEX IF NOT EXISTS idx_tasks_client ON tasks(client_id);",
    "CREATE INDEX IF NOT EXISTS idx_tasks_deleted ON tasks(deleted_at);",
    "CREATE INDEX IF NOT EXISTS idx_work_units_client ON work_units(client_id);",
    "CREATE INDEX IF NOT EXISTS idx_work_units_type ON work_units(type);",
    "CREATE INDEX IF NOT EXISTS idx_work_units_executor ON work_units(executor_id);",
    "CREATE INDEX IF NOT EXISTS idx_work_units_deleted ON work_units(deleted_at);",
    "CREATE INDEX IF NOT EXISTS idx_assets_work_unit ON assets(work_unit_id);",
    "CREATE INDEX IF NOT EXISTS idx_assets_task ON assets(task_id);",
    "CREATE INDEX IF NOT EXISTS idx_activity_events_entity ON activity_events(entity_type, entity_id);",
    "CREATE INDEX IF NOT EXISTS idx_activity_events_task ON activity_events(task_id);",
    "CREATE INDEX IF NOT EXISTS idx_activity_events_actor ON activity_events(actor_id);",
    "CREATE INDEX IF NOT EXISTS idx_activity_events_created ON activity_events(created_at);",
    "CREATE INDEX IF NOT EXISTS idx_calendars_client ON calendars(client_id);",
    "CREATE INDEX IF NOT EXISTS idx_calendars_client_month ON calendars(client_id, month);",
    "CREATE INDEX IF NOT EXISTS idx_calendar_items_calendar ON calendar_items(calendar_id);",
    "CREATE INDEX IF NOT EXISTS idx_calendar_items_assignee ON calendar_items(assignee_id);",
    "CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);",
    "CREATE INDEX IF NOT EXISTS idx_sessions_token_expires ON sessions(token, expires_at);",
  ];
  for (const idxSql of sqliteIndexes) {
    try { db.exec(idxSql); } catch {}
  }
  try { initSqliteStorageSchema(db); } catch (e) { console.error("storage schema:", e); }

  const existingAdmin = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
  if (!existingAdmin) {
    const adminPassword = String(process.env.STUDIO_ADMIN_PASSWORD || "").trim();
    if (adminPassword.length >= 12) {
      const adminUsername = String(process.env.STUDIO_ADMIN_USERNAME || "admin").trim().toLowerCase();
      const adminName = String(process.env.STUDIO_ADMIN_NAME || "Administrador").trim();
      const adminId = crypto.randomUUID();
      const now = new Date().toISOString();
      const adminHash = hashPassword(adminPassword);
      db.prepare(`
        INSERT INTO users (id, username, name, password_hash, role, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'admin', 'approved', ?, ?)
      `).run(adminId, adminUsername, adminName, adminHash, now, now);
    }
  }
}
