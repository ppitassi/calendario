/**
 * Executa a prova de fumaça do fluxo completo: autenticação, preparação de um
 * calendário isolado, sincronização editor/prévia e abertura da apresentação.
 */

const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright-core");
const { loadEnvironment } = require("./load-env.cjs");

// O teste reutiliza o mesmo arquivo de ambiente do servidor quando ele foi informado.
loadEnvironment({
  production: process.env.NODE_ENV === "production",
  required: Boolean(process.env.PRESENTATION_STUDIO_ENV_FILE),
});

const baseUrl = String(process.env.STUDIO_TEST_BASE_URL || "http://localhost:3010").replace(/\/$/, "");
const username = String(process.env.STUDIO_TEST_USERNAME || process.env.STUDIO_ADMIN_USERNAME || "").trim();
const password = String(process.env.STUDIO_TEST_PASSWORD || process.env.STUDIO_ADMIN_PASSWORD || "");

// O teste grava uma fixture: por padrão ele se recusa a tocar um host remoto.
const testHost = new URL(baseUrl).hostname;
if (!["localhost", "127.0.0.1", "::1"].includes(testHost)
  && process.env.STUDIO_TEST_ALLOW_REMOTE !== "1") {
  throw new Error(
    "STUDIO_TEST_BASE_URL deve apontar para localhost. Para um ambiente descartável remoto, defina STUDIO_TEST_ALLOW_REMOTE=1.",
  );
}

/** Localiza um Chromium já instalado; `playwright-core` não baixa binários no servidor. */
function findBrowserExecutable() {
  const explicit = String(process.env.STUDIO_BROWSER_EXECUTABLE_PATH || "").trim();
  const candidates = [
    explicit,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate));
}

/** Conduz o fluxo crítico e encerra com erro se qualquer evidência esperada faltar. */
async function main() {
  const executablePath = findBrowserExecutable();
  if (!executablePath) {
    throw new Error(
      "Chrome/Edge/Chromium não encontrado. Defina STUDIO_BROWSER_EXECUTABLE_PATH.",
    );
  }

  // Usa o navegador do host para manter o pacote de produção pequeno e auditável.
  const browser = await chromium.launch({ executablePath, headless: true });
  const artifactsDirectory = path.resolve(__dirname, "../artifacts");
  fs.mkdirSync(artifactsDirectory, { recursive: true });

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];

    // Erros do console e exceções da página reprovam o teste mesmo quando a tela aparece.
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

    // Um banco limpo exige login; uma sessão já válida pula naturalmente este bloco.
    const loginButton = page.getByRole("button", { name: /Entrar no Studio/i });
    await page.locator(".submitBtn, main").first().waitFor();
    if (await loginButton.isVisible().catch(() => false)) {
      if (!username || !password) {
        throw new Error(
          "Informe STUDIO_TEST_USERNAME/STUDIO_TEST_PASSWORD ou as credenciais STUDIO_ADMIN_*.",
        );
      }
      await page.getByLabel("Usuário").fill(username);
      await page.getByLabel("Senha").fill(password);
      const authenticated = page.waitForResponse((response) =>
        response.url().endsWith("/api/auth/login")
        && response.request().method() === "POST",
      );
      await loginButton.click();
      const loginResponse = await authenticated;
      if (!loginResponse.ok()) {
        throw new Error(`Falha de autenticação no teste: HTTP ${loginResponse.status()}.`);
      }
      if (new URL(baseUrl).protocol === "http:") {
        // Em produção o cookie é `Secure`; no smoke test local sem TLS, injeta
        // apenas o par nome/valor nas requisições deste contexto descartável.
        const setCookie = await loginResponse.headerValue("set-cookie");
        const cookie = setCookie?.split(";", 1)[0];
        if (!cookie) throw new Error("A resposta de login não criou a sessão esperada.");
        const separator = cookie.indexOf("=");
        const cookieName = cookie.slice(0, separator);
        await page.context().clearCookies({ name: cookieName });
        await page.context().addCookies([{
          name: cookieName,
          value: cookie.slice(separator + 1),
          url: baseUrl,
          httpOnly: true,
          secure: false,
          sameSite: "Lax",
        }]);
      }
      await page.locator("main").waitFor();
    }

    const authenticatedUser = await page.evaluate(async () => {
      const response = await fetch("/api/auth/me");
      return response.json();
    });
    if (!authenticatedUser.user) {
      const cookies = await page.context().cookies();
      throw new Error(JSON.stringify({
        message: "A sessão do teste não foi aceita.",
        pageUrl: page.url(),
        cookies: cookies.map(({ name, domain, path, secure }) => ({ name, domain, path, secure })),
      }));
    }

    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Cria/reutiliza um cliente exclusivo do teste e garante um item editável.
    const fixture = await page.evaluate(async ({ month }) => {
      /** Faz uma chamada autenticada e transforma qualquer resposta inválida em falha do teste. */
      async function requestJson(url, init) {
        const response = await fetch(url, init);
        const text = await response.text();
        const data = text ? JSON.parse(text) : {};
        if (!response.ok) {
          throw new Error(`${init?.method || "GET"} ${url}: ${data.error || response.status}`);
        }
        return data;
      }

      const listed = await requestJson(`/api/clients?month=${month}`);
      let client = listed.clients?.find((entry) => entry.name === "Validação automatizada");
      if (!client) {
        const created = await requestJson("/api/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Validação automatizada",
            segment: "Teste de fumaça",
            accent: "#e3002f",
          }),
        });
        client = created.client;
      }

      const ensured = await requestJson("/api/calendars/ensure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: client.id, month }),
      });
      const calendarId = ensured.calendar.id;
      await requestJson(`/api/calendars/${calendarId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              id: crypto.randomUUID(),
              date: `${month}-01`,
              title: "Publicação de validação",
              type: "Feed",
              status: "Ideia",
              channel: "Instagram",
              profile: "@validacao",
            },
          ],
        }),
      });

      localStorage.setItem("cp:active-client-id", client.id);
      localStorage.setItem("cp:active-calendar-id", calendarId);
      localStorage.setItem("cp:active-month", month);
      localStorage.setItem("cp:active-screen", "planner");
      return { clientId: client.id, calendarId };
    }, { month });

    await page.reload({ waitUntil: "domcontentloaded" });
    const title = page.locator(".documentTitle");
    await title.waitFor();

    // A edição deve chegar ao SQLite e à prévia que compartilha o mesmo estado.
    const saved = page.waitForResponse((response) =>
      response.url().includes(`/api/calendars/${fixture.calendarId}`)
      && response.request().method() === "PUT"
      && response.ok(),
    );
    await title.fill("Título validado no editor");
    await saved;
    const preview = page.locator(".feedCopy", { hasText: "Título validado no editor" });
    await preview.waitFor();
    await page.screenshot({
      path: path.join(artifactsDirectory, "verified-planner.png"),
      fullPage: true,
    });

    // A segunda captura comprova a transição até a apresentação e a ausência de overlay de erro.
    await page.locator(".appHeader .presentButton").click();
    await page.getByText("Apresentação do Calendário de Posts", { exact: true }).waitFor();
    await page.getByRole("heading", { name: "Postagens do Mês", exact: true }).waitFor();
    await page.getByRole("button", { name: "Fechar apresentação", exact: true }).waitFor();
    await page.getByText("Título validado no editor", { exact: true }).first().waitFor();
    const overlay = await page
      .locator("[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay")
      .count();
    await page.screenshot({
      path: path.join(artifactsDirectory, "verified-presentation.png"),
      fullPage: true,
    });

    if (overlay || errors.length) {
      const body = (await page.locator("body").innerText()).slice(0, 500);
      throw new Error(JSON.stringify({ overlay, errors, body }));
    }

    console.log(JSON.stringify({
      ok: true,
      planner: true,
      previewSync: true,
      presentation: true,
      consoleErrors: 0,
    }));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
