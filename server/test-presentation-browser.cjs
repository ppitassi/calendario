require("dotenv").config({ path: ".env.local", quiet: true });
const assert = require("node:assert/strict");
const mysql = require("mysql2/promise");
const { chromium } = require("playwright-core");
const fs = require("node:fs");

const base = String(process.env.TEST_BASE_URL || process.env.INTERNAL_APP_URL || process.env.APP_URL || "http://127.0.0.1:3006").replace(/\/$/, "");
const dbConfig = process.env.DATABASE_URL || { host: process.env.DB_HOST || "127.0.0.1", port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME };

async function main() {
  const db = await mysql.createConnection(dbConfig);
  const [rows] = await db.query("SELECT u.session_token,c.id clientId,DATE_FORMAT(p.date,'%Y-%m') month FROM users u JOIN clients c JOIN posts p ON p.clientId=c.id WHERE u.session_token IS NOT NULL AND u.session_expires_at>NOW() AND u.role IN ('admin','gerente','atendimento') ORDER BY p.date DESC LIMIT 1");
  assert.ok(rows[0], "É necessária uma sessão válida com planejamento para o teste de navegador.");
  const executablePath = [process.env.CHROMIUM_PATH, "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"].find(candidate => candidate && fs.existsSync(candidate));
  assert.ok(executablePath, "Chromium não configurado para o teste de navegador.");
  const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  console.log("browser:started");
  const context = await browser.newContext();
  const errors = [];
  const failedResponses = [];
  try {
    await context.addCookies([{ name: "cp_session", value: String(rows[0].session_token), url: base, httpOnly: true, sameSite: "Lax" }]);
    const page = await context.newPage();
    const homeFailedResponses = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    page.on("response", response => { if (response.status() >= 400) homeFailedResponses.push(`${response.status()} ${response.url()}`); });
    console.log("browser:home");
    await page.goto(`${base}?clientId=${encodeURIComponent(rows[0].clientId)}&month=${encodeURIComponent(rows[0].month)}`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.locator("body").waitFor({ state: "visible", timeout: 10000 });
    await page.waitForFunction(() => document.body.innerText.trim().length > 20, null, { timeout: 15000 }).catch(() => undefined);
    if ((await page.locator("body").innerText()).trim().length <= 20) console.error("browser:blank", { url: page.url(), html: (await page.content()).slice(0, 1000), errors });
    assert.ok((await page.locator("body").innerText()).trim().length > 20, "A aplicação abriu em branco.");
    assert.equal(await page.locator("[data-nextjs-dialog],.vite-error-overlay,#webpack-dev-server-client-overlay").count(), 0, "Overlay de erro encontrado.");
    const sidebarButtons=page.locator("#app-sidebar button:not(.sidebar-dock-keyboard)");await page.locator("#app-sidebar").waitFor({state:"visible",timeout:10000});assert.ok(await sidebarButtons.count()>0,"A sidebar não apresentou destinos.");const missingTooltips=await sidebarButtons.evaluateAll(buttons=>buttons.filter(button=>!button.hasAttribute("data-sidebar-tooltip")&&!button.closest("[role='dialog']")).map(button=>button.getAttribute("aria-label")||button.textContent));assert.deepEqual(missingTooltips,[],`Itens sem tooltip: ${missingTooltips.join(", ")}`);const firstTooltip=page.locator("#app-sidebar [data-sidebar-tooltip]").first();await firstTooltip.hover();await page.waitForTimeout(400);const tooltipVisible=Number(await firstTooltip.evaluate(element=>getComputedStyle(element,"::after").opacity));assert.ok(tooltipVisible>.9,"Tooltip não ficou visível no hover.");
    const plannerLink=page.locator('#app-sidebar button[aria-label="Planejador de Calendários"]');await plannerLink.waitFor({state:"visible",timeout:10000});await plannerLink.click();const calendarPane=page.locator(".planner-calendar-pane");await calendarPane.waitFor({state:"visible",timeout:10000});const plannerHeader=page.locator(".planner-context-header");assert.ok(!(await plannerHeader.innerText()).includes("Planejador de Calendários"),"O título redundante permaneceu no header.");assert.equal(await page.getByText("Modo Foco",{exact:true}).count(),0,"O Modo Foco ainda está visível.");assert.equal(await calendarPane.locator("[data-planning-workflow]").count(),0,"O aviso de workflow permaneceu no calendário.");await plannerHeader.locator("[data-planning-workflow]").waitFor({state:"visible",timeout:10000});assert.equal(await calendarPane.locator("details").count(),0,"A configuração semanal ainda usa um pop-up/details.");assert.ok(await calendarPane.locator("#weekly-calendar-title").count(),"Configuração semanal inline ausente.");assert.equal(await calendarPane.evaluate(pane=>{const calendar=pane.querySelector("#planner-calendar-title")?.closest("section");return calendar?.nextElementSibling?.hasAttribute("data-calendar-tools")}),true,"As ferramentas não estão imediatamente abaixo do calendário.");const expand=calendarPane.getByRole("button",{name:"Expandir calendário"});await expand.click();assert.equal(await calendarPane.getAttribute("data-calendar-expanded"),"true");await calendarPane.getByRole("button",{name:"Recolher calendário expandido"}).waitFor({state:"visible"});const toolsColumns=await calendarPane.locator("[data-calendar-tools]").evaluate(element=>getComputedStyle(element).gridTemplateColumns.split(" ").length);assert.equal(toolsColumns,2,"Configuração semanal e postagens agendadas não ficaram lado a lado no modo expandido.");const postPreviews=calendarPane.locator('article button[title]');if(await postPreviews.count()){const preview=postPreviews.first();await preview.click();assert.equal(await preview.getAttribute("aria-pressed"),"true","A prévia clicada não selecionou a postagem.");assert.ok(await calendarPane.locator(".line-clamp-2").count()>0,"Modo expandido não mostrou título das postagens.")}await page.getByRole("button",{name:"Recolher calendário lateral"}).click();await page.getByRole("button",{name:"Abrir calendário lateral"}).waitFor({state:"visible"});await page.getByRole("button",{name:"Abrir calendário lateral"}).click();await calendarPane.waitFor({state:"visible"});await page.getByRole("button",{name:"Recolher visualizador lateral"}).click();await page.getByRole("button",{name:"Abrir visualizador lateral"}).waitFor({state:"visible"});await page.getByRole("button",{name:"Abrir visualizador lateral"}).click();await page.getByRole("button",{name:"Recolher visualizador lateral"}).waitFor({state:"visible"});
    console.log("browser:home-ready");
    if (errors.length || homeFailedResponses.length) console.error("browser:home-diagnostics", { errors, homeFailedResponses });
    const homeConsoleErrors = errors.length;
    await page.close();
    errors.length = 0;
    const presentationPage = await context.newPage();
    presentationPage.on("pageerror", error => errors.push(error.message));
    presentationPage.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    presentationPage.on("response", response => { if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`); });
    const exportUrl = `${base}/presentation/${encodeURIComponent(rows[0].clientId)}/${rows[0].month}/export`;
    await presentationPage.goto(exportUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
    await presentationPage.locator("#pdf-render-ready[data-ready='true']").waitFor({ state: "attached", timeout: 10000 });
    await presentationPage.waitForFunction(() => /Calend.rio editorial/i.test(document.body.innerText), null, { timeout: 15000 });
    assert.equal(await presentationPage.locator("#pdf-render-ready[data-ready='true']").count(), 1, "Documento estático não sinalizou prontidão.");
    assert.ok(await presentationPage.locator(".pdf-page").count() >= 3, "Documento estático não exibiu as seções esperadas.");
    const documentText = await presentationPage.locator("body").innerText();
    assert.match(documentText, /Calend.rio editorial/i, `Calendário editorial ausente do documento: ${documentText.slice(0, 300)}`);
    assert.equal(await presentationPage.locator("img[src=''],img:not([src])").count(), 0, "Imagem recebeu src vazio ou ausente.");
    console.log("browser:presentation-ready");
    if (errors.length || failedResponses.length) console.error("browser:presentation-diagnostics", { errors, failedResponses });
    assert.equal(errors.length, 0, `Erros no navegador: ${errors.join(" | ")}`);
    console.log(JSON.stringify({ ok: true, authenticatedHome: true, sidebarTooltips:true, inlineWeeklyCalendar:true,expandedCalendarPreview:true,edgePanelControls:true,workflowInHeader:true,focusModeRemoved:true, staticPresentation: true, pagesInDom: await presentationPage.locator(".pdf-page").count(), presentationConsoleErrors: 0, unrelatedHomeConsoleErrors: homeConsoleErrors }));
  } finally {
    await browser.close();
    await db.end();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
