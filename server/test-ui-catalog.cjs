const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright-core");

const base = String(process.env.TEST_BASE_URL || "http://127.0.0.1:3006").replace(/\/$/, "");
const executablePath = [
  process.env.CHROMIUM_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].find(candidate => candidate && fs.existsSync(candidate));

async function main() {
  assert.ok(executablePath, "Chromium não configurado para o teste do catálogo de UI.");
  const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });

  try {
    await page.goto(`${base}/ui-catalog`, { waitUntil: "networkidle", timeout: 30000 });
    await page.getByRole("heading", { name: "Catálogo de primitives" }).waitFor();
    assert.equal(await page.locator("section[aria-label='Tema claro'],section[aria-label='Tema escuro']").count(), 2, "Os dois temas não foram renderizados.");
    assert.equal(await page.locator("button[aria-busy='true']:disabled").count(), 2, "O estado loading do Button está inconsistente.");
    assert.ok(await page.locator("button:disabled").count() >= 4, "Estados disabled não foram expostos.");

    const invalid = page.locator("input[aria-invalid='true']").first();
    assert.ok(await invalid.getAttribute("aria-describedby"), "Campo inválido sem relação ARIA com o erro.");
    assert.equal(await page.locator("select").count(), 2, "Select simples deixou de usar o elemento nativo.");

    const dropdown = page.getByRole("button", { name: "Dropdown" }).first();
    await dropdown.focus();
    await page.keyboard.press("ArrowDown");
    const menu = page.getByRole("menu", { name: "Visões disponíveis" });
    await menu.waitFor({ state: "visible" });
    await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "menuitemradio");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("role")), "menuitemradio", "Dropdown não moveu foco para uma opção.");
    await page.keyboard.press("End");
    assert.equal((await page.evaluate(() => document.activeElement?.textContent))?.trim(), "Editor", "End não focou a última opção habilitada.");
    await page.keyboard.press("Escape");
    await menu.waitFor({ state: "detached" });
    assert.equal(await dropdown.evaluate(element => element === document.activeElement), true, "Dropdown não devolveu foco ao gatilho.");

    const tooltipTrigger = page.getByRole("button", { name: "Notificações" }).first();
    await tooltipTrigger.focus();
    await page.getByRole("tooltip").waitFor({ state: "visible" });
    assert.ok(await tooltipTrigger.getAttribute("aria-describedby"), "Tooltip não relacionou conteúdo e gatilho.");

    const modalTrigger = page.getByRole("button", { name: "Abrir modal" }).first();
    await modalTrigger.click();
    const dialog = page.getByRole("dialog", { name: "Modal Liquid Glass" });
    await dialog.waitFor({ state: "visible" });
    await page.waitForFunction(() => document.querySelector('[role="dialog"]')?.contains(document.activeElement));
    assert.equal(await dialog.evaluate(element => element.contains(document.activeElement)), true, "Modal não capturou o foco.");
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
    assert.equal(await modalTrigger.evaluate(element => element === document.activeElement), true, "Modal não devolveu foco ao gatilho.");

    const artifacts = path.resolve("artifacts");
    fs.mkdirSync(artifacts, { recursive: true });
    await page.screenshot({ path: path.join(artifacts, "ui-catalog-desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(artifacts, "ui-catalog-mobile.png"), fullPage: true });

    assert.deepEqual(errors, [], `Erros no catálogo: ${errors.join(" | ")}`);
    console.log(JSON.stringify({ ok: true, themes: 2, nativeSelect: true, dropdownKeyboard: true, tooltipFocus: true, modalFocus: true, screenshots: 2 }));
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
