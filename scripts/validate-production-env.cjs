/** Valida volumes e credencial inicial antes de o PM2 iniciar o Studio. */
const fs = require("node:fs");
const path = require("node:path");
const { loadEnvironment } = require("./load-env.cjs");

const errors = [];
try {
  loadEnvironment({ production: true, required: true });
} catch (error) {
  console.error(`[studio-env] ${error.message}`);
  process.exit(1);
}

/** Exige um volume absoluto já montado, que seja diretório legível e gravável. */
function validateDirectory(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    errors.push(`${name} é obrigatório.`);
    return;
  }
  if (!path.isAbsolute(value)) {
    errors.push(`${name} deve ser um caminho absoluto.`);
    return;
  }
  if (!fs.existsSync(value)) {
    errors.push(`${name} não existe; crie e monte o volume antes do start.`);
    return;
  }
  try {
    if (!fs.statSync(value).isDirectory()) {
      errors.push(`${name} precisa apontar para um diretório.`);
      return;
    }
    fs.accessSync(value, fs.constants.R_OK | fs.constants.W_OK);
  } catch {
    errors.push(`${name} não permite leitura e escrita.`);
  }
}

validateDirectory("STUDIO_DATA_DIR");
validateDirectory("STUDIO_UPLOAD_DIR");

const password = String(process.env.STUDIO_ADMIN_PASSWORD || "");
if (password.length < 12) {
  errors.push("STUDIO_ADMIN_PASSWORD deve ter ao menos 12 caracteres.");
}
if (!String(process.env.STUDIO_ADMIN_USERNAME || "").trim()) {
  errors.push("STUDIO_ADMIN_USERNAME é obrigatório.");
}
if (!String(process.env.STUDIO_ADMIN_NAME || "").trim()) {
  errors.push("STUDIO_ADMIN_NAME é obrigatório.");
}

const port = Number(process.env.PORT || 3010);
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  errors.push("PORT deve ser um número inteiro entre 1 e 65535.");
}
if (!String(process.env.HOSTNAME || "").trim()) {
  errors.push("HOSTNAME é obrigatório.");
}

const uploadLimit = Number(process.env.STUDIO_UPLOAD_MAX_MB || 10);
if (!Number.isFinite(uploadLimit) || uploadLimit <= 0 || uploadLimit > 100) {
  errors.push("STUDIO_UPLOAD_MAX_MB deve estar entre 1 e 100.");
}

for (const error of errors) console.error(`[studio-env][erro] ${error}`);
if (errors.length) process.exit(1);
console.log("[studio-env] configuração de produção aprovada.");
