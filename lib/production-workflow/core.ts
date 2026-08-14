import "server-only";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";

export type ClientRow = RowDataPacket & {
  id: string;
  name: string;
  owners: string | string[] | null;
};

export type ResponsibleUser = RowDataPacket & {
  uid: string;
  displayName: string;
  role: string;
};

export type PlanningPost = RowDataPacket & {
  id: number;
  title?: string | null;
  head?: string | null;
  subhead?: string | null;
  caption?: string | null;
  subtitle?: string | null;
  currentStage: string;
  currentAssigneeId?: string | null;
  workflowStatus?: string | null;
  artworkCurrentVersion?: number | null;
};

export type ArtworkVersion = RowDataPacket & {
  id: number;
  versionNumber: number;
};

export type PlanningRef = { clientId: string; month: string };

export function decodePlanningId(value: string): PlanningRef {
  const i = value.lastIndexOf("__");
  const clientId = decodeURIComponent(i < 0 ? "" : value.slice(0, i)),
    month = value.slice(i + 2);
  if (!clientId || !/^[0-9]{4}-[0-9]{2}$/.test(month))
    throw Object.assign(new Error("Planejamento inválido."), {
      status: 422,
      code: "INVALID_PLANNING",
    });
  return { clientId, month };
}

export const planningId = (clientId: string, month: string) =>
  `${encodeURIComponent(clientId)}__${month}`;

const roles: Record<string, string[]> = {
  social_media: ["socialmedia", "social_media"],
  designer: ["designer", "estagiario"],
  atendimento: ["atendimento"],
};

export async function clientResponsible(
  connection: PoolConnection,
  clientId: string,
  kind: keyof typeof roles,
) {
  const [clients] = await connection.query<ClientRow[]>(
    "SELECT id,name,owners FROM clients WHERE id=? LIMIT 1",
    [clientId],
  );
  const client = clients[0];
  if (!client)
    throw Object.assign(new Error("Cliente não encontrado."), {
      status: 404,
      code: "CLIENT_NOT_FOUND",
    });
  let owners: string[] = [];
  try {
    owners = Array.isArray(client.owners)
      ? client.owners
      : JSON.parse(client.owners || "[]");
  } catch { }
  if (!owners.length) return { client, user: null };
  const [users] = await connection.query<ResponsibleUser[]>(
    "SELECT uid,displayName,role FROM users WHERE uid IN (?) ORDER BY displayName,uid",
    [owners],
  );
  return {
    client,
    user:
      users.find((user) =>
        roles[kind].includes(String(user.role).toLowerCase()),
      ) || null,
  };
}

export async function planningPosts(
  connection: PoolConnection,
  ref: PlanningRef,
  lock = false,
) {
  const [posts] = await connection.query<PlanningPost[]>(
    `SELECT * FROM posts WHERE clientId=? AND DATE_FORMAT(date,'%Y-%m')=? AND COALESCE(currentStage,'copy') NOT IN ('arquivado','cancelado') ORDER BY date,id${lock ? " FOR UPDATE" : ""}`,
    [ref.clientId, ref.month],
  );
  return posts;
}

export function copyBlocks(posts: PlanningPost[]) {
  return posts.flatMap((p) =>
    [
      ["Head", p.head],
      ["Subhead", p.subhead],
      ["Legenda", p.caption || p.subtitle],
    ]
      .filter(([, v]) => !String(v || "").trim())
      .map(([field]) => ({
        postId: p.id,
        title: p.title || p.head || `Post ${p.id}`,
        field,
      })),
  );
}
