const fs = require("node:fs");
const mysql = require("mysql2/promise");
require("dotenv").config({ path: fs.existsSync(".env.local") ? ".env.local" : ".env" });

function databaseName() {
  const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
  return url
    ? decodeURIComponent(url.pathname.replace(/^\//, ""))
    : process.env.DB_NAME || "content_planner";
}

function options({ includeDatabase = true, multipleStatements = false } = {}) {
  const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
  const sslEnabled = process.env.DB_SSL_MODE === "required" || url?.searchParams.get("ssl-mode") === "REQUIRED";
  const ca = process.env.DB_SSL_CA_BASE64
    ? Buffer.from(process.env.DB_SSL_CA_BASE64, "base64").toString("utf8")
    : undefined;
  return {
    host: url?.hostname || process.env.DB_HOST || "localhost",
    port: Number(url?.port || process.env.DB_PORT || 3306),
    user: url ? decodeURIComponent(url.username) : process.env.DB_USER || "root",
    password: url ? decodeURIComponent(url.password) : process.env.DB_PASSWORD || "",
    ...(includeDatabase ? { database: databaseName() } : {}),
    charset: "utf8mb4",
    dateStrings: true,
    multipleStatements,
    ssl: sslEnabled ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false", ...(ca ? { ca } : {}) } : undefined,
  };
}

module.exports = { databaseName, options, mysql };
