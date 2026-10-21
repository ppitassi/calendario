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
    await designer.dispose();
    // Navegação interna e edição persistente pela interface.
    await page.goto(baseURL);
    await page.evaluate(() => localStorage.setItem("cp:active-screen", "clients"));
    await page.reload();
    const clientRow = page.locator('[class*="clientRow"]').filter({ hasText: client.name });
    await clientRow.getByRole("button", { name: "Ficha & Portal" }).click();
    await page.getByRole("heading", { name: client.name, exact: true }).waitFor();
    await page.getByRole("button", { name: "Kickoff & onboarding", exact: true }).click();
    await page.getByLabel("Cronograma e marcos", { exact: true }).fill("Kickoff validado e entrega final em novembro.");
    await page.getByRole("button", { name: "Salvar ficha", exact: true }).click();
    await page.getByText("Ficha salva.", { exact: true }).waitFor();
    assert.equal((await (await api.get(endpoint)).json()).document.onboarding.timeline, "Kickoff validado e entrega final em novembro.");
    await page.reload();
    await page.getByRole("heading", { name: client.name, exact: true }).waitFor();
    await page.getByRole("button", { name: "Entregas & follow-up", exact: true }).click();
    await page.getByLabel("Aprendizados", { exact: true }).fill("Conteúdos educativos geraram conversas. Revisado pela equipe.");
    await page.getByRole("button", { name: "Salvar ficha", exact: true }).click();
    await page.getByText("Ficha salva.", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Manual da marca", exact: true }).click();
    await page.getByLabel("Tom de voz e exemplos", { exact: true }).fill("Clara, próxima e encorajadora. Exemplo: seu próximo passo começa aqui.");
    await page.getByRole("button", { name: "Salvar ficha", exact: true }).click();
    await page.getByText("Ficha salva.", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Relacionamento", exact: true }).click();
    await page.getByLabel("O que aconteceu?", { exact: true }).fill("PRIVATE-UI-UPDATE");
    await page.getByRole("button", { name: "Adicionar atualização", exact: true }).click();
    await page.getByRole("button", { name: "Salvar ficha", exact: true }).click();
    await page.getByText("Ficha salva.", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Visão geral", exact: true }).click();
    await page.getByRole("heading", { name: client.name, exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(out, "ficha-cliente-desktop.png"), fullPage: true });
    // Publicação sem cookies e sem vazamento de notas internas.
    const portal = await external.newPage();
    portal.on("pageerror", error => errors.push(error.message));
    for (const width of [1440, 768, 390]) {
      await portal.setViewportSize({ width, height: 1000 });
      await portal.goto(`${baseURL}/cliente/${hub.portalToken}`);
      await portal.getByRole("heading", { name: client.name, exact: true }).waitFor();
      await portal.getByRole("button", { name: "Entregas & follow-up", exact: true }).click();
      await portal.getByText("12.480", { exact: true }).waitFor();
      await portal.getByText("10.000 oportunidades de exposição", { exact: true }).waitFor();
      assert.equal(await portal.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, `overflow ${width}`);
      await portal.screenshot({ path: path.join(out, `portal-${width}.png`), fullPage: true });
    }
    await portal.getByRole("button", { name: "Manual da marca", exact: true }).click();
    await portal.getByRole("link", { name: "Abrir / baixar arquivo ↗", exact: true }).waitFor();
    await portal.screenshot({ path: path.join(out, "manual-marca-mobile.png"), fullPage: true });
    // Demandas alimentam o painel; conclusão é contada uma vez pelo evento de auditoria.
    const demand = await api.post("/api/demands", { data: { clientId: client.id, title: "Entrega operacional", priority: "normal", dueDate: "2026-10-20", executorId: me.id, deliveries: [{ type: "banner", quantity: 2 }], planning: { requesterId: me.id, specialty: "Design", category: "Campanha", effort: 3, serviceMode: "Remoto", dueTime: "18:00" } } });
    assert.equal(demand.status(), 200, await demand.text());
    const createdDemand = await demand.json();
    const details = await (await api.get(`/api/tasks/${createdDemand.workUnit.id}`)).json();
    assert.equal(details.details.planning.specialty, "Design");
    assert.equal(details.details.planning.requesterName, me.name);
    let board = await (await api.get("/api/agency-dashboard?month=all")).json();
    assert.ok(board.open.some(row => row.title === "Banner 01" && row.effort === 3));
    assert.ok(board.followUps.some(row => row.id === "follow-1"));
    const before = board.ranking.find(person => person.id === me.id).completed;
    await api.patch("/api/tasks", { data: { kind: "task", id: createdDemand.tasks[0].id, status: "completed" } });
    board = await (await api.get("/api/agency-dashboard?month=all")).json();
    assert.equal(board.ranking.find(person => person.id === me.id).completed, before + 1);
    await page.getByRole("button", { name: "Painel da Agência", exact: true }).click();
    await page.getByRole("heading", { name: "Próximas tarefas", exact: true }).waitFor();
    await page.screenshot({ path: path.join(out, "painel-agencia.png"), fullPage: true });
    await page.getByRole("button", { name: "Oportunidades de Conteúdo", exact: true }).click();
    await page.getByLabel("Empresa", { exact: true }).selectOption(client.id);
    await page.getByLabel("Tema / data comemorativa", { exact: true }).fill("Campanha de matrículas");
    await page.getByLabel("Usar em campanha", { exact: true }).first().check();
    await page.getByRole("button", { name: "Criar campanha na fila", exact: true }).click();
    await page.getByText(/Campanha criada com 1 tarefa/).waitFor();
    await page.screenshot({ path: path.join(out, "oportunidades-conteudo.png"), fullPage: true });
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
    fs.writeFileSync(path.join(out, "verification.json"), JSON.stringify({ briefing: true, onboarding: true, persistence: true, publishProjection: true, rbac: true, conflicts: true, validation: true, tokenRevocation: true, dashboard: true, campaign: true, responsive: [1440, 768, 390], pageErrors: errors }, null, 2));
    console.log("PASS: briefing, onboarding, persistência, publicação, RBAC, concorrência, validação, revogação, painel, campanhas e responsividade.");
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
