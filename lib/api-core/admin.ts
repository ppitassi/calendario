import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { exec, getDbPool, parseJson, rows } from "../db";
import { ApiContext, ApiParams } from "../api-types";
import { err, ok } from "../api-response";
import { body } from "./context";
import { removeLocalAssetIfUnreferenced } from "./media-utils";
import { ensureNotificationPreferences } from "../notifications";

function tablePayload(data: Record<string, any>) {
  const out: Record<string, any> = { ...data };
  for (const key of Object.keys(out)) {
    if (Array.isArray(out[key]) || (out[key] && typeof out[key] === "object"))
      out[key] = JSON.stringify(out[key]);
  }
  return out;
}

export async function handleAdminApi(
  method: string,
  route: string,
  req: NextRequest,
  params: ApiParams,
  ctx: ApiContext,
): Promise<NextResponse | null> {
  if (route === "/team/members" && method === "GET")
    return ok(
      await rows(
        "SELECT uid, displayName, email, photoURL, role FROM users ORDER BY displayName, email",
      ),
    );

  if (route === "/users/me" && method === "GET") {
    const result = await rows(
      "SELECT uid,email,displayName,photoURL,role,birthday,githubUsername,portfolioUrl FROM users WHERE uid = ? LIMIT 1",
      [ctx.userUid],
    );
    return result[0]
      ? ok(result[0])
      : err("Usuário não encontrado.", 404, "PROFILE_NOT_FOUND");
  }

  if (route === "/users/me" && method === "PATCH") {
    if (!ctx.userUid) return err("Sessão expirada.", 401, "UNAUTHORIZED");
    const incoming = await body(req);
    const allowed = new Set([
      "displayName",
      "birthday",
      "githubUsername",
      "portfolioUrl",
      "photoURL",
      "photoAssetId",
    ]);
    const unknown = Object.keys(incoming || {}).filter(
      (key) => !allowed.has(key),
    );
    if (unknown.length)
      return err(
        "O perfil contém campos não permitidos.",
        400,
        "INVALID_PROFILE_DATA",
      );
    const displayName = String(incoming.displayName ?? "").trim();
    if (!displayName || displayName.length > 255)
      return err(
        "Informe um nome de exibição válido.",
        422,
        "INVALID_PROFILE_DATA",
        { displayName: "Nome obrigatório, com até 255 caracteres." },
      );
    const birthdayValue =
      incoming.birthday === null ||
        incoming.birthday === "" ||
        incoming.birthday === undefined
        ? null
        : String(incoming.birthday);
    if (birthdayValue) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdayValue))
        return err(
          "Data de nascimento inválida.",
          422,
          "INVALID_BIRTH_DATE",
          { birthday: "Use o formato YYYY-MM-DD." },
        );
      const [year, month, day] = birthdayValue.split("-").map(Number);
      const parsed = new Date(Date.UTC(year, month - 1, day));
      if (
        parsed.getUTCFullYear() !== year ||
        parsed.getUTCMonth() !== month - 1 ||
        parsed.getUTCDate() !== day
      )
        return err(
          "Data de nascimento inválida.",
          422,
          "INVALID_BIRTH_DATE",
          { birthday: "Informe uma data existente." },
        );
    }
    const githubUsername =
      incoming.githubUsername == null
        ? null
        : String(incoming.githubUsername).trim().replace(/^@/, "") || null;
    if (
      githubUsername &&
      !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(githubUsername)
    )
      return err("Usuário do GitHub inválido.", 422, "INVALID_PROFILE_DATA", {
        githubUsername: "Use apenas letras, números e hífens.",
      });
    let portfolioUrl: string | null =
      incoming.portfolioUrl == null
        ? null
        : String(incoming.portfolioUrl).trim() || null;
    if (portfolioUrl && !/^[a-z][a-z0-9+.-]*:/i.test(portfolioUrl))
      portfolioUrl = `https://${portfolioUrl}`;
    if (portfolioUrl) {
      try {
        const parsed = new URL(portfolioUrl);
        if (parsed.protocol !== "https:") throw new Error();
        portfolioUrl = parsed.toString();
      } catch {
        return err(
          "URL do portfólio inválida.",
          422,
          "INVALID_PORTFOLIO_URL",
          { portfolioUrl: "Informe uma URL HTTPS válida." },
        );
      }
    }
    const previous = (
      await rows(
        "SELECT photoURL FROM users WHERE uid = ? LIMIT 1",
        [ctx.userUid],
      )
    )[0];
    let photoURL: string | null =
      incoming.photoURL === undefined
        ? previous?.photoURL || null
        : String(incoming.photoURL || "").trim() || null;
    if (photoURL && !photoURL.startsWith("/uploads/"))
      return err(
        "A referência da foto é inválida.",
        422,
        "INVALID_PROFILE_DATA",
        { photoURL: "Use uma imagem enviada pelo aplicativo." },
      );
    if (incoming.photoAssetId) {
      const ownedAsset = (
        await rows(
          "SELECT id,publicUrl FROM media_assets WHERE id=? AND ownerType='user' AND ownerId=? AND category IN ('avatar','avatar_thumbnail') AND status='active' LIMIT 1",
          [String(incoming.photoAssetId), ctx.userUid],
        )
      )[0];
      if (!ownedAsset || ownedAsset.publicUrl !== photoURL)
        return err(
          "A foto não pertence ao usuário autenticado.",
          403,
          "FORBIDDEN",
        );
    }
    await exec(
      "UPDATE users SET displayName=?,birthday=?,githubUsername=?,portfolioUrl=?,photoURL=? WHERE uid=?",
      [
        displayName,
        birthdayValue,
        githubUsername,
        portfolioUrl,
        photoURL,
        ctx.userUid,
        ],
    );
    const updated = (
      await rows(
        "SELECT uid,email,displayName,photoURL,role,birthday,githubUsername,portfolioUrl FROM users WHERE uid=? LIMIT 1",
        [ctx.userUid],
      )
    )[0];
    if (previous?.photoURL && previous.photoURL !== photoURL)
      await removeLocalAssetIfUnreferenced(previous.photoURL);
    return ok(updated);
  }

  if (route === "/users" && method === "GET")
    return ok(
      await rows(
        "SELECT uid, email, displayName, photoURL, role, whatsapp, clientId, birthday FROM users",
      ),
    );

  if (route === "/users/[uid]" && method === "GET") {
    const result = await rows(
      "SELECT uid, email, displayName, photoURL, role, whatsapp, clientId, birthday FROM users WHERE uid = ?",
      [params.uid],
    );
    return result[0] ? ok(result[0]) : err("Usuário não encontrado.", 404);
  }

  if (route === "/users" && method === "POST") {
    const incoming = await body(req);
    if (!incoming.uid || typeof incoming.uid !== "string")
      return err("Identificador do usuario obrigatorio.", 400);
    const previous = incoming.uid
      ? (
        await rows(
          "SELECT uid, photoURL FROM users WHERE uid = ?",
          [incoming.uid],
        )
      )[0]
      : null;
    if (
      !previous &&
      (typeof incoming.password !== "string" || incoming.password.length < 8)
    ) {
      return err("Defina uma senha com pelo menos 8 caracteres.", 400);
    }
    if (
      incoming.password !== undefined &&
      incoming.password !== "" &&
      String(incoming.password).length < 8
    ) {
      return err("A senha deve possuir pelo menos 8 caracteres.", 400);
    }
    if (incoming.password === "") delete incoming.password;
    const allowedUserFields = [
      "uid",
      "email",
      "displayName",
      "photoURL",
      "role",
      "whatsapp",
      "clientId",
      "birthday",
      "password",
    ];
    const filteredUser = Object.fromEntries(
      allowedUserFields
        .filter((key) => incoming[key] !== undefined)
        .map((key) => [key, incoming[key]]),
    );
    const data = tablePayload(filteredUser);
    if (data.password) data.password = await bcrypt.hash(data.password, 10);
    if (previous) {
      const update = { ...data };
      delete update.uid;
      
      await exec("UPDATE users SET ? WHERE uid = ?", [
        update,
        incoming.uid,
        ]);
    } else {
      const collision = await rows("SELECT uid FROM users WHERE uid = ? LIMIT 1", [incoming.uid]);
      if (collision[0]) return err("Identificador de usuario ja utilizado.", 409);
      await exec("INSERT INTO users SET ?", [data]);
    }
    await ensureNotificationPreferences(data.uid);
    if (previous?.photoURL && previous.photoURL !== data.photoURL)
      await removeLocalAssetIfUnreferenced(previous.photoURL);
    return ok();
  }

  if (route === "/users/[uid]" && method === "DELETE") {
    const previous = (
      await rows(
        "SELECT photoURL FROM users WHERE uid = ?",
        [params.uid],
      )
    )[0];
    await exec("DELETE FROM users WHERE uid = ?", [
      params.uid,
      ]);
    if (previous?.photoURL)
      await removeLocalAssetIfUnreferenced(previous.photoURL);
    return ok();
  }

  if (route === "/users/change-password" && method === "POST") {
    const data = await body(req);
    if (!ctx.userUid) return err("Não autenticado.", 401);
    if (!data.newPassword || String(data.newPassword).length < 8)
      return err("A nova senha deve ter pelo menos 8 caracteres.", 400);
    const found = await rows(
      "SELECT password FROM users WHERE uid = ?",
      [ctx.userUid],
    );
    if (
      !found[0] ||
      !(await bcrypt.compare(data.currentPassword, found[0].password))
    )
      return err("Senha atual inválida.", 401);
    await exec(
      "UPDATE users SET password = ? WHERE uid = ?",
      [await bcrypt.hash(data.newPassword, 10), ctx.userUid],
    );
    return ok();
  }

  if (route === "/agencies" && method === "GET")
    return ok(await rows("SELECT * FROM agencies ORDER BY createdAt, id"));

  if (route === "/agency/settings/[id]" && method === "GET") {
    const agency = (await rows("SELECT * FROM agencies WHERE id = ? LIMIT 1", [params.id]))[0];
    return agency ? ok(agency) : err("Agência não encontrada.", 404);
  }

  if (route === "/agency/settings" && method === "POST") {
    const input = await body(req);
    const existing = input.id
      ? { id: String(input.id) }
      : (await rows("SELECT id FROM agencies ORDER BY createdAt, id LIMIT 1"))[0];
    const id = existing?.id || "default_agency";
    const allowed = [
      "name", "slogan", "logo_url", "logo_dark_url", "planning_month",
      "deadline", "deadline_pre", "deadline_final", "theme_config",
    ];
    const payload: Record<string, any> = { id };
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(input, key)) payload[key] = input[key];
    }
    if (!existing && !payload.name) payload.name = "Agency";
    const data = tablePayload(payload);
    const columns = Object.keys(data);
    const updates = columns.filter((key) => key !== "id").map((key) => `${key}=VALUES(${key})`);
    if (!updates.length) return ok({ id });
    await exec(
      `INSERT INTO agencies (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")}) ON DUPLICATE KEY UPDATE ${updates.join(",")}`,
      columns.map((key) => data[key]),
    );
    return ok({ id });
  }

  if (route === "/custom-roles" && method === "GET")
    return ok(
      await rows("SELECT * FROM custom_roles", [
        ]),
    );

  if (route === "/custom-roles" && method === "POST") {
    const data = tablePayload(await body(req));
    await exec("REPLACE INTO custom_roles SET ?", [data]);
    return ok();
  }

  if (route === "/custom-roles/[id]" && method === "DELETE") {
    await exec("DELETE FROM custom_roles WHERE id = ?", [
      params.id,
      ]);
    return ok();
  }

  if (route === "/settings/[id]" && method === "GET") {
    const result = await rows(
      "SELECT data FROM settings WHERE id = ? LIMIT 1",
      [params.id],
    );
    return ok(parseJson(result[0]?.data, {}));
  }

  if (route === "/settings/[id]" && method === "POST") {
    await exec("REPLACE INTO settings SET ?", [
      {
        id: params.id,
        data: JSON.stringify(await body(req)),
      },
    ]);
    return ok();
  }

  if (route === "/users/preferences" && method === "GET") {
    const result = await rows(
      "SELECT ui_preferences FROM users WHERE uid = ? LIMIT 1",
      [ctx.userUid],
    );
    return ok(parseJson(result[0]?.ui_preferences, {}));
  }

  if (route === "/users/preferences" && method === "POST") {
    if (!ctx.userUid) return err("Não autenticado.", 401);
    const incoming = await body(req);
    if (!incoming || typeof incoming !== "object" || Array.isArray(incoming))
      return err("Preferências inválidas.", 400);
    const patch = Object.fromEntries(
      Object.entries(incoming).filter(
        ([key]) => !["__proto__", "constructor", "prototype"].includes(key),
      ),
    );
    if (JSON.stringify(patch).length > 64 * 1024)
      return err("Preferências excedem o limite permitido.", 413);
    const connection = await getDbPool().getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.query(
        "SELECT ui_preferences FROM users WHERE uid = ? FOR UPDATE",
        [ctx.userUid],
      );
      const current = parseJson((result as any[])[0]?.ui_preferences, {});
      const next = { ...current, ...patch };
      await connection.execute(
        "UPDATE users SET ui_preferences = ? WHERE uid = ?",
        [JSON.stringify(next), ctx.userUid],
      );
      await connection.commit();
      return ok(next);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  return null;
}
