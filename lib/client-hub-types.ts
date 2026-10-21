/** Contrato compartilhado do portal. Somente dados publicados saem para o cliente. */
export const onboardingFields = {
  contact: "Contato principal", email: "E-mail", phone: "WhatsApp",
  company: "Razão social / empresa", segment: "Segmento", audience: "Público",
  objectives: "Objetivos e critérios de sucesso", scope: "Escopo e entregas contratadas",
  tone: "Tom de voz", references: "Referências e concorrentes",
  responsibilities: "Equipe, responsáveis e aprovações", timeline: "Cronograma e marcos",
  workflow: "Fluxo de trabalho e canais", access: "Acessos necessários (sem senhas)",
} as const;
export type Onboarding = Record<keyof typeof onboardingFields, string>;
export type Delivery = { id: string; title: string; date: string; url: string; description: string; published: boolean };
export type SocialMetric = { id: string; channel: string; metric: string; value: number; source: string };
export type OutdoorMetric = { id: string; medium: "Busdoor" | "Outdoor"; location: string; dailyFlow: number; days: number; units: number; factor: number; source: string; assumptions: string };
export type Report = { id: string; title: string; start: string; end: string; summary: string; learnings: string; nextSteps: string; published: boolean; social: SocialMetric[]; outdoor: OutdoorMetric[] };
export type BrandAsset = { id: string; title: string; url: string; kind: "Logo" | "Aplicação" | "Arquivo"; description: string };
export type Brand = { description: string; colors: string; typography: string; rules: string; voice: string; assets: BrandAsset[]; published: boolean };
export type FollowUp = { id: string; title: string; start: string; due: string; owner: string; participant: string; objective: string; meetingUrl: string; message: string; status: "scheduled" | "completed"; outcome: string };
export type RelationshipUpdate = { id: string; date: string; author: string; text: string };
export type HubDocument = {
  onboarding: Onboarding; onboardingPublished: boolean; deliveries: Delivery[]; reports: Report[];
  brand: Brand; followUps: FollowUp[]; updates: RelationshipUpdate[];
};
export type HubClient = { id: string; name: string; segment: string; accent: string; logo_url: string | null };
export type HubPayload = {
  client: HubClient; document: HubDocument; revision: number; submittedAt: string | null;
  portalToken?: string; briefingToken?: string; portalEnabled: boolean; briefingOpen: boolean;
  calendars: { title: string; month: string; share_token: string }[];
};
/** Cria documentos vazios sem inventar resultados ou informações comerciais. */
export function emptyHub(): HubDocument {
  return {
    onboarding: Object.fromEntries(Object.keys(onboardingFields).map(key => [key, ""])) as Onboarding,
    onboardingPublished: false, deliveries: [], reports: [],
    brand: { description: "", colors: "", typography: "", rules: "", voice: "", assets: [], published: false },
    followUps: [], updates: [],
  };
}
/** Oportunidades brutas de exposição; não equivalem a pessoas únicas ou visualizações medidas. */
export function estimatedImpacts(metric: OutdoorMetric) {
  return Math.round(metric.dailyFlow * metric.days * metric.units * metric.factor);
}
