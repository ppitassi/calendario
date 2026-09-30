/**
 * Catálogo de processos PM2 do Presentation Studio.
 *
 * Este arquivo não contém nem copia segredos para o dump do PM2. O próprio
 * inicializador lê `.env.production.local` dentro do processo da aplicação.
 */
const path = require("node:path");

module.exports = {
  apps: [
    {
      // Nome estável usado pelos comandos `pm2 logs`, `restart` e `stop`.
      name: "presentation-studio",
      cwd: __dirname,

      // O inicializador valida os diretórios persistentes e executa o bundle
      // standalone copiado pelo `postbuild`.
      script: path.join(__dirname, "scripts", "start-production.cjs"),
      interpreter: process.execPath,

      // O SQLite exige uma única instância gravando no arquivo local. Caso a
      // aplicação precise escalar horizontalmente, migre primeiro o banco.
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      restart_delay: 2_000,
      max_memory_restart: "512M",
      kill_timeout: 10_000,
      time: true,

      // Só opções não sigilosas ficam nos metadados persistidos pelo PM2.
      env: {
        NODE_ENV: "production",
        NEXT_TELEMETRY_DISABLED: "1",
        ...(process.env.PRESENTATION_STUDIO_ENV_FILE
          ? { PRESENTATION_STUDIO_ENV_FILE: process.env.PRESENTATION_STUDIO_ENV_FILE }
          : {}),
      },

      // Os arquivos ficam fora do bundle e podem ser coletados pelo sistema de
      // logs do servidor sem misturar stdout e stderr.
      out_file: path.join(__dirname, "logs", "presentation-studio.out.log"),
      error_file: path.join(__dirname, "logs", "presentation-studio.error.log"),
      merge_logs: true,
    },
  ],
};
