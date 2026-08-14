const { databaseName, options, mysql } = require("./connection.cjs");
const { spawnSync } = require("node:child_process");

(async () => {
  const name = databaseName();
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) throw new Error("Reset recusado em produção");
  if (process.env.DB_RESET_CONFIRM !== name) throw new Error(`Defina DB_RESET_CONFIRM=${name} para confirmar o reset`);
  if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error("Nome de banco inválido");
  const connection = await mysql.createConnection(options({ includeDatabase: false }));
  await connection.query(`DROP DATABASE IF EXISTS \`${name}\``);
  await connection.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.end();
  const migrate = spawnSync(process.execPath, ["scripts/db/migrate.cjs"], { stdio: "inherit", env: process.env });
  if (migrate.status !== 0) process.exit(migrate.status || 1);
  const seed = spawnSync(process.execPath, ["scripts/db/seed.cjs"], { stdio: "inherit", env: process.env });
  process.exit(seed.status || 0);
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
