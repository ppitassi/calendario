require("dotenv").config({ path: ".env.local" });
const mysql = require("mysql2/promise");
async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL || { host: process.env.DB_HOST || "127.0.0.1", port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, charset: "utf8mb4" });
  try {
    await connection.query(`CREATE TABLE IF NOT EXISTS presentation_snapshots (
      id CHAR(36) PRIMARY KEY, clientId VARCHAR(191) NOT NULL, month CHAR(7) NOT NULL, version INT NOT NULL,
      sourceType ENUM('internal','review') NOT NULL, sourceTokenId VARCHAR(191) NULL, contentHash CHAR(64) NOT NULL,
      payload JSON NOT NULL, createdByUserId VARCHAR(191) NULL, approvalStatus VARCHAR(32) NOT NULL DEFAULT 'draft',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq_snapshot_version (clientId,month,sourceType,version),
      KEY idx_snapshot_source (clientId,month,sourceType,createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.query(`CREATE TABLE IF NOT EXISTS presentation_pdf_jobs (
      id CHAR(36) PRIMARY KEY, snapshotId CHAR(36) NOT NULL, requestedByUserId VARCHAR(191) NULL, reviewTokenId VARCHAR(191) NULL,
      status ENUM('queued','processing','ready','failed','expired') NOT NULL DEFAULT 'queued', progress TINYINT UNSIGNED NOT NULL DEFAULT 0,
      attempts TINYINT UNSIGNED NOT NULL DEFAULT 0, rendererVersion VARCHAR(32) NOT NULL, outputUrl VARCHAR(2048) NULL,
      outputProvider VARCHAR(64) NULL, outputStorageKey VARCHAR(1024) NULL, outputChecksum CHAR(64) NULL, outputSize BIGINT UNSIGNED NULL,
      pageCount INT UNSIGNED NULL, warnings JSON NULL, lastError VARCHAR(500) NULL, renderTokenHash CHAR(64) NULL,
      renderTokenExpiresAt DATETIME NULL, startedAt DATETIME NULL, completedAt DATETIME NULL, expiresAt DATETIME NULL,
      availableAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_pdf_queue (status,createdAt), KEY idx_pdf_owner (requestedByUserId,status), CONSTRAINT fk_pdf_snapshot FOREIGN KEY (snapshotId) REFERENCES presentation_snapshots(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    const [columns]=await connection.query("SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='presentation_pdf_jobs' AND COLUMN_NAME='availableAt'");
    if(!columns.length) await connection.query("ALTER TABLE presentation_pdf_jobs ADD COLUMN availableAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, ADD KEY idx_pdf_available (status,availableAt)");
    const [snapshotIndex]=await connection.query("SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='presentation_snapshots' AND INDEX_NAME='uq_snapshot_content'");
    if(!snapshotIndex.length)await connection.query("ALTER TABLE presentation_snapshots ADD UNIQUE KEY uq_snapshot_content (clientId,month,sourceType,contentHash)");
    const [jobIndex]=await connection.query("SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='presentation_pdf_jobs' AND INDEX_NAME='uq_snapshot_renderer'");
    if(!jobIndex.length)await connection.query("ALTER TABLE presentation_pdf_jobs ADD UNIQUE KEY uq_snapshot_renderer (snapshotId,rendererVersion)");
    console.log("Estrutura de apresentação e PDF pronta.");
  } finally { await connection.end(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
