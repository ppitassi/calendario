import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { exec, rows } from "../db";
import { ApiContext, ApiParams } from "../api-types";
import { err, ok } from "../api-response";
import { body, enrichUser, rateLimited } from "./context";
import { createMetaOAuth, finishMetaOAuth } from "../meta";

export async function handleAuthApi(
  method: string,
  route: string,
  req: NextRequest,
  params: ApiParams,
  ctx: ApiContext,
): Promise<NextResponse | null> {
  if (route === "/auth/login" && method === "POST") {
    const loginIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (await rateLimited(`login:${loginIp}`, 10, 15 * 60_000))
      return err(
        "Muitas tentativas. Aguarde antes de tentar novamente.",
        429,
      );
    const data = await body(req);
    const email = data.email || data.username;
    const password = data.password;
    const found = await rows(
      "SELECT * FROM users WHERE email = ? OR displayName = ?",
      [email, email],
    );
    const user = found[0];
    const dummyHash =
      "$2a$10$abcdefghijklmnopqrstuuCczjkjPQm7nU2EOVkP/4J3JdxkrALm";
    const valid = await bcrypt.compare(
      password || "",
      user?.password || dummyHash,
    );
    if (!user || !valid) return err("Credenciais invÃ¡lidas.", 401);
    const sessionToken = randomBytes(32).toString("hex");
    const sessionHours = data.rememberMe === false ? 12 : 24 * 30;
    const sessionIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "local";
    const approximateLocation = {
      city: req.headers.get("x-vercel-ip-city") || null,
      region: req.headers.get("x-vercel-ip-country-region") || null,
      country: req.headers.get("x-vercel-ip-country") || null,
    };
    await exec(
      "UPDATE users SET session_token = ?, session_expires_at = DATE_ADD(NOW(), INTERVAL ? HOUR), session_started_at = NOW(), last_activity_at = NOW(), foreground_seconds = 0, last_ip = ?, last_location = ? WHERE uid = ?",
      [
        sessionToken,
        sessionHours,
        sessionIp,
        JSON.stringify(approximateLocation),
        user.uid,
      ],
    );
    delete user.password;
    const response = ok({ success: true, user: await enrichUser(user) });
    const secureCookie =
      process.env.NODE_ENV === "production" &&
      process.env.COOKIE_SECURE !== "false";
    response.cookies.set("cp_session", sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookie,
      path: "/",
      ...(data.rememberMe === false ? {} : { maxAge: sessionHours * 60 * 60 }),
    });
    return response;
  }

  if (route === "/auth/validate-token" && method === "POST") {
    const suppliedToken = req.cookies.get("cp_session")?.value;
    const found = await rows(
      "SELECT * FROM users WHERE session_token = ? AND session_expires_at > NOW()",
      [suppliedToken],
    );
    const user = found[0];
    if (!user) return err("Token invÃ¡lido.", 401);
    delete user.password;
    return ok({ success: true, user: await enrichUser(user) });
  }

  if (route === "/auth/activity" && method === "POST") {
    if (!ctx.userUid) return err("NÃ£o autenticado.", 401);
    const data = await body(req);
    const seconds = Math.max(
      0,
      Math.min(Number(data.foregroundSeconds) || 0, 120),
    );
    const activityIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "local";
    const location = JSON.stringify({
      city: req.headers.get("x-vercel-ip-city") || null,
      region: req.headers.get("x-vercel-ip-country-region") || null,
      country: req.headers.get("x-vercel-ip-country") || null,
      timezone: String(data.timezone || "").slice(0, 100),
      locale: String(data.locale || "").slice(0, 30),
    });
    await exec(
      "UPDATE users SET last_activity_at = NOW(), foreground_seconds = foreground_seconds + ?, last_ip = ?, last_location = ? WHERE uid = ?",
      [seconds, activityIp, location, ctx.userUid],
    );
    return ok();
  }

  if (route === "/auth/logout" && method === "POST") {
    if (ctx.userUid)
      await exec(
        "UPDATE users SET session_token = NULL, session_expires_at = NULL, last_activity_at = NOW() WHERE uid = ?",
        [ctx.userUid],
      );
    const response = ok();
    const secureCookie =
      process.env.NODE_ENV === "production" &&
      process.env.COOKIE_SECURE !== "false";
    response.cookies.set("cp_session", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookie,
      path: "/",
      maxAge: 0,
    });
    return response;
  }

  if (route === "/auth/social/login/[platform]" && method === "GET") {
    if (!ctx.isAuthenticated || !ctx.userUid)
      return err("NÃ£o autenticado.", 401);
    if (!["instagram", "facebook", "meta"].includes(params.platform))
      return err("IntegraÃ§Ã£o nÃ£o suportada.", 400);
    const clientId = new URL(req.url).searchParams.get("clientId") || "";
    const origin =
      process.env.APP_URL ||
      `${req.headers.get("x-forwarded-proto") || new URL(req.url).protocol.replace(":", "")}://${req.headers.get("x-forwarded-host") || req.headers.get("host") || new URL(req.url).host}`;
    return NextResponse.redirect(
      await createMetaOAuth({
        
        userUid: ctx.userUid,
        clientId,
        origin,
      }),
    );
  }

  if (route === "/auth/callback/[platform]" && method === "GET") {
    const url = new URL(req.url);
    const origin =
      process.env.APP_URL ||
      `${req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "")}://${req.headers.get("x-forwarded-host") || url.host}`;
    const result = await finishMetaOAuth({
      state: url.searchParams.get("state") || "",
      code: url.searchParams.get("code") || "",
      origin,
    });
    const payload = JSON.stringify({
      platform: "instagram",
      connectionId: result.connectionId,
      token: result.connectionId,
      accounts: result.accounts,
      diagnostic: result.diagnostic,
    }).replace(/</g, "\\u003c");
    return new NextResponse(
      `<!doctype html><meta charset="utf-8"><script>window.opener&&window.opener.postMessage('oauth-payload:'+${JSON.stringify(payload)},${JSON.stringify(origin)});window.close()</script><p>ConexÃ£o concluÃ­da. Esta janela pode ser fechada.</p>`,
      {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
        },
      },
    );
  }

  return null;
}
