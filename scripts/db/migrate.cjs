const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { options, mysql } = require("./connection.cjs");

(async () => {
  const connection = await mysql.createConnection(options({ multipleStatements: true }));
  await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(100) PRIMARY KEY,
    checksum CHAR(64) NOT NULL,
    applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  const directory = path.resolve("database/migrations");
  const files = fs.readdirSync(directory).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(directory, file), "utf8");
    const checksum = crypto.createHash("sha256").update(sql).digest("hex");
    const [known] = await connection.query("SELECT checksum FROM schema_migrations WHERE version = ?", [file]);
    if (known[0]) {
      if (known[0].checksum !== checksum) throw new Error(`Migration alterada após aplicação: ${file}`);
      continue;
    }
    await connection.beginTransaction();
    try {
      await connection.query(sql);
      await connection.query("INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)", [file, checksum]);
      await connection.commit();
      console.log(`applied ${file}`);
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  }
  await connection.end();
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
