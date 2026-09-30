/** Carrega o ambiente e inicia o servidor standalone do Presentation Studio. */
const fs = require("node:fs");
const path = require("node:path");
const { loadEnvironment } = require("./load-env.cjs");

loadEnvironment({ production: true, required: true });
process.env.NODE_ENV = "production";
process.env.PORT ||= "3010";
process.env.HOSTNAME ||= "127.0.0.1";

const server = path.resolve(__dirname, "..", ".next", "standalone", "server.js");
if (!fs.existsSync(server)) {
  throw new Error("Build ausente. Execute `npm run build` antes do start.");
}

// O servidor gerado abre o listener ao ser importado.
require(server);
