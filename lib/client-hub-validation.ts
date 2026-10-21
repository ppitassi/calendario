import { emptyHub, onboardingFields, type HubDocument, type Onboarding } from "./client-hub-types";

/** Validação explícita antes da persistência; campos desconhecidos nunca são publicados. */
export class HubError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HubError("Dados inválidos.");
  return value as Record<string, unknown>;
}
function text(value: unknown, max = 8000): string {
  if (typeof value !== "string" || value.length > max) throw new HubError(`Texto inválido ou maior que ${max} caracteres.`);
  return value.trim();
}
function required(value: unknown): string {
  const result = text(value, 500);
  if (!result) throw new HubError("Preencha os campos obrigatórios.");
  return result;
}
function bool(value: unknown): boolean {
  if (typeof value !== "boolean") throw new HubError("Opção inválida.");
  return value;
}
function number(value: unknown, max: number, min = 0, integer = false): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) throw new HubError("Número fora do intervalo permitido.");
  return value;
}
function date(value: unknown): string {
  const result = required(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(result)) || new Date(result).toISOString().slice(0, 10) !== result) throw new HubError("Data inválida.");
  return result;
}
function range(start: unknown, end: unknown) {
  const a = date(start), b = date(end);
  if (a > b) throw new HubError("A data final deve ser igual ou posterior à inicial.");
  return [a, b];
}
/** Aceita apenas links web; impede javascript:, data: e credenciais embutidas. */
export function webUrl(value: unknown): string {
  const result = text(value, 2000);
  if (!result) return "";
  let parsed: URL;
  try { parsed = new URL(result); } catch { throw new HubError("Informe um link completo com https://."); }
  if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new HubError("Link inválido.");
  return result;
}
function list<T>(value: unknown, parser: (row: Record<string, unknown>) => T): T[] {
  if (!Array.isArray(value) || value.length > 100) throw new HubError("A lista deve ter até 100 registros.");
  const rows = value.map(row => parser(object(row)));
  const ids = rows.map(row => (row as { id?: string }).id).filter(Boolean);
  if (new Set(ids).size !== ids.length) throw new HubError("Registros duplicados.");
  return rows;
}
/** O mesmo contrato alimenta o formulário externo e o documento de onboarding interno. */
export function validateOnboarding(value: unknown, submission = false): Onboarding {
  const source = object(value);
  const result = Object.fromEntries(Object.keys(onboardingFields).map(key => [key, text(source[key])])) as Onboarding;
  if (submission && (!result.contact || !result.company || !result.objectives)) throw new HubError("Informe contato, empresa e objetivos.");
  if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) throw new HubError("E-mail inválido.");
  return result;
}
/** Reconstrói o documento a partir da lista permitida de campos. */
export function validateHub(value: unknown): HubDocument {
  const input = object(value), result = emptyHub();
  result.onboarding = validateOnboarding(input.onboarding);
  result.onboardingPublished = bool(input.onboardingPublished);
  result.deliveries = list(input.deliveries, row => ({
    id: required(row.id), title: required(row.title), date: date(row.date),
    url: webUrl(row.url), description: text(row.description), published: bool(row.published),
  }));
  result.reports = list(input.reports, row => {
    const [start, end] = range(row.start, row.end);
    return {
      id: required(row.id), title: required(row.title), start, end,
      summary: text(row.summary), learnings: text(row.learnings), nextSteps: text(row.nextSteps), published: bool(row.published),
      social: list(row.social, metric => ({
        id: required(metric.id), channel: required(metric.channel), metric: required(metric.metric),
        value: number(metric.value, 1e12), source: required(metric.source),
      })),
      outdoor: list(row.outdoor, metric => {
        if (metric.medium !== "Busdoor" && metric.medium !== "Outdoor") throw new HubError("Mídia inválida.");
        const days = number(metric.days, 3660, 1, true);
        const periodDays = Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
        if (days > periodDays) throw new HubError("Dias de veiculação excedem o período do relatório.");
        return {
          id: required(metric.id), medium: metric.medium, location: required(metric.location),
          dailyFlow: number(metric.dailyFlow, 1e9), days, units: number(metric.units, 100000, 1, true),
          factor: number(metric.factor, 1), source: required(metric.source), assumptions: required(metric.assumptions),
        };
      }),
    };
  });
  const brand = object(input.brand);
  result.brand = {
    description: text(brand.description), colors: text(brand.colors), typography: text(brand.typography),
    rules: text(brand.rules), voice: text(brand.voice), published: bool(brand.published),
    assets: list(brand.assets, asset => {
      if (!["Logo", "Aplicação", "Arquivo"].includes(String(asset.kind))) throw new HubError("Tipo de arquivo inválido.");
      const url = webUrl(asset.url);
      if (!url) throw new HubError("Informe o link do arquivo.");
      return { id: required(asset.id), title: required(asset.title), url, kind: asset.kind as "Logo" | "Aplicação" | "Arquivo", description: text(asset.description) };
    }),
  };
  result.followUps = list(input.followUps, row => {
    const [start, due] = range(row.start, row.due);
    if (!["scheduled", "completed"].includes(String(row.status))) throw new HubError("Status inválido.");
    return { id: required(row.id), title: required(row.title), start, due, owner: required(row.owner), participant: text(row.participant), objective: text(row.objective), meetingUrl: webUrl(row.meetingUrl), message: text(row.message), status: row.status as "scheduled" | "completed", outcome: text(row.outcome) };
  });
  result.updates = list(input.updates, row => ({ id: required(row.id), date: date(row.date), author: required(row.author), text: required(row.text) }));
  return result;
}
