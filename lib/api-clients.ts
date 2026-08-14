import { NextRequest, NextResponse } from "next/server";
import { createNotificationEvent } from "./notifications";
import { access } from "node:fs/promises";
import path from "node:path";
import { exec, getDbPool, parseJson, rows } from "./db";
import { ApiContext, ApiParams } from "./api-types";
import { err, ok } from "./api-response";
import { enqueueAssetRelocations } from "./storage/relocation";
import { deleteStoredAsset } from "./storage";
import { localUploadsRoot } from "./storage";

type ClientRow = Record<string, unknown> & {
  id: string;
  logoUrl?: string;
  owners?: unknown;
};

export function clientOwnerIds(value: unknown): string[] {
  const parsed = Array.isArray(value) ? value : parseJson(value, []);
  if (!Array.isArray(parsed)) return [];
  return Array.from(
    new Set(
      parsed
        .map((owner) =>
          String(
            typeof owner === "string"
              ? owner
              : (owner as { uid?: string; id?: string })?.uid ||
                  (owner as { id?: string })?.id ||
                  "",
          ),
        )
        .filter(Boolean),
    ),
  );
}

export function publicClient(client: ClientRow) {
  return {
    ...client,
    owners: clientOwnerIds(client.owners),
    socialLinks: parseJson(client.socialLinks, {}),
    instagramStats: parseJson(client.instagramStats, {}),
    config: parseJson(client.config, {}),
  };
}

async function publicClientWithAvailableLogo(client: ClientRow) {
  const result = publicClient(client);
  const logoUrl = typeof result.logoUrl === "string" ? result.logoUrl : "";
  if (!logoUrl.startsWith("/uploads/")) return result;
  const pathname = decodeURIComponent(logoUrl.split(/[?#]/, 1)[0]);
  const parts = pathname.slice("/uploads/".length).split("/").filter(Boolean);
  if (!parts.length || parts.some(part => part === "." || part === ".." || part.includes("\\"))) return { ...result, logoUrl: null };
  const root = localUploadsRoot();
  const target = path.resolve(root, ...parts);
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return { ...result, logoUrl: null };
  try {
    await access(target);
    return result;
  } catch {
    return { ...result, logoUrl: null };
  }
}

function tablePayload(data: Record<string, unknown>) {
  const result: Record<string, unknown> = { ...data };
  for (const [key, value] of Object.entries(result)) {
    if (Array.isArray(value) || (value && typeof value === "object"))
      result[key] = JSON.stringify(value);
  }
  return result;
}

export async function handleClientsApi(
  method: string,
  route: string,
  req: NextRequest,
  params: ApiParams,
  ctx: ApiContext,
  removeAsset: (url: string) => Promise<void>,
): Promise<NextResponse | null> {
  if (route === "/clients" && method === "GET") {
    const unrestricted = ["admin", "gerente", "atendimento"].includes(
      ctx.userRole || "",
    );
    const result = await rows(
      `SELECT c.*
       FROM clients c
       WHERE (
            ? = 1
           OR JSON_CONTAINS(
             CASE WHEN JSON_VALID(c.owners) THEN c.owners ELSE JSON_ARRAY() END,
             JSON_QUOTE(?)
           )
           OR EXISTS (
             SELECT 1
             FROM posts p
             WHERE p.clientId = c.id
               AND (p.currentAssigneeId = ? OR p.actionAssigneeId = ? OR p.assigneeId = ?)
           )
           OR EXISTS (
             SELECT 1
             FROM users u
             WHERE u.uid = ?
                AND u.clientId = c.id
           )
         )
       ORDER BY c.name`,
      [
        unrestricted ? 1 : 0,
        ctx.userUid || "",
        ctx.userUid,
        ctx.userUid,
        ctx.userUid,
        ctx.userUid,
      ],
    );
    return ok(await Promise.all(result.map((client) => publicClientWithAvailableLogo(client as ClientRow))));
  }

  if (route === "/clients" && method === "POST") {
    const incoming = (await req.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!incoming.id || typeof incoming.id !== "string")
      return err("Identificador do cliente obrigatorio.", 400);
    const previous = incoming.id
      ? (
          await rows(
            "SELECT logoUrl FROM clients WHERE id = ?",
            [incoming.id],
          )
        )[0]
      : null;
    const data = tablePayload(incoming);
    if (previous) {
      const update = { ...data };
      delete update.id;
      await exec("UPDATE clients SET ? WHERE id = ?", [
        update,
        incoming.id,
      ]);
    } else {
      const collision = await rows("SELECT id FROM clients WHERE id = ? LIMIT 1", [incoming.id]);
      if (collision[0]) return err("Identificador de cliente ja utilizado.", 409);
      await exec("INSERT INTO clients SET ?", [data]);
    }
    if (previous?.logoUrl && previous.logoUrl !== data.logoUrl) {
      await removeAsset(String(previous.logoUrl));
    }
    if (previous && incoming.name !== undefined) {
      void enqueueAssetRelocations({ clientId: String(incoming.id) }).catch((error) => console.error("[media-relocation]", error));
    }
    void rows(
      "SELECT uid FROM users WHERE role IN ('admin','gerente')",
    )
      .then((users) =>
        createNotificationEvent({
          
          actorUserId: ctx.userUid,
          type: previous ? "client_updated" : "client_created",
          category: "clients",
          entityType: "client",
          entityId: String(data.id),
          clientId: String(data.id),
          title: previous ? "Cliente atualizado" : "Novo cliente",
          body: previous
            ? "Dados importantes do cliente foram atualizados."
            : "Um novo cliente foi adicionado Ã  agÃªncia.",
          route: "/?screen=client_management",
          recipientUserIds: users.map((user) => String(user.uid)),
          dedupeKey: `client:${String(data.id)}`,
        }),
      )
      .catch(() => {});
    return ok({ id: data.id });
  }

  if (route === "/clients/[id]" && method === "GET") {
    const result = await rows(
      "SELECT * FROM clients WHERE id = ?",
      [params.id],
    );
    const client = result[0] as ClientRow | undefined;
    if (!client) return err("Cliente nÃ£o encontrado.", 404);
    if (!["admin", "gerente", "atendimento"].includes(ctx.userRole || "")) {
      const accessible = await rows(
        `SELECT 1
         FROM clients c
         WHERE c.id = ?
           AND (
             JSON_CONTAINS(CASE WHEN JSON_VALID(c.owners) THEN c.owners ELSE JSON_ARRAY() END, JSON_QUOTE(?))
             OR EXISTS (
               SELECT 1 FROM posts p
               WHERE p.clientId = c.id
                 AND (p.currentAssigneeId = ? OR p.actionAssigneeId = ? OR p.assigneeId = ?)
             )
             OR EXISTS (
               SELECT 1 FROM users u
               WHERE u.uid = ? AND u.clientId = c.id
             )
           )
         LIMIT 1`,
        [
          params.id,
          ctx.userUid || "",
          ctx.userUid,
          ctx.userUid,
          ctx.userUid,
          ctx.userUid,
        ],
      );
      if (!accessible[0]) return err("Cliente nÃ£o encontrado.", 404);
    }
    return ok(await publicClientWithAvailableLogo(client));
  }

  if (route === "/clients/[id]" && method === "DELETE") {
    const connection = await getDbPool().getConnection();
    let assets: Array<{ storageProvider: string; storageKey: string; publicUrl?: string }> = [];
    let logoUrl: string | null = null;
    try {
      await connection.beginTransaction();
      const [clientRows] = await connection.query(
        "SELECT id, logoUrl FROM clients WHERE id = ? FOR UPDATE",
        [params.id],
      ) as any;
      if (!clientRows[0]) {
        await connection.rollback();
        return err("Cliente não encontrado.", 404);
      }
      logoUrl = clientRows[0].logoUrl || null;
      const [assetRows] = await connection.query(
        "SELECT storageProvider, storageKey, publicUrl FROM media_assets WHERE clientId = ? AND status = 'active' FOR UPDATE",
        [params.id],
      ) as any;
      assets = assetRows;

      await connection.query(
        "DELETE j FROM media_asset_mirror_receipts j JOIN media_assets a ON a.id = j.mediaAssetId WHERE a.clientId = ?",
        [params.id],
      );
      await connection.query(
        "DELETE j FROM media_relocation_jobs j JOIN media_assets a ON a.id = j.mediaAssetId WHERE a.clientId = ?",
        [params.id],
      );
      await connection.query(
        "DELETE j FROM media_sync_jobs j JOIN media_assets a ON a.id = j.mediaAssetId WHERE a.clientId = ?",
        [params.id],
      );
      await connection.query("DELETE FROM upload_intents WHERE client_id = ?", [params.id]);
      await connection.query("DELETE FROM publication_jobs WHERE client_id = ?", [params.id]);
      await connection.query("DELETE FROM social_connections WHERE client_id = ?", [params.id]);
      await connection.query("DELETE FROM meta_oauth_connections WHERE client_id = ?", [params.id]);
      await connection.query("DELETE FROM meta_oauth_states WHERE client_id = ?", [params.id]);
      await connection.query("DELETE FROM oauth_integration_states WHERE client_id = ?", [params.id]);
      await connection.query("DELETE FROM notifications WHERE clientId = ?", [params.id]);
      await connection.query("UPDATE users SET clientId = NULL WHERE clientId = ?", [params.id]);
      await connection.query(
        "UPDATE media_assets SET status = 'deleted', deletedAt = NOW(), updatedAt = NOW() WHERE clientId = ? AND status <> 'deleted'",
        [params.id],
      );
      await connection.query("DELETE FROM clients WHERE id = ?", [params.id]);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    for (const asset of assets) {
      await deleteStoredAsset(asset.storageProvider, asset.storageKey).catch((error) =>
        console.error("[client-delete-storage]", { clientId: params.id, storageKey: asset.storageKey, error }),
      );
    }
    if (logoUrl && !assets.some((asset) => asset.publicUrl === logoUrl)) {
      await removeAsset(logoUrl).catch(() => undefined);
    }
    return ok({ success: true, deletedAssets: assets.length });
  }

  return null;
}
