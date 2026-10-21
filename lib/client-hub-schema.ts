/** DDL compatível com PostgreSQL e SQLite; o cadastro existente continua sendo a origem do cliente. */
export const CLIENT_HUB_SCHEMA = `
  CREATE TABLE IF NOT EXISTS client_hubs (
    client_id TEXT PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
    document TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0,
    portal_token TEXT UNIQUE NOT NULL,
    briefing_token TEXT UNIQUE NOT NULL,
    portal_enabled INTEGER NOT NULL DEFAULT 0,
    briefing_open INTEGER NOT NULL DEFAULT 1,
    submitted_at TEXT,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS client_briefing_submissions (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    answers TEXT NOT NULL,
    submitted_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_briefing_client ON client_briefing_submissions(client_id);
`;
