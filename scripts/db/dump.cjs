const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { databaseName, options, mysql } = require("./connection.cjs");

function quote(value) {
  if (value === null || value === undefined) return "NULL";
  if (Buffer.isBuffer(value)) return `X'${value.toString("hex")}'`;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "NULL" : mysql.escape(value.toISOString().slice(0, 19).replace("T", " "));
  }
  return mysql.escape(value);
}

(async () => {
  const connection = await mysql.createConnection(options());
  const [tables] = await connection.query(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME",
  );
  const lines = [
    `-- Content Planner logical backup: ${new Date().toISOString()}`,
    `-- Database: ${databaseName()}`,
    "SET FOREIGN_KEY_CHECKS=0;",
  ];
  for (const { TABLE_NAME: table } of tables) {
    const [[definition]] = await connection.query(`SHOW CREATE TABLE \`${table}\``);
    lines.push(`DROP TABLE IF EXISTS \`${table}\`;`, `${definition["Create Table"]};`);
    const [rows] = await connection.query(`SELECT * FROM \`${table}\``);
    for (const row of rows) {
      const columns = Object.keys(row).map((column) => `\`${column}\``).join(",");
      const values = Object.values(row).map(quote).join(",");
      lines.push(`INSERT INTO \`${table}\` (${columns}) VALUES (${values});`);
    }
  }
  lines.push("SET FOREIGN_KEY_CHECKS=1;");
  await connection.end();
  const directory = path.resolve("backups");
  fs.mkdirSync(directory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = path.join(directory, `content-planner-${stamp}.sql`);
  const body = `${lines.join("\n")}\n`;
  fs.writeFileSync(target, body, { mode: 0o600 });
  const checksum = crypto.createHash("sha256").update(body).digest("hex");
  console.log(JSON.stringify({ target, tables: tables.length, bytes: Buffer.byteLength(body), sha256: checksum }));
})().catch((error) => {
  console.error(error.code || error.message);
  process.exit(1);
});
