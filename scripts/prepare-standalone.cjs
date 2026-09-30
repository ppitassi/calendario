/** Copia assets que o Next deixa fora da saída standalone por padrão. */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");

/** Substitui uma cópia gerada sem alterar a origem versionada. */
function copyDirectory(source, destination) {
  if (!fs.existsSync(source)) return;
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true });
}

/**
 * Copia somente assets públicos versionáveis. Uploads pertencem ao volume e
 * são servidos por `/api/uploads/*`, portanto nunca viajam no release.
 */
function copyPublicDirectory(source, destination) {
  if (!fs.existsSync(source)) return;
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, {
    recursive: true,
    filter: (current) => {
      const relative = path.relative(source, current);
      return relative !== "uploads" && !relative.startsWith(`uploads${path.sep}`);
    },
  });
}

/** Reprova o release se SQLite, WAL ou diretórios persistentes aparecerem no bundle. */
function assertNoPersistentState() {
  const forbiddenRoots = ["data", "logs", "artifacts", path.join("public", "uploads")];
  const leaked = forbiddenRoots.filter((relative) =>
    fs.existsSync(path.join(standalone, relative)),
  );

  /** Percorre o artefato e registra extensões próprias do SQLite. */
  function inspect(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) inspect(absolute);
      else if (/\.(?:db|sqlite|sqlite3)(?:-(?:wal|shm))?$|\.db-(?:wal|shm)$/i.test(entry.name)) {
        leaked.push(path.relative(standalone, absolute));
      }
    }
  }

  inspect(standalone);
  if (leaked.length) {
    throw new Error(
      `Build recusado: estado persistente entrou no standalone: ${[...new Set(leaked)].join(", ")}`,
    );
  }
}

if (!fs.existsSync(path.join(standalone, "server.js"))) {
  throw new Error("Build standalone ausente.");
}

assertNoPersistentState();
copyPublicDirectory(path.join(root, "public"), path.join(standalone, "public"));
copyDirectory(
  path.join(root, ".next", "static"),
  path.join(standalone, ".next", "static"),
);
assertNoPersistentState();
console.log("[presentation-studio] assets standalone preparados.");
