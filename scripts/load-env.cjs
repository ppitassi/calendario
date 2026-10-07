/** Carrega `.env.local` ou `.env.production.local` sem sobrescrever o ambiente do host. */
const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");

/** Resolve o arquivo explícito ou o padrão correspondente ao modo solicitado. */
function loadEnvironment({ production = false, required = false } = {}) {
  const explicit = String(process.env.PRESENTATION_STUDIO_ENV_FILE || "").trim();
  const selected = path.resolve(
    explicit || (production ? ".env.production.local" : ".env.local"),
  );
  if (!fs.existsSync(selected)) {
    if (required || explicit) {
      throw new Error(`Arquivo de ambiente não encontrado: ${selected}`);
    }
    return null;
  }
  const result = dotenv.config({ path: selected, override: false, quiet: true });
  if (result.error) throw result.error;
  return selected;
}

module.exports = { loadEnvironment };
