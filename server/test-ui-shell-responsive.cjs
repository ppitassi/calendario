const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require("playwright-core");

const base = String(process.env.TEST_BASE_URL || "http://127.0.0.1:3006").replace(/\/$/, "");
const executablePath = [
  process.env.CHROMIUM_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].find((candidate) => candidate && fs.existsSync(candidate));

async function noOverflow(page, label) {
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
    true,
    `${label} possui overflow horizontal.`,
  );
}

async function main() {
  assert.ok(executablePath, "Chromium não configurado.");
  const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  const pageErrors = [], criticalResponses = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 500) criticalResponses.push(`${response.status()} ${response.url()}`);
  });

  try {
    await page.goto(base, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.locator("#login-username").fill("admin");
    await page.locator("#login-password").fill("admin");
    await page.getByRole("button", { name: "Autenticar" }).click();
    await page.locator("#app-sidebar").waitFor({ state: "visible", timeout: 15000 });
    const clients = await page.evaluate(async () => (await fetch("/api/clients")).json());
    assert.ok(Array.isArray(clients) && clients.length, "É necessário ao menos um cliente para testar o planejador.");
    await page.goto(`${base}/?clientId=${encodeURIComponent(clients[0].id)}`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.locator("#app-sidebar").waitFor({ state: "visible", timeout: 15000 });
    await page.waitForTimeout(500);
    fs.mkdirSync("artifacts", { recursive: true });
    await noOverflow(page, "Home desktop");
    await page.screenshot({ path: "artifacts/ui-home-desktop.png", fullPage: true });

    await page.getByRole("button", { name: "Planejador de Calendários" }).click();
    await page.locator(".planner-calendar-pane").waitFor({ state: "visible", timeout: 15000 });
    await page.waitForTimeout(300);
    await noOverflow(page, "Planejador desktop");
    await page.screenshot({ path: "artifacts/ui-planner-desktop.png", fullPage: true });

    await page.setViewportSize({ width: 834, height: 1112 });
    await page.waitForTimeout(250);
    await noOverflow(page, "Planejador tablet");
    await page.screenshot({ path: "artifacts/ui-planner-tablet.png", fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(250);
    await noOverflow(page, "Planejador mobile");
    assert.equal(await page.getByRole("button", { name: "Abrir navegação" }).count(), 1, "Controle mobile ausente.");
    await page.screenshot({ path: "artifacts/ui-planner-mobile.png", fullPage: true });
    await page.getByRole("button", { name: "Abrir navegação" }).click();
    await page.getByRole("button", { name: "Operações" }).click();
    await page.getByRole("heading", { name: "Projetos, demandas e tarefas" }).waitFor({ timeout: 15000 });
    await noOverflow(page, "Operações mobile");
    await page.screenshot({ path: "artifacts/ui-operations-mobile.png", fullPage: true });
    assert.deepEqual(pageErrors, [], `Erros de execução: ${pageErrors.join(" | ")}`);
    assert.deepEqual(criticalResponses, [], `Respostas 5xx: ${criticalResponses.join(" | ")}`);
    console.log(JSON.stringify({ ok: true, authenticated: true, noHorizontalOverflow: true, viewports: [1440, 834, 390], screenshots: 5, operationsMobile: true }));
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
