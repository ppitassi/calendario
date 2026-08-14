require("dotenv").config({ path: ".env.local", quiet: true });
const assert = require("node:assert/strict");
const fs = require("node:fs");
const mysql = require("mysql2/promise");
const { chromium } = require("playwright-core");

const base = String(process.env.TEST_BASE_URL || "http://127.0.0.1:3006").replace(/\/$/, "");
const dbConfig = process.env.DATABASE_URL || { host: process.env.DB_HOST || "127.0.0.1", port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME };

async function assertNoHorizontalOverflow(page, label) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true, `${label} possui overflow horizontal.`);
}

async function main() {
  const db = await mysql.createConnection(dbConfig);
  const [rows] = await db.query("SELECT u.session_token,c.id clientId,DATE_FORMAT(p.date,'%Y-%m') month FROM users u JOIN clients c JOIN posts p ON p.clientId=c.id WHERE u.session_token IS NOT NULL AND u.session_expires_at>NOW() AND u.role IN ('admin','gerente','atendimento') ORDER BY p.date DESC LIMIT 1");
  assert.ok(rows[0], "É necessária uma sessão válida para a regressão responsiva.");
  const executablePath = [process.env.CHROMIUM_PATH, "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"].find(candidate => candidate && fs.existsSync(candidate));
  assert.ok(executablePath, "Chromium não configurado.");
  const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  const pageErrors = [];
  const criticalResponses = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("response", response => {
    const kind = response.request().resourceType();
    if (response.status() >= 400 && ["document", "script", "stylesheet"].includes(kind)) criticalResponses.push(`${response.status()} ${response.url()}`);
  });

  try {
    await context.addCookies([{ name: "cp_session", value: String(rows[0].session_token), url: base, httpOnly: true, sameSite: "Lax" }]);
    await page.goto(`${base}?clientId=${encodeURIComponent(rows[0].clientId)}&month=${encodeURIComponent(rows[0].month)}`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.locator("#app-sidebar").waitFor({ state: "visible", timeout: 15000 });
    fs.mkdirSync("artifacts", { recursive: true });
    await assertNoHorizontalOverflow(page, "Home desktop");
    await page.screenshot({ path: "artifacts/ui-home-desktop.png", fullPage: true });

    await page.locator('#app-sidebar button[aria-label="Planejador de Calendários"]').click();
    await page.locator(".planner-calendar-pane").waitFor({ state: "visible", timeout: 15000 });
    assert.equal(await page.locator(".planner-context-header").count(), 1, "O Planejador não possui um único header contextual.");
    assert.equal(await page.locator(".planner-context-header").getByText("Planejador de Calendários", { exact: true }).count(), 0, "O título redundante reapareceu abaixo do header principal.");
    await assertNoHorizontalOverflow(page, "Planejador desktop");
    await page.screenshot({ path: "artifacts/ui-planner-desktop.png", fullPage: true });

    await page.setViewportSize({ width: 834, height: 1112 });
    await page.waitForTimeout(250);
    await assertNoHorizontalOverflow(page, "Planejador tablet");
    await page.screenshot({ path: "artifacts/ui-planner-tablet.png", fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(250);
    await assertNoHorizontalOverflow(page, "Planejador mobile");
    assert.equal(await page.getByRole("button", { name: "Abrir navegação" }).count(), 1, "Controle de navegação mobile ausente.");
    await page.screenshot({ path: "artifacts/ui-planner-mobile.png", fullPage: true });

    assert.deepEqual(pageErrors, [], `Erros de execução: ${pageErrors.join(" | ")}`);
    assert.deepEqual(criticalResponses, [], `Recursos críticos indisponíveis: ${criticalResponses.join(" | ")}`);
    console.log(JSON.stringify({ ok: true, headerUnified: true, noHorizontalOverflow: true, viewports: [1440, 834, 390], screenshots: 4 }));
  } finally {
    await browser.close();
    await db.end();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
