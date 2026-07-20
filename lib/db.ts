import mysql, { PoolOptions } from 'mysql2/promise';

function connectionOptions(): PoolOptions {
  const databaseUrl = process.env.DATABASE_URL;
  const parsed = databaseUrl ? new URL(databaseUrl) : null;
  const sslEnabled = process.env.DB_SSL_MODE === 'required' || parsed?.searchParams.get('ssl-mode') === 'REQUIRED';
  const ca = process.env.DB_SSL_CA_BASE64
    ? Buffer.from(process.env.DB_SSL_CA_BASE64, 'base64').toString('utf8')
    : undefined;

  return {
    host: parsed?.hostname || process.env.DB_HOST || 'localhost',
    port: Number(parsed?.port || process.env.DB_PORT || 3306),
    user: parsed ? decodeURIComponent(parsed.username) : process.env.DB_USER || 'root',
    password: parsed ? decodeURIComponent(parsed.password) : process.env.DB_PASSWORD || '',
    database: parsed ? decodeURIComponent(parsed.pathname.replace(/^\//, '')) : process.env.DB_NAME || 'content_planner',
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: Math.max(1, Number(process.env.DB_CONNECTION_LIMIT || (process.env.VERCEL ? 3 : 10))),
    maxIdle: Math.max(1, Number(process.env.DB_CONNECTION_LIMIT || (process.env.VERCEL ? 3 : 10))),
    idleTimeout: 60_000,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    ssl: sslEnabled ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false', ...(ca ? { ca } : {}) } : undefined,
  };
}

export function getDbPool() {
  if (!(global as any).mysqlPool) {
    (global as any).mysqlPool = mysql.createPool(connectionOptions());
  }
  return (global as any).mysqlPool;
}

export async function testDbConnection() {
  const [rows] = await getDbPool().query('SELECT 1 AS ok');
  return rows;
}
