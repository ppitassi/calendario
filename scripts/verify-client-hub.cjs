/** Integração local: briefing → onboarding → publicação → revogação, RBAC e interface responsiva. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium, request } = require("playwright-core");
const baseURL = process.env.STUDIO_TEST_BASE_URL || "http://localhost:3011";
if (!["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)) throw new Error("Execute apenas em um banco local descartável.");
const username = process.env.STUDIO_TEST_USERNAME;
const password = process.env.STUDIO_TEST_PASSWORD;
if (!username || !password) throw new Error("Informe as credenciais do ambiente de teste.");
const suffix = Date.now().toString();
const out = process.env.STUDIO_TEST_OUTPUT || path.resolve("artifacts/client-hub");
fs.mkdirSync(out, { recursive: true });
async function main() {
  const api = await request.newContext({ baseURL });
  const publicApi = await request.newContext({ baseURL });
  const login = await api.post("/api/auth/login", { data: { username, password } });
  assert.equal(login.status(), 200, await login.text());
  const me = (await (await api.get("/api/auth/me")).json()).user;
  const create = await api.post("/api/clients", { data: { name: `Marca Horizonte ${suffix}`, segment: "Educação", tone: "Próximo e claro", audience: "Alunos e famílias" } });
  assert.equal(create.status(), 200, await create.text());
  const client = (await create.json()).client, endpoint = `/api/clients/${client.id}/hub`;
  assert.equal((await publicApi.get(endpoint)).status(), 401);
  let hub = await (await api.post(endpoint, { data: { action: "initialize" } })).json();
  assert.equal((await publicApi.get(`/api/client-portal/${hub.portalToken}`)).status(), 404);
  const executablePath = [process.env.STUDIO_BROWSER_EXECUTABLE_PATH, "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "/usr/bin/chromium", "/usr/bin/google-chrome"].filter(Boolean).find(fs.existsSync);
  if (!executablePath) throw new Error("Informe STUDIO_BROWSER_EXECUTABLE_PATH com um navegador Chromium instalado.");
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, storageState: await api.storageState() });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    // Envio pela interface pública, sem reaproveitar cookies autenticados.
    const external = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const form = await external.newPage();
    form.on("pageerror", error => errors.push(error.message));
    await form.goto(`${baseURL}/briefing/${hub.briefingToken}`);
    await form.getByLabel("Contato principal *", { exact: true }).fill("Marina de Teste");
    await form.getByLabel("E-mail", { exact: true }).fill("marina@example.test");
    await form.getByLabel("Objetivos e critérios de sucesso *", { exact: true }).fill("Aumentar o interesse pelos cursos e acompanhar resultados mensais.");
    await form.getByLabel("Escopo e entregas contratadas", { exact: true }).fill("Planejamento editorial, campanha de matrículas e relatório mensal.");
    await form.getByRole("button", { name: "Enviar briefing e gerar onboarding" }).click();
    await form.getByRole("heading", { name: "Briefing enviado." }).waitFor();
    hub = await (await api.get(endpoint)).json();
    assert.equal(hub.document.onboarding.contact, "Marina de Teste");
    assert.equal(hub.briefingOpen, false);
    assert.equal((await publicApi.post(`/api/briefing/${hub.briefingToken}`, { data: { answers: hub.document.onboarding } })).status(), 409);
    const briefingRead = await (await publicApi.get(`/api/briefing/${hub.briefingToken}`)).json();
    assert.equal(JSON.stringify(briefingRead).includes("Marina"), false);
    const doc = hub.document;
    doc.onboardingPublished = true;
    doc.onboarding.responsibilities = "Marina aprova. A equipe de criação desenvolve e revisa.";
    doc.onboarding.timeline = "Kickoff em outubro; primeira campanha em novembro.";
    doc.onboarding.access = "PRIVATE-ACCESS-NOTE";
    doc.deliveries = [
      { id: "delivery-1", title: "Campanha de matrículas", date: "2026-10-20", url: "https://example.com/material", description: "Peças digitais e versão para outdoor.", published: true },
      { id: "draft-delivery", title: "PRIVATE-DRAFT", date: "2026-10-20", url: "", description: "", published: false },
    ];
    doc.reports = [{ id: "report-1", title: "Resultados de outubro", start: "2026-10-01", end: "2026-10-31", summary: "Relatório de demonstração com dados de teste.", learnings: "Conteúdos educativos geraram conversas.", nextSteps: "Equipe: preparar nova rodada até 05/11.", published: true,
      social: [{ id: "social-1", channel: "Instagram", metric: "Alcance (contas)", value: 12480, source: "Dados sintéticos para teste" }],
      outdoor: [{ id: "ooh-1", medium: "Outdoor", location: "Centro", dailyFlow: 1000, days: 10, units: 2, factor: 0.5, source: "Contagem fictícia para teste", assumptions: "Fator hipotético de 50%; fluxo com repetições." }] }];
    doc.brand = { description: "Aprender abre novos horizontes.", colors: "Verde #204B3B\nAreia #E9E4D9\nCoral #DC3D35", typography: "Títulos: sans serif em negrito.\nTextos: sans serif regular.", rules: "Preservar a proporção do logo e manter contraste.\nNão distorcer nem alterar as cores.", voice: "Clara, próxima e encorajadora.", published: true, assets: [{ id: "brand-1", title: "Kit de marca", kind: "Arquivo", description: "Logos e aplicações.", url: "https://example.com/brand.zip" }] };
    doc.followUps = [{ id: "follow-1", title: "Revisão mensal", start: "2026-10-20", due: "2026-10-23", owner: me.id, participant: "", objective: "PRIVATE-OBJECTIVE", meetingUrl: "", message: "Vamos conversar?", status: "scheduled", outcome: "" }];
    doc.updates = [{ id: "update-1", date: "2026-10-20", author: "Equipe", text: "PRIVATE-RELATIONSHIP" }];
    const saved = await api.put(endpoint, { data: { revision: hub.revision, document: doc } });
    assert.equal(saved.status(), 200, await saved.text());
    assert.equal((await api.put(endpoint, { data: { revision: hub.revision, document: doc } })).status(), 409);
    hub = await saved.json();
    const invalid = structuredClone(doc); invalid.brand.assets[0].url = "javascript:alert(1)";
    assert.equal((await api.put(endpoint, { data: { revision: hub.revision, document: invalid } })).status(), 400);
    invalid.brand.assets[0].url = "https://example.com";
    invalid.reports[0].outdoor[0].days = 50;
    assert.equal((await api.put(endpoint, { data: { revision: hub.revision, document: invalid } })).status(), 400);
    hub = await (await api.post(endpoint, { data: { action: "enable" } })).json();
    const publicResponse = await publicApi.get(`/api/client-portal/${hub.portalToken}`);
    assert.equal(publicResponse.status(), 200);
    const published = await publicResponse.text();
    for (const privateValue of ["PRIVATE-", "marina@example.test", hub.briefingToken]) assert.equal(published.includes(privateValue), false);
    // RBAC real: usuário designer aprovado não consegue gravar ou alterar links.
    const designerName = `designer-${suffix}`;
    await api.post("/api/admin/users", { data: { action: "create", username: designerName, name: "Designer teste", password, role: "designer" } });
    const designer = await request.newContext({ baseURL });
    assert.equal((await designer.post("/api/auth/login", { data: { username: designerName, password } })).status(), 200);
    assert.equal((await designer.put(endpoint, { data: { revision: hub.revision, document: doc } })).status(), 403);
    assert.equal((await designer.post(endpoint, { data: { action: "enable" } })).status(), 403);
    assert.equal((await (await designer.get(endpoint)).json()).briefingToken, undefined);
    assert.equal((await designer.post(endpoint, { data: { action: "apply_briefing", revision: hub.revision } })).status(), 403);
    assert.equal((await designer.put(`/api/clients/${client.id}`, { data: { tone: "Alteração proibida" } })).status(), 403);
    await designer.dispose();
    // Briefing -> cadastro -> calendários reais. Preserva calendário aprovado e valores próprios.
    const ensure = async month => {
      const response = await api.post("/api/calendars/ensure", { data: { clientId: client.id, month } });
      assert.equal(response.status(), 200, await response.text());
      return (await response.json()).calendar;
    };
    const cal = await ensure("2026-10");
    const locked = await ensure("2026-09");
    const customized = await ensure("2026-08");
    const shared = await ensure("2026-07");
    await api.post(`/api/calendars/${shared.id}/share-token`, { data: {} });
    await api.put(`/api/calendars/${locked.id}`, { data: { status: "approved", audience: "Público aprovado" } });
    await api.put(`/api/calendars/${customized.id}`, { data: { audience: "Público específico" } });
    hub = await (await api.get(endpoint)).json();
    hub.document.onboarding.audience = "Novos alunos";
    hub.document.onboarding.tone = "Clareza e acolhimento";
    hub.document.onboarding.segment = "Cursos";
    hub = await (await api.put(endpoint, { data: { revision: hub.revision, document: hub.document } })).json();
    const applied = await api.post(endpoint, { data: { action: "apply_briefing", revision: hub.revision } });
    assert.equal(applied.status(), 200, await applied.text());
    assert.equal((await api.post(endpoint, { data: { action: "apply_briefing", revision: hub.revision } })).status(), 409);
    const readCal = async id => (await (await api.get(`/api/calendars/${id}`)).json()).calendar;
    assert.equal((await readCal(cal.id)).audience, "Novos alunos");
    assert.equal((await readCal(locked.id)).audience, "Público aprovado");
    assert.equal((await readCal(customized.id)).audience, "Público específico");
    assert.equal((await readCal(shared.id)).audience, "Alunos e famílias");
    const nextCalendar = await ensure("2026-11");
    assert.equal(nextCalendar.audience, "Novos alunos");
    assert.equal(nextCalendar.strategy, hub.document.onboarding.objectives);
    const alternateCreate = await api.post("/api/calendars", { data: { clientId: client.id, title: "Calendário alternativo", month: "2026-12" } });
    assert.equal(alternateCreate.status(), 200, await alternateCreate.text());
    assert.equal((await alternateCreate.json()).calendar.audience, "Novos alunos");
    assert.equal((await api.put(`/api/clients/${client.id}`, { data: { tone: "Cadastro revisado" } })).status(), 200);
    assert.equal((await readCal(cal.id)).tone, "Cadastro revisado");
    assert.equal((await readCal(locked.id)).tone, "Próximo e claro");
    const publicationId = `publication-${suffix}`;
    const draftId = `draft-${suffix}`;
    const items = [
      { id: publicationId, date: "2026-10-20", title: "Entrega real do calendário", type: "Feed", status: "Aprovado", channel: "Instagram", caption: "Copy persistida" },
      { id: draftId, date: "2026-10-21", title: "PRIVATE-UNAPPROVED", type: "Feed", status: "Ideia", channel: "Instagram" },
    ];
    const itemSave = await api.put(`/api/calendars/${cal.id}`, { data: { items } });
    assert.equal(itemSave.status(), 200, await itemSave.text());
    const demand = await api.post("/api/demands", { data: { clientId: client.id, title: "Produção de outdoor", priority: "normal", executorId: me.id, deliveries: [{ type: "impresso", quantity: 1, title: "Outdoor entregue" }] } });
    assert.equal(demand.status(), 200, await demand.text());
    const createdDemand = await demand.json();
    const completed = await api.patch("/api/tasks", { data: { kind: "task", id: createdDemand.tasks[0].id, status: "completed" } });
    assert.equal(completed.status(), 200, await completed.text());
    hub = await (await api.get(endpoint)).json();
    assert.ok(hub.workDeliveries.some(item => item.key === `calendar:${publicationId}`));
    assert.ok(hub.workDeliveries.some(item => item.key === `task:${createdDemand.tasks[0].id}`));
    assert.equal(hub.workDeliveries.some(item => item.key === `calendar:${draftId}`), false);
    hub.document.reports[0].start = "2020-01-01";
    hub.document.reports[0].end = "2035-12-31";
    hub.document.reports[0].deliveryKeys = hub.workDeliveries.map(item => item.key);
    const forged = structuredClone(hub.document);
    forged.reports[0].deliveryKeys.push("calendar:another-client-item");
    assert.equal((await api.put(endpoint, { data: { revision: hub.revision, document: forged } })).status(), 400);
    hub = await (await api.put(endpoint, { data: { revision: hub.revision, document: hub.document } })).json();
    let projection = await (await publicApi.get(`/api/client-portal/${hub.portalToken}`)).json();
    assert.equal(projection.document.reports[0].linkedDeliveries.length, 2);
    assert.equal(JSON.stringify(projection).includes("PRIVATE-UNAPPROVED"), false);
    // Reabrir uma peça remove sua exposição, sem manter uma cópia obsoleta no portal.
    items[0].status = "Revisão";
    await api.put(`/api/calendars/${cal.id}`, { data: { items } });
    projection = await (await publicApi.get(`/api/client-portal/${hub.portalToken}`)).json();
    assert.equal(projection.document.reports[0].linkedDeliveries.length, 1);
    const reopenedHub = await (await api.get(endpoint)).json();
    reopenedHub.document.brand.description = "Aprender abre novos horizontes. Manual revisado.";
    assert.equal((await api.put(endpoint, { data: { revision: reopenedHub.revision, document: reopenedHub.document } })).status(), 200);
    items[0].status = "Aprovado";
    await api.put(`/api/calendars/${cal.id}`, { data: { items } });

    // Recursos dentro do cadastro existente.
    await page.goto(baseURL);
    await page.getByTitle("Controle de Clientes", { exact: true }).click();
    const clientRow = page.locator('[class*="clientRow"]').filter({ hasText: client.name });
    await clientRow.getByRole("button", { name: "Editar", exact: true }).click();
    await page.getByRole("button", { name: "Onboarding, marca e resultados", exact: true }).click();
    await page.getByLabel("Cronograma e marcos", { exact: true }).fill("Kickoff validado e entrega final em novembro.");
    await page.getByRole("button", { name: "Salvar ficha", exact: true }).click();
    await page.getByText("Ficha salva.", { exact: true }).waitFor();
    assert.equal((await (await api.get(endpoint)).json()).document.onboarding.timeline, "Kickoff validado e entrega final em novembro.");
    await page.screenshot({ path: path.join(out, "onboarding-no-cadastro.png"), fullPage: true });

    // O calendário permanece montado ao consultar a marca e editar o relatório.
    await page.evaluate(({ id, clientId }) => {
      localStorage.setItem("cp:active-screen", "planner");
      localStorage.setItem("cp:active-client-id", clientId);
      localStorage.setItem("cp:active-calendar-id", id);
      localStorage.setItem("cp:active-month", "2026-10");
    }, { id: cal.id, clientId: client.id });
    await page.reload();
    await page.getByText("Entrega real do calendário", { exact: true }).first().click();
    await page.locator(".documentTitle").waitFor();
    await page.getByRole("button", { name: "Consultar marca", exact: true }).click();
    await page.getByRole("button", { name: "Editar conteúdo", exact: true }).click();
    await page.getByLabel("Tom de voz e exemplos", { exact: true }).fill("Clara, próxima e encorajadora. Exemplo de produção.");
    await page.getByRole("button", { name: "Salvar ficha", exact: true }).click();
    await page.getByText("Ficha salva.", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Prévia do documento", exact: true }).click();
    await page.screenshot({ path: path.join(out, "marca-no-editor.png"), fullPage: true });
    await page.emulateMedia({ media: "print" });
    assert.equal(await page.locator(".documentTitle").isVisible(), false);
    assert.equal(await page.getByText("Ficha salva.", { exact: true }).isVisible(), false);
    assert.equal(await page.locator("dialog").evaluate(node => getComputedStyle(node).maxHeight), "none");
    await page.pdf({ path: path.join(out, "manual-no-editor.pdf"), format: "A4", printBackground: true });
    await page.emulateMedia({ media: "screen" });
    await page.getByRole("button", { name: "Voltar ao trabalho", exact: true }).click();
    assert.equal(await page.locator(".documentTitle").inputValue(), "Entrega real do calendário");
    await page.getByRole("button", { name: "Entregas e resultados", exact: true }).click();
    await page.getByLabel("Aprendizados", { exact: true }).fill("Relatório vinculado às entregas reais.");
    await page.getByRole("button", { name: "Salvar ficha", exact: true }).click();
    await page.getByText("Ficha salva.", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Agendar revisão na fila de tarefas", exact: true }).click();
    assert.equal(await page.locator('dialog input[type="text"]').first().inputValue(), "Follow-up: Resultados de outubro");
    const createdFollowUp = page.waitForResponse(response => response.url().endsWith("/api/demands") && response.request().method() === "POST");
    await page.getByRole("button", { name: /Criar Demanda/i }).click();
    const followResponse = await createdFollowUp;
    assert.equal(followResponse.status(), 200, await followResponse.text());
    const followBody = await followResponse.json();
    assert.equal(followBody.tasks[0].type, "follow_up");
    const followDetails = await (await api.get(`/api/tasks/${followBody.workUnit.id}`)).json();
    assert.equal(followDetails.details.planning.followUpReportId, "report-1");
    const queue = await (await api.get(`/api/tasks?scope=team&clientId=${client.id}`)).json();
    assert.ok(JSON.stringify(queue.items).includes("Follow-up: Resultados de outubro"));
    await page.getByText("Revisão criada na fila de tarefas do cliente.", { exact: true }).waitFor();
    await page.screenshot({ path: path.join(out, "follow-up-no-calendario.png"), fullPage: true });
    for (const width of [768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.querySelector("dialog").scrollWidth > document.querySelector("dialog").clientWidth + 1), false, `dialog overflow ${width}`);
    }
    await page.getByRole("button", { name: "Voltar ao trabalho", exact: true }).click();
    assert.equal(await page.locator(".documentTitle").inputValue(), "Entrega real do calendário");

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByTitle("Tarefas", { exact: true }).click();
    await page.locator("select").filter({ has: page.locator(`option[value="${client.id}"]`) }).first().selectOption(client.id);
    await page.getByText("Follow-up: Resultados de outubro", { exact: true }).first().click();
    await page.getByRole("button", { name: "Detalhes", exact: true }).click();
    await page.getByRole("region", { name: "Relatório vinculado ao follow-up" }).getByText("Entrega real do calendário", { exact: true }).waitFor();
    await page.getByText("Consultar manual da marca", { exact: true }).click();
    await page.getByText("Clara, próxima e encorajadora. Exemplo de produção.", { exact: true }).waitFor();
    const reportBox = await page.getByRole("region", { name: "Relatório vinculado ao follow-up" }).boundingBox();
    const manualBox = await page.getByText("Consultar manual da marca", { exact: true }).boundingBox();
    assert.ok(reportBox.y + reportBox.height <= manualBox.y, "Relatório e manual não podem se sobrepor na gaveta.");
    await page.screenshot({ path: path.join(out, "relatorio-na-tarefa.png"), fullPage: true });

    const portal = await external.newPage();
    portal.on("pageerror", error => errors.push(error.message));
    for (const width of [1440, 768, 390]) {
      await portal.setViewportSize({ width, height: 1000 });
      await portal.goto(`${baseURL}/cliente/${hub.portalToken}`);
      await portal.getByRole("heading", { name: client.name, exact: true }).waitFor();
      await portal.getByRole("button", { name: "Entregas & follow-up", exact: true }).click();
      await portal.getByText("Entrega real do calendário", { exact: true }).waitFor();
      await portal.getByText("Outdoor entregue", { exact: true }).waitFor();
      await portal.getByText("12.480", { exact: true }).waitFor();
      await portal.getByText("10.000 oportunidades de exposição", { exact: true }).waitFor();
      assert.equal(await portal.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, `overflow ${width}`);
      await portal.screenshot({ path: path.join(out, `portal-${width}.png`), fullPage: true });
    }
    // Concorrência real: apenas uma sessão vence a atualização da mesma revisão.
    hub = await (await api.get(endpoint)).json();
    const competing = await Promise.all([1, 2].map(() => api.put(endpoint, { data: { revision: hub.revision, document: hub.document } })));
    assert.deepEqual(competing.map(response => response.status()).sort(), [200, 409]);
    const previousBriefing = hub.briefingToken;
    hub = await (await api.post(endpoint, { data: { action: "reopen" } })).json();
    assert.equal((await publicApi.get(`/api/briefing/${previousBriefing}`)).status(), 404);
    const submissions = await Promise.all([1, 2].map(() => publicApi.post(`/api/briefing/${hub.briefingToken}`, { data: { answers: hub.document.onboarding } })));
    assert.deepEqual(submissions.map(response => response.status()).sort(), [200, 409]);
    const afterBriefing = await (await publicApi.get(`/api/client-portal/${hub.portalToken}`)).json();
    assert.equal(afterBriefing.document.onboardingPublished, false);
    const oldToken = hub.portalToken;
    hub = await (await api.post(endpoint, { data: { action: "rotate" } })).json();
    assert.equal((await publicApi.get(`/api/client-portal/${oldToken}`)).status(), 404);
    assert.equal((await publicApi.get(`/api/client-portal/${hub.portalToken}`)).status(), 200);
    await api.post(endpoint, { data: { action: "disable" } });
    assert.equal((await publicApi.get(`/api/client-portal/${hub.portalToken}`)).status(), 404);
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, "verification.json"), JSON.stringify({ briefing: true, onboarding: true, persistence: true, publishProjection: true, rbac: true, conflicts: true, validation: true, tokenRevocation: true, planningInheritance: true, canonicalDeliveries: true, editorContext: true, canonicalFollowUpTask: true, responsive: [1440, 768, 390], pageErrors: errors }, null, 2));
    console.log("PASS: briefing, onboarding, persistência, publicação, RBAC, concorrência, validação, revogação, planejamento, entregas reais, contexto do editor, tarefa de follow-up e responsividade.");
    await external.close(); await context.close();
  } catch (error) {
    for (const [index, context] of browser.contexts().entries()) {
      const page = context.pages()[0];
      if (page) {
        await page.screenshot({ path: path.join(out, `failure-${index}.png`), fullPage: true }).catch(() => {});
        fs.writeFileSync(path.join(out, `failure-${index}.txt`), await page.locator("body").innerText().catch(() => ""));
      }
    }
    throw error;
  } finally { await browser.close(); await api.dispose(); await publicApi.dispose(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
