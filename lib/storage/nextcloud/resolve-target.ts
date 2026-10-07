/**
 * Resolve o diretório de destino usando SEMPRE a árvore existente:
 * Cliente → client_storage_mappings → storage_nodes → (ano → mês → tipo) já existentes.
 * Se um nível não existir, para no mais profundo que existe; nunca cria pastas paralelas.
 */

import { getDb } from "../../db";
import { resolveClientDirectory } from "../../storage-mapping";
import type { AssetType } from "../storage-provider";

const MONTHS = ["JANEIRO", "FEVEREIRO", "MARCO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];

const TYPE_KEYWORDS: Record<AssetType, string[]> = {
  image: ["ARTES", "ARTE", "IMAGENS", "IMAGEM", "CRIATIVOS"],
  video: ["VIDEOS", "VIDEO", "AUDIOVISUAL"],
  document: ["DOCUMENTOS", "DOCS", "PDF", "BRIEFING"],
  master: ["MASTER", "MASTERS", "FINAIS", "ORIGINAIS"],
  other: [],
};

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();

type Child = { remote_file_id: string; remote_path: string; name: string };

async function childDirs(parentRemoteId: string): Promise<Child[]> {
  return (await getDb()
    .prepare("SELECT remote_file_id, remote_path, name FROM storage_nodes WHERE parent_remote_file_id = ? AND node_type = 'directory'")
    .all(parentRemoteId)) as Child[];
}

export type ResolvedStorageTarget = { path: string; remoteFileId: string; depth: number };

export async function resolveStorageTarget(args: {
  clientId: string;
  workUnitId?: string;
  taskId?: string;
  assetType: AssetType;
}): Promise<ResolvedStorageTarget> {
  const root = await resolveClientDirectory(args.clientId);
  if (!root) throw new Error("Cliente sem pasta mapeada no Nextcloud. Configure o mapeamento do cliente.");

  // Referência de data: prazo da demanda (ou da tarefa); senão, agora.
  let ref = new Date();
  const db = getDb();
  const row = (args.taskId
    ? await db.prepare("SELECT COALESCE(t.due_date, wu.due_date) AS d FROM tasks t JOIN work_units wu ON wu.id = t.work_unit_id WHERE t.id = ?").get(args.taskId)
    : args.workUnitId
    ? await db.prepare("SELECT due_date AS d FROM work_units WHERE id = ?").get(args.workUnitId)
    : null) as { d?: string } | null;
  if (row?.d && !isNaN(new Date(row.d).getTime())) ref = new Date(row.d);

  const year = String(ref.getFullYear());
  const monthIdx = ref.getMonth();
  const monthName = MONTHS[monthIdx];
  const monthNum = String(monthIdx + 1).padStart(2, "0");

  const matchers: Array<(name: string) => boolean> = [
    (n) => norm(n) === year || norm(n).includes(year),
    (n) => norm(n).includes(monthName) || new RegExp(`^0?${monthIdx + 1}\\b`).test(norm(n)) || norm(n).startsWith(monthNum),
    (n) => TYPE_KEYWORDS[args.assetType].some((k) => norm(n) === k || norm(n).includes(k)),
  ];

  let current: ResolvedStorageTarget = { path: root.path, remoteFileId: root.remoteFileId, depth: 0 };
  for (const match of matchers) {
    const found = (await childDirs(current.remoteFileId)).find((c) => match(c.name));
    if (!found) break;
    current = { path: found.remote_path, remoteFileId: found.remote_file_id, depth: current.depth + 1 };
  }
  return current;
}
