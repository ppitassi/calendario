/** Contratos compartilhados entre as APIs, o editor e os componentes de apresentação. */

/** Papéis reconhecidos pelas verificações de autorização e pela interface administrativa. */
export type UserRole = "admin" | "social_media" | "designer";
/** Estados possíveis do cadastro antes e depois da decisão do administrador. */
export type UserStatus = "pending" | "approved" | "rejected";

/** Usuário seguro para respostas e componentes; deliberadamente não inclui a senha. */
export type SafeUser = {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
};

/** Alias usado onde o domínio pede `User`, mantendo o mesmo formato seguro. */
export type User = SafeUser;


/** Cliente e projeções opcionais acrescentadas pela consulta do mês selecionado. */
export type Client = {
  id: string;
  name: string;
  segment?: string;
  tone?: string;
  audience?: string;
  strategy?: string;
  accent?: string;
  profiles?: string;
  posting_days?: number[];
  weekday_formats?: Record<number, ContentType>;
  logo_url?: string;
  has_multiple_profiles?: number | boolean;
  has_pre_calendar?: number | boolean;
  created_by_id: string;
  creator_name?: string;
  calendars_count?: number;
  month_calendar_id?: string;
  month_calendar_status?: CalendarStatus;
  month_calendar_title?: string;
  month_client_feedback_status?: string;
  month_client_feedback?: string;
  month_client_feedback_at?: string;
  month_is_pre_calendar?: number | boolean;
  month_share_token?: string;
  month_items_count?: number;
  created_at: string;
};

/** Etapas persistidas do fluxo editorial de um calendário. */
export type CalendarStatus = "draft" | "sent_to_designer" | "in_production" | "sent_to_social_media" | "approved";

/** Formatos editoriais aceitos para uma publicação. */
export type ContentType = "Feed" | "Story" | "Feed e Story" | "Carrossel" | "Reels";
/** Estados de execução de uma publicação dentro do calendário. */
export type ContentStatus = "Ideia" | "Produção" | "Revisão" | "Aprovado";

/** Publicação no formato camelCase consumido pelo editor e pelas prévias. */
export type ContentItem = {
  id: string;
  date: string;
  title: string;
  type: ContentType;
  status: ContentStatus;
  channel: string;
  profile?: string;
  isCollab?: boolean;
  collabProfile?: string;
  objective?: string;
  head?: string;
  subhead?: string;
  caption: string;
  visual: string;
  imageUrl: string;
  storyUrl?: string;
  cta?: string;
  hashtags?: string;
  funnelStage?: "Topo" | "Meio" | "Fundo";
  internalNotes?: string;
  orderIndex?: number;
  clientComment?: string;
  isExtra?: boolean;
  extraFormat?: string;
};

export const EXTRA_FORMAT_OPTIONS = [
  "Banner",
  "Story Extra",
  "Encarte",
  "Impresso",
  "Capa",
  "Criativo Avulso",
  "Outro",
] as const;

export type ExtraFormat = (typeof EXTRA_FORMAT_OPTIONS)[number];

/** Calendário com os dados opcionais vindos dos joins de cliente, criador e responsável. */
export type CalendarRecord = {
  id: string;
  client_id: string;
  title: string;
  month: string;
  brand: string;
  project: string;
  accent: string;
  strategy: string;
  audience: string;
  objective: string;
  segment?: string;
  tone?: string;
  pillars?: string;
  posting_days?: number[];
  weekday_formats?: Record<number, ContentType>;
  status: CalendarStatus;
  created_by_id: string;
  assigned_to_id?: string | null;
  creator_name?: string;
  creator_role?: UserRole;
  assigned_name?: string | null;
  assigned_role?: UserRole | null;
  client_name?: string;
  client_segment?: string;
  client_tone?: string;
  client_audience?: string;
  client_strategy?: string;
  client_logo_url?: string;
  client_has_multiple_profiles?: number | boolean;
  items_count?: number;
  created_at: string;
  updated_at: string;
  shareToken?: string;
  share_token?: string;
  clientFeedback?: string;
  client_feedback?: string;
  clientFeedbackStatus?: "approved" | "approved_with_notes" | "rejected_with_notes" | "approve" | "approve_with_notes" | "reject_with_notes" | string;
  client_feedback_status?: string;
  clientFeedbackAt?: string;
  client_feedback_at?: string;
  is_pre_calendar?: number | boolean;
  isPreCalendar?: boolean;
  client_has_pre_calendar?: number | boolean;
  has_pre_calendar?: number | boolean;
  cycle_id?: string | null;
  global_deadline?: string | null;
};

/** Ciclo compartilhado de entrega de calendários */
export type CalendarCycle = {
  id: string;
  month: string;
  title: string;
  global_deadline: string;
  notes?: string;
  created_by_id?: string;
  created_at: string;
  updated_at: string;
};

/** Notificação persistida para um usuário, inclusive seu estado de leitura. */
export type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  is_read: number;
  created_at: string;
};
