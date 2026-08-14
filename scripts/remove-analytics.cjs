require("dotenv").config({ path: ".env.local", quiet: true });
const mysql = require("mysql2/promise");

const TABLES = ["post_analytics", "client_analytics", "analytics_sync_runs", "content_metric_snapshots", "profile_metric_snapshots", "meta_media_history"];

async function main() {
  if (!process.argv.includes("--apply")) throw new Error("Migração destrutiva bloqueada. Execute novamente com --apply após confirmar o backup.");
  const connection = await mysql.createConnection(process.env.DATABASE_URL || { host: process.env.DB_HOST || "127.0.0.1", port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, charset: "utf8mb4" });
  try {
    const [databaseRows] = await connection.query("SELECT DATABASE() AS name");
    const database = databaseRows[0]?.name;
    if (!database) throw new Error("Nenhum banco selecionado.");
    const [existing] = await connection.query(`SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (${TABLES.map(() => "?").join(",")})`, [database, ...TABLES]);
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    try { for (const table of TABLES) await connection.query(`DROP TABLE IF EXISTS \`${table}\``); }
    finally { await connection.query("SET FOREIGN_KEY_CHECKS = 1"); }
    console.log(JSON.stringify({ database, removed: existing.map(row => row.name), alreadyAbsent: TABLES.filter(table => !existing.some(row => row.name === table)) }, null, 2));
  } finally { await connection.end(); }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
