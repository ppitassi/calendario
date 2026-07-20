import mysql from 'mysql2/promise';

export function getDbPool() {
  if (!(global as any).mysqlPool) {
    (global as any).mysqlPool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'content_planner',
      charset: 'utf8mb4',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }

  return (global as any).mysqlPool;
}

export async function testDbConnection() {
  const [rows] = await getDbPool().query('SELECT 1 AS ok');
  return rows;
}
