import crypto from "node:crypto";
import { clientDeliveries } from "./client-deliveries";
import { syncClientPlanning } from "./client-planning";
import { getDb } from "./db";
import { emptyHub, type HubClient, type HubDocument, type HubPayload } from "./client-hub-types";
import { HubError, validateHub, validateOnboarding } from "./client-hub-validation";

type HubRow = {
  client_id: string; document: string; revision: number; portal_token: string; briefing_token: string;
  portal_enabled: number; briefing_open: number; submitted_at: string | null; updated_at: string;
};
const token = () => crypto.randomBytes(32).toString("hex");

/** Cria o dossiê apenas em uma ação autenticada, sem publicar automaticamente. */
export async function ensureHub(clientId: string) {
  const db = getDb();
  const client = await db.prepare("SELECT id, name, segment, accent, logo_url, tone, audience, strategy FROM clients WHERE id = ?").get(clientId) as (HubClient & { tone: string; audience: string; strategy: string }) | undefined;
  if (!client) throw new HubError("Cliente não encontrado.", 404);
  const initial = emptyHub();
  initial.onboarding.company = client.name;
  initial.onboarding.segment = client.segment || "";
  initial.onboarding.tone = client.tone || "";
  initial.onboarding.audience = client.audience || "";
  initial.onboarding.objectives = client.strategy || "";
  await db.prepare(`INSERT INTO client_hubs (client_id, document, portal_token, briefing_token, updated_at)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT(client_id) DO NOTHING`).run(clientId, JSON.stringify(initial), token(), token(), new Date().toISOString());
  return client;
}
/** Lê o cadastro existente; links de aprovação são exibidos somente quando já compartilhados. */
export async function getHub(clientId: string, editor: boolean): Promise<HubPayload> {
  const db = getDb();
  const client = await db.prepare("SELECT id, name, segment, accent, logo_url, tone, audience, strategy FROM clients WHERE id = ?").get(clientId) as (HubClient & { tone: string; audience: string; strategy: string }) | undefined;
  if (!client) throw new HubError("Cliente não encontrado.", 404);
  const row = await db.prepare("SELECT * FROM client_hubs WHERE client_id = ?").get(clientId) as HubRow | undefined;
  const calendars = await db.prepare(`SELECT title, month, share_token FROM calendars
    WHERE client_id = ? AND deleted_at IS NULL AND share_token IS NOT NULL AND share_token != '' ORDER BY month DESC`).all(clientId);
  const workDeliveries = await clientDeliveries(clientId);
  const document: HubDocument = row ? JSON.parse(row.document) : emptyHub();
  if (!row) Object.assign(document.onboarding, { company: client.name, segment: client.segment || "", tone: client.tone || "", audience: client.audience || "", objectives: client.strategy || "" });
  for (const report of document.reports) {
    report.linkedDeliveries = workDeliveries.filter(item => report.deliveryKeys?.includes(item.key) && item.date >= report.start && item.date <= report.end);
  }
  return {
    workDeliveries, client, document, revision: row?.revision ?? 0,
    submittedAt: row?.submitted_at ?? null, portalEnabled: Boolean(row?.portal_enabled), briefingOpen: Boolean(row?.briefing_open),
    ...(editor && row ? { portalToken: row.portal_token, briefingToken: row.briefing_token } : {}),
    calendars,
  };
}
/** Controle otimista impede que duas abas apaguem alterações ou um briefing recém-enviado. */
export async function saveHub(clientId: string, body: Record<string, unknown>) {
  if (!Number.isInteger(body.revision) || Number(body.revision) < 0) throw new HubError("Revisão inválida.");
  const document = validateHub(body.document);
  const db = getDb();
  const stored = await db.prepare("SELECT document FROM client_hubs WHERE client_id = ? AND revision = ?").get(clientId, body.revision);
  if (!stored) throw new HubError("Este documento foi atualizado em outra sessão. Recarregue antes de salvar.", 409);
  const previous = JSON.parse(stored.document) as HubDocument;
  const available = await clientDeliveries(clientId);
  for (const report of document.reports) {
    const before = previous.reports.find(item => item.id === report.id);
    // Uma peça reaberta some da projeção pública, mas não bloqueia a edição da marca ou do onboarding.
    const sameSelection = before && before.start === report.start && before.end === report.end
      && JSON.stringify(before.deliveryKeys || []) === JSON.stringify(report.deliveryKeys || []);
    if (sameSelection && (!report.published || before.published)) continue;
    if (report.deliveryKeys?.some(key => !available.some(item => item.key === key && item.date >= report.start && item.date <= report.end))) {
      throw new HubError("Uma entrega selecionada está fora do período ou não está mais aprovada/concluída. Revise a seleção.");
    }
  }
  const result = await db.prepare(`UPDATE client_hubs SET document = ?, revision = revision + 1, updated_at = ?
    WHERE client_id = ? AND revision = ?`).run(JSON.stringify(document), new Date().toISOString(), clientId, body.revision);
  if (!result.changes) throw new HubError("Este documento foi atualizado em outra sessão. Recarregue antes de salvar.", 409);
}
/** Links independentes: consultar o portal não dá permissão para alterar o briefing. */
export async function changeSharing(clientId: string, action: unknown) {
  const db = getDb(), now = new Date().toISOString();
  const actions: Record<string, { sql: string; args: unknown[] }> = {
    enable: { sql: "portal_enabled = 1", args: [] },
    disable: { sql: "portal_enabled = 0", args: [] },
    rotate: { sql: "portal_token = ?, briefing_token = ?", args: [token(), token()] },
    reopen: { sql: "briefing_open = 1, briefing_token = ?", args: [token()] },
    close: { sql: "briefing_open = 0", args: [] },
  };
  const selected = typeof action === "string" ? actions[action] : undefined;
  if (!selected) throw new HubError("Ação inválida.");
  await db.prepare(`UPDATE client_hubs SET ${selected.sql}, revision = revision + 1, updated_at = ? WHERE client_id = ?`).run(...selected.args, now, clientId);
}
/** Token de 256 bits e busca por propósito evitam enumerar clientes ou reutilizar links. */
export async function findPublicHub(value: string, purpose: "portal" | "briefing"): Promise<HubRow> {
  if (!/^[a-f0-9]{64}$/.test(value)) throw new HubError("Link inválido ou indisponível.", 404);
  const row = await getDb().prepare(`SELECT * FROM client_hubs WHERE ${purpose === "portal" ? "portal_token" : "briefing_token"} = ?`).get(value) as HubRow | undefined;
  if (!row || (purpose === "portal" && !row.portal_enabled)) throw new HubError("Link inválido ou indisponível.", 404);
  return row;
}
/** Projeção pública deliberada: notas internas, contatos e tokens de edição não são enviados. */
export async function publicHub(value: string) {
  const row = await findPublicHub(value, "portal");
  const internal = await getHub(row.client_id, false);
  const doc = internal.document, visible = emptyHub();
  if (doc.onboardingPublished) {
    visible.onboarding = { ...doc.onboarding, email: "", phone: "", access: "" };
    visible.onboardingPublished = true;
  }
  visible.deliveries = doc.deliveries.filter(item => item.published);
  visible.reports = doc.reports.filter(item => item.published);
  if (doc.brand.published) visible.brand = doc.brand;
  return { client: { id: internal.client.id, name: internal.client.name, segment: internal.client.segment, accent: internal.client.accent, logo_url: internal.client.logo_url }, document: visible, calendars: internal.calendars };
}
/** Submissão única e atômica: preserva histórico e preenche o onboarding na mesma transação. */
export async function submitBriefing(value: string, answers: unknown) {
  const data = validateOnboarding(answers, true);
  const row = await findPublicHub(value, "briefing");
  if (!row.briefing_open) throw new HubError("Este briefing já foi enviado ou encerrado. Solicite um novo link.", 409);
  const now = new Date().toISOString();
  const document = JSON.parse(row.document) as HubDocument;
  document.onboarding = data;
  document.onboardingPublished = false;
  await getDb().transaction(async tx => {
    const updated = await tx.prepare(`UPDATE client_hubs SET document = ?, briefing_open = 0,
      submitted_at = ?, revision = revision + 1, updated_at = ?
      WHERE client_id = ? AND briefing_token = ? AND briefing_open = 1 AND revision = ?`)
      .run(JSON.stringify(document), now, now, row.client_id, value, row.revision);
    if (!updated.changes) throw new HubError("O formulário foi atualizado ou já enviado. Recarregue a página.", 409);
    await tx.prepare("INSERT INTO client_briefing_submissions (id, client_id, answers, submitted_at) VALUES (?, ?, ?, ?)")
      .run(crypto.randomUUID(), row.client_id, JSON.stringify(data), now);
  });
}

/** Revisão explícita do briefing: cadastro e rascunhos usam a mesma transação. */
export async function applyBriefing(clientId: string, revision: unknown) {
  if (!Number.isInteger(revision)) throw new HubError("Revisão inválida.");
  await getDb().transaction(async tx => {
    const row = await tx.prepare("SELECT document FROM client_hubs WHERE client_id = ? AND revision = ?").get(clientId, revision);
    if (!row) throw new HubError("O briefing mudou. Recarregue antes de aplicar.", 409);
    const document = JSON.parse(row.document) as HubDocument;
    const previous = await tx.prepare("SELECT * FROM clients WHERE id = ?").get(clientId);
    const next = { segment: document.onboarding.segment, tone: document.onboarding.tone, audience: document.onboarding.audience, strategy: document.onboarding.objectives };
    const result = await tx.prepare("UPDATE client_hubs SET revision = revision + 1 WHERE client_id = ? AND revision = ?").run(clientId, revision);
    if (!result.changes) throw new HubError("O briefing mudou. Recarregue antes de aplicar.", 409);
    await tx.prepare("UPDATE clients SET segment = ?, tone = ?, audience = ?, strategy = ?, updated_at = ? WHERE id = ?")
      .run(next.segment, next.tone, next.audience, next.strategy, new Date().toISOString(), clientId);
    await syncClientPlanning(tx, clientId, previous, next);
  });
}
