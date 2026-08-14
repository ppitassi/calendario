require("dotenv").config({ path: ".env.local" });
const mysql = require("mysql2/promise");

async function addColumn(connection, table, definition) {
  const name = definition.split(/\s+/)[0].replace(/`/g, "");
  const [rows] = await connection.query(
    "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?",
    [table, name],
  );
  if (!rows.length) await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN ${definition}`);
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: "utf8mb4",
  });
  try {
    for (const definition of [
      "logicalPath VARCHAR(1024) NULL",
      "visibility ENUM('public','protected') NOT NULL DEFAULT 'protected'",
      "relocationRevision INT NOT NULL DEFAULT 1",
      "relocationState VARCHAR(32) NOT NULL DEFAULT 'current'",
      "nextcloudState VARCHAR(32) NOT NULL DEFAULT 'pending'",
    ]) await addColumn(connection, "media_assets", definition);
    for (const definition of [
      "logical_path VARCHAR(1024) NULL",
      "visibility ENUM('public','protected') NOT NULL DEFAULT 'protected'",
      "item_index INT NULL",
    ]) await addColumn(connection, "upload_intents", definition);

    await connection.query(`CREATE TABLE IF NOT EXISTS media_asset_mirror_receipts (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      mediaAssetId VARCHAR(64) NOT NULL,
      userUid VARCHAR(191) NOT NULL,
      deviceId VARCHAR(191) NOT NULL,
      checksum CHAR(64) NOT NULL,
      logicalPath VARCHAR(1024) NOT NULL,
      status VARCHAR(32) NOT NULL,
      lastError VARCHAR(500) NULL,
      lastSynchronizedAt DATETIME NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_asset_user_device (mediaAssetId,userUid,deviceId),
      KEY idx_mirror_user_device (userUid,deviceId,status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.query(`CREATE TABLE IF NOT EXISTS media_relocation_jobs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      mediaAssetId VARCHAR(64) NOT NULL,
      fromPath VARCHAR(1024) NOT NULL,
      toPath VARCHAR(1024) NOT NULL,
      revision INT NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      attempts INT NOT NULL DEFAULT 0,
      nextAttemptAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      lastError VARCHAR(500) NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      completedAt DATETIME NULL,
      UNIQUE KEY uq_asset_revision (mediaAssetId,revision),
      KEY idx_relocation_queue (status,nextAttemptAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    console.log("Local asset schema is ready.");
  } finally { await connection.end(); }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
