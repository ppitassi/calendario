import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { exec, parseJson, rows } from "../db";
import { ApiContext, ApiParams } from "../api-types";
import { err, ok } from "../api-response";
import { body } from "./context";

const roleAlias: Record<string, string> = {
  ADMIN: "admin",
  DIRECTOR: "diretoria",
  MANAGEMENT: "gerente",
  ACCOUNT: "atendimento",
  SOCIAL_MEDIA: "socialmedia",
  DESIGNER: "designer",
  VIDEOMAKER: "videomaker",
  PHOTOGRAPHER: "fotografo",
  COPYWRITER: "copywriter",
};
const roleKey = (value: unknown) =>
  ({
    admin: "ADMIN",
    diretoria: "DIRECTOR",
    gerente: "MANAGEMENT",
    atendimento: "ACCOUNT",
    socialmedia: "SOCIAL_MEDIA",
    designer: "DESIGNER",
    videomaker: "VIDEOMAKER",
    fotografo: "PHOTOGRAPHER",
    copywriter: "COPYWRITER",
  })[String(value || "").toLowerCase()] ||
  String(value || "ACCOUNT").toUpperCase();
async function userView(id: string) {
  const user = (
    await rows("SELECT * FROM users WHERE id=? AND deleted_at IS NULL", [id])
  )[0];
  if (!user) return null;
  const userRoles = await rows(
    `SELECT r.id,r.key_name,r.name FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=? ORDER BY r.system_role DESC,r.name`,
    [id],
  );
  const settings = (
    await rows("SELECT settings_json FROM user_settings WHERE user_id=?", [id])
  )[0];
  return {
    uid: user.id,
    id: user.id,
    email: user.email,
    displayName: user.name,
    name: user.name,
    photoURL: user.avatar,
    avatar: user.avatar,
    whatsapp: user.phone,
    phoneNumber: user.phone,
    birthday: user.birthday,
    githubUsername: user.github_username,
    portfolioUrl: user.portfolio_url,
    active: Boolean(user.active),
    role:
      roleAlias[userRoles[0]?.key_name] ||
      String(userRoles[0]?.key_name || "").toLowerCase(),
    roles: userRoles,
    ui_preferences: parseJson(settings?.settings_json, {}),
  };
}
async function audit(
  actorId: string | null | undefined,
  eventType: string,
  entityType: string,
  entityId: string,
  data: unknown = null,
) {
  await exec(
    "INSERT INTO audit_logs (actor_id,event_type,entity_type,entity_id,data_json) VALUES (?,?,?,?,?)",
    [
      actorId || null,
      eventType,
      entityType,
      entityId,
      data == null ? null : JSON.stringify(data),
    ],
  );
}

export async function handleAdminApi(
  method: string,
  route: string,
  req: NextRequest,
  params: ApiParams,
  ctx: ApiContext,
): Promise<NextResponse | null> {
  if (
    (route === "/team/members" && method === "GET") ||
    (route === "/users" && method === "GET")
  ) {
    const found = await rows(
      "SELECT id FROM users WHERE deleted_at IS NULL ORDER BY name,email",
    );
    return ok(
      (await Promise.all(found.map((entry) => userView(entry.id)))).filter(
        Boolean,
      ),
    );
  }
  if (route === "/users/me" && method === "GET") {
    const user = ctx.userUid ? await userView(ctx.userUid) : null;
    return user
      ? ok(user)
      : err("Usuário não encontrado.", 404, "PROFILE_NOT_FOUND");
  }
  if (route === "/users/me" && method === "PATCH") {
    if (!ctx.userUid) return err("Sessão expirada.", 401);
    const input = await body(req);
    const name = String(input.displayName || "").trim();
    if (!name || name.length > 255) return err("Nome inválido.", 422);
    const birthday = input.birthday ? String(input.birthday) : null;
    if (birthday && !/^\d{4}-\d{2}-\d{2}$/.test(birthday))
      return err("Data inválida.", 422);
    let portfolio = input.portfolioUrl
      ? String(input.portfolioUrl).trim()
      : null;
    if (portfolio && !/^https:\/\//i.test(portfolio))
      portfolio = `https://${portfolio}`;
    await exec(
      "UPDATE users SET name=?,birthday=?,github_username=?,portfolio_url=?,avatar=? WHERE id=?",
      [
        name,
        birthday,
        input.githubUsername || null,
        portfolio,
        input.photoURL || null,
        ctx.userUid,
      ],
    );
    return ok(await userView(ctx.userUid));
  }
  if (route === "/users/[uid]" && method === "GET") {
    const user = await userView(params.uid);
    return user ? ok(user) : err("Usuário não encontrado.", 404);
  }
  if (route === "/users" && method === "POST") {
    const input = await body(req);
    const id = String(input.uid || input.id || randomUUID());
    const existing = (
      await rows("SELECT id FROM users WHERE id=? OR email=?", [
        id,
        input.email,
      ])
    )[0];
    if (!existing && String(input.password || "").length < 8)
      return err("Defina uma senha com pelo menos 8 caracteres.", 422);
    if (existing) {
      const values = [
        String(input.displayName || input.name || "").trim(),
        input.email,
        input.photoURL || input.avatar || null,
        input.whatsapp || input.phoneNumber || null,
        input.active !== false,
      ];
      let sql = "UPDATE users SET name=?,email=?,avatar=?,phone=?,active=?";
      if (input.password) {
        sql += ",password_hash=?";
        values.push(await bcrypt.hash(String(input.password), 12));
      }
      values.push(existing.id);
      await exec(`${sql} WHERE id=?`, values);
    } else
      await exec(
        "INSERT INTO users (id,name,email,password_hash,avatar,phone,active) VALUES (?,?,?,?,?,?,?)",
        [
          id,
          String(input.displayName || input.name || input.email).trim(),
          input.email,
          await bcrypt.hash(String(input.password), 12),
          input.photoURL || input.avatar || null,
          input.whatsapp || input.phoneNumber || null,
          input.active !== false,
        ],
      );
    const targetId = existing?.id || id;
    const selectedRoles = Array.isArray(input.roles)
      ? input.roles.map((entry: any) => entry.key_name || entry.key || entry)
      : [roleKey(input.role)];
    await exec("DELETE FROM user_roles WHERE user_id=?", [targetId]);
    for (const key of selectedRoles) {
      const role = (
        await rows("SELECT id FROM roles WHERE key_name=?", [roleKey(key)])
      )[0];
      if (role)
        await exec(
          "INSERT IGNORE INTO user_roles (user_id,role_id,assigned_by) VALUES (?,?,?)",
          [targetId, role.id, ctx.userUid],
        );
    }
    await audit(
      ctx.userUid,
      existing ? "USER_UPDATED" : "USER_CREATED",
      "USER",
      targetId,
      { roles: selectedRoles },
    );
    return ok({ id: targetId });
  }
  if (route === "/users/[uid]" && method === "DELETE") {
    if (params.uid === ctx.userUid)
      return err("Não é possível desativar o próprio usuário.", 422);
    await exec("UPDATE users SET active=FALSE,deleted_at=NOW() WHERE id=?", [
      params.uid,
    ]);
    await exec(
      "UPDATE user_sessions SET revoked_at=NOW() WHERE user_id=? AND revoked_at IS NULL",
      [params.uid],
    );
    await audit(ctx.userUid, "USER_DEACTIVATED", "USER", params.uid);
    return ok({ success: true });
  }
  if (route === "/users/change-password" && method === "POST") {
    if (!ctx.userUid) return err("Não autenticado.", 401);
    const input = await body(req);
    if (String(input.newPassword || "").length < 8)
      return err("A nova senha deve ter pelo menos 8 caracteres.", 422);
    const user = (
      await rows("SELECT password_hash FROM users WHERE id=?", [ctx.userUid])
    )[0];
    if (
      !user ||
      !(await bcrypt.compare(
        String(input.currentPassword || ""),
        user.password_hash,
      ))
    )
      return err("Senha atual inválida.", 401);
    await exec("UPDATE users SET password_hash=? WHERE id=?", [
      await bcrypt.hash(String(input.newPassword), 12),
      ctx.userUid,
    ]);
    return ok({ success: true });
  }
  if (route === "/agencies" && method === "GET") {
    const agency = (
      await rows("SELECT * FROM agency_profile WHERE singleton_id=1")
    )[0];
    return ok(
      agency
        ? [
            {
              id: "agency",
              ...agency,
              logo_url: agency.logo,
              logo_dark_url: agency.logo_dark,
              theme_config: parseJson(agency.theme_json, {}),
            },
          ]
        : [],
    );
  }
  if (
    (route === "/agency/settings" && method === "POST") ||
    (route === "/agency/settings/[id]" && method === "GET")
  ) {
    if (method === "GET") {
      const agency = (
        await rows("SELECT * FROM agency_profile WHERE singleton_id=1")
      )[0];
      return agency
        ? ok({
            id: "agency",
            ...agency,
            logo_url: agency.logo,
            logo_dark_url: agency.logo_dark,
            theme_config: parseJson(agency.theme_json, {}),
          })
        : err("Agência não encontrada.", 404);
    }
    const input = await body(req);
    await exec(
      `INSERT INTO agency_profile (singleton_id,name,slogan,logo,logo_dark,email,phone,website,timezone,planning_month,deadline,deadline_pre,deadline_final,theme_json) VALUES (1,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),slogan=VALUES(slogan),logo=VALUES(logo),logo_dark=VALUES(logo_dark),email=VALUES(email),phone=VALUES(phone),website=VALUES(website),timezone=VALUES(timezone),planning_month=VALUES(planning_month),deadline=VALUES(deadline),deadline_pre=VALUES(deadline_pre),deadline_final=VALUES(deadline_final),theme_json=VALUES(theme_json)`,
      [
        input.name || "Agência",
        input.slogan || null,
        input.logo_url || null,
        input.logo_dark_url || null,
        input.email || null,
        input.phone || null,
        input.website || null,
        input.timezone || "America/Sao_Paulo",
        input.planning_month || null,
        input.deadline || null,
        input.deadline_pre || null,
        input.deadline_final || null,
        JSON.stringify(input.theme_config || {}),
      ],
    );
    await audit(ctx.userUid, "AGENCY_PROFILE_UPDATED", "AGENCY", "agency");
    return ok({ id: "agency" });
  }
  if (
    (route === "/custom-roles" && method === "GET") ||
    (route === "/roles" && method === "GET")
  ) {
    const result = await rows("SELECT * FROM roles ORDER BY name");
    for (const role of result)
      role.permissions = (
        await rows(
          "SELECT p.key_name FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id WHERE rp.role_id=? ORDER BY p.key_name",
          [role.id],
        )
      ).map((entry) => entry.key_name);
    return ok(
      result.map((role) => ({
        id: role.id,
        key: role.key_name,
        label: role.name,
        permissions: role.permissions,
      })),
    );
  }
  if (route === "/custom-roles" && method === "POST") {
    const input = await body(req);
    const id = String(input.id || randomUUID());
    const key = String(input.key || input.key_name || input.label || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_");
    await exec(
      "INSERT INTO roles (id,key_name,name,description) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),description=VALUES(description)",
      [id, key, input.label || input.name || key, input.description || null],
    );
    if (Array.isArray(input.permissions)) {
      await exec("DELETE FROM role_permissions WHERE role_id=?", [id]);
      for (const permission of input.permissions) {
        const found = (
          await rows("SELECT id FROM permissions WHERE key_name=?", [
            permission,
          ])
        )[0];
        if (found)
          await exec(
            "INSERT IGNORE INTO role_permissions (role_id,permission_id) VALUES (?,?)",
            [id, found.id],
          );
      }
    }
    await audit(ctx.userUid, "ROLE_SAVED", "ROLE", id, {
      key,
      permissions: input.permissions || [],
    });
    return ok({ id });
  }
  if (route === "/custom-roles/[id]" && method === "DELETE") {
    const role = (
      await rows("SELECT system_role FROM roles WHERE id=?", [params.id])
    )[0];
    if (role?.system_role)
      return err("Role de sistema não pode ser removida.", 422);
    await exec("DELETE FROM roles WHERE id=?", [params.id]);
    await audit(ctx.userUid, "ROLE_DELETED", "ROLE", params.id);
    return ok({ success: true });
  }
  if (route === "/settings/[id]" && method === "GET") {
    const result = (
      await rows("SELECT value_json FROM system_settings WHERE key_name=?", [
        params.id,
      ])
    )[0];
    return ok(parseJson(result?.value_json, {}));
  }
  if (route === "/settings/[id]" && method === "POST") {
    await exec(
      "INSERT INTO system_settings (key_name,value_json,updated_by) VALUES (?,?,?) ON DUPLICATE KEY UPDATE value_json=VALUES(value_json),updated_by=VALUES(updated_by)",
      [params.id, JSON.stringify(await body(req)), ctx.userUid],
    );
    await audit(
      ctx.userUid,
      "SYSTEM_SETTING_UPDATED",
      "SYSTEM_SETTING",
      params.id,
    );
    return ok({ success: true });
  }
  if (route === "/users/preferences" && method === "GET") {
    const result = (
      await rows("SELECT settings_json FROM user_settings WHERE user_id=?", [
        ctx.userUid,
      ])
    )[0];
    return ok(parseJson(result?.settings_json, {}));
  }
  if (route === "/users/preferences" && method === "POST") {
    if (!ctx.userUid) return err("Não autenticado.", 401);
    const patch = await body(req);
    const current = parseJson(
      (
        await rows("SELECT settings_json FROM user_settings WHERE user_id=?", [
          ctx.userUid,
        ])
      )[0]?.settings_json,
      {},
    );
    const next = { ...current, ...patch };
    await exec(
      "INSERT INTO user_settings (user_id,settings_json) VALUES (?,?) ON DUPLICATE KEY UPDATE settings_json=VALUES(settings_json)",
      [ctx.userUid, JSON.stringify(next)],
    );
    return ok(next);
  }
  return null;
}
