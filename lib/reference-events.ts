/**
 * Tipos e Contratos para Datas Editoriais e Comemorativas (Editor V2).
 * Conforme Seção 6 do Plano Técnico.
 */

export type CalendarReferenceEventType =
  | "holiday"
  | "commemorative"
  | "health"
  | "awareness"
  | "campaign"
  | "religious"
  | "international"
  | "regional";

export interface CalendarEventSource {
  id: string;
  label: string;
  url: string;
  type: "official" | "institutional" | "news" | "dataset";
  role: "evidence" | "supporting";
  publisher?: string;
  publishedAt?: string; // ISO string
  primary: boolean;
  sourceVerifiedAt?: string;
  linkCheckedAt?: string;
  linkStatus: "unchecked" | "ok" | "broken" | "restricted";
}

export interface CalendarReferenceEvent {
  id: string;
  canonicalKey: string;
  title: string;
  description?: string;
  type: CalendarReferenceEventType;
  tags: string[];
  startsOn: string; // YYYY-MM-DD (data civil)
  endsOn: string;   // YYYY-MM-DD (limite exclusivo)
  allDay: true;
  country?: string;
  state?: string;
  cityCode?: string;
  scope: "global" | "country" | "state" | "city";
  verificationStatus: "verified" | "unverified" | "conflict";
  relevance: "official" | "recommended" | "supplemental";
  sources: CalendarEventSource[];
  recurrenceRule?: string;
  updatedAt: string;
}

export interface ExternalCalendarEvent {
  externalKey: string;
  title: string;
  description?: string;
  type: CalendarReferenceEventType;
  startsOn: string;
  endsOn: string;
  country?: string;
  state?: string;
  sourceUrl?: string;
  sourceLabel?: string;
}

export interface CalendarReferenceProvider {
  id: string;
  getEvents(input: {
    year: number;
    country: string;
    state?: string;
    cityCode?: string;
    signal?: AbortSignal;
  }): Promise<ExternalCalendarEvent[]>;
}
