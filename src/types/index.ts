export type AppViewState =
  | "login"
  | "home"
  | "client_selection"
  | "editor"
  | "planner"
  | "viewer"
  | "admin_roles"
  | "agency_setup"
  | "client_setup"
  | "user_setup"
  | "client_strategy"
  | "client_management"
  | "leia_chat"
  | "production_gallery"
  | "operations";

export type PostType =
  | "post"
  | "carousel"
  | "reel"
  | "story"
  | "linkedin"
  | "promoted";

export type ViewMode = "list" | "grid";

export type { UserRole } from "./roles";
export { ROLE_PERMISSIONS, ROLE_LABELS } from "./roles";

// ─── Data Models ─────────────────────────────────────────────────────────────
export interface ClientData {
  id: string;
  name: string;
  logoUrl?: string;
  hasPreCalendar?: boolean;
  whatsappGroupId?: string;
  segment?: string;
  voiceTone?: string;
  targetAudience?: string;
  contentColumns?: string;
  brandNotes?: string;
  postFrequency?: string;
  networks?: string;
  visualInfo?: string;
  socialLinks: {
    instagram?: string;
    linkedin?: string;
  };
  instagramStats?: {
    followers?: string;
    following?: string;
    handle?: string;
    bio?: string;
    name?: string;
    postsCount?: string | number;
  };
  owners: string[];
  config?: any;
  // Meta / Instagram
  meta_access_token?: string;
  meta_account_id?: string;
  facebook_page_id?: string;
  meta_page_name?: string;
  meta_ig_username?: string;
  meta_connected?: boolean;
  meta_connection_status?: string;
  // YouTube
  youtube_token?: string;
  youtube_channel_id?: string;
  // TikTok
  tiktok_token?: string;
  tiktok_username?: string;
  // LinkedIn
  linkedin_token?: string;
  linkedin_org_id?: string;
  // X (Twitter)
  x_token?: string;
  x_username?: string;
  // Legacy fields (kept for backwards compatibility)
  x_api_key?: string;
  x_api_secret?: string;
  tiktok_access_token?: string;
  youtube_api_key?: string;
  linkedin_access_token?: string;
  createdAt?: number;
}

export interface PostData {
  postNumber?: number;
  id?: string;
  date?: string;
  type: PostType;
  head: string;
  subhead: string;
  subtitle: string;
  objective: string;
  theme?: string;
  script?: string;
  feedImages: string[];
  storyImage?: string;
  coverImage?: string;
  linkedinCover?: string;
  videoUrl?: string;
  assignedTo?: string;
  assigneeId?: string;
  createdByUserId?: string;
  currentAssigneeId?: string;
  actionAssigneeId?: string;
  currentStage?:
    | "briefing"
    | "copy"
    | "aguardando_design"
    | "design"
    | "revisao_interna"
    | "aguardando_aprovacao"
    | "alteracoes_solicitadas"
    | "aprovado"
    | "agendado"
    | "publicado"
    | "arquivado"
    | "cancelado";
  workflowStatus?: string;
  assignedAt?: string;
  dueDate?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  workVersion?: number;
  stageEnteredAt?: string;
  lastActivityAt?: string;
  artworkCurrentVersion?: number;
  deadline?: string | number;
  comments?: { text: string; author: string; date: number }[];
  status?:
    | "pending"
    | "producing"
    | "review"
    | "waiting"
    | "approved"
    | "planejado"
    | "em produção"
    | "aguardando aprovação"
    | "aprovado"
    | "ajuste solicitado";
  createdAt?: number;
  updatedAt?: number;
  title?: string;
  channel?: string;
  centralIdea?: string;
  caption?: string;
  artHeadline?: string;
  artText?: string;
  cta?: string;
  hashtags?: string;
  visualBriefing?: string;
  internalNotes?: string;
  funnelStage?: "topo" | "meio" | "fundo";
}

export interface AppConfig {
  activeDays: number[];
  defaultTypes: Record<number, PostType>;
  sector?: string;
  tags?: string[];
  briefing?: string;
  objectives?: string;
  competitors?: string;
  targetAudience?: string;
  trafficDef?: string;
  inputs?: string;
  audioRecordings?: Array<{
    id: string;
    name: string;
    url: string;
    createdAt: number;
    duration?: number;
  }>;
}

export interface UserProfile {
  uid: string;
  email: string;
  password?: string;
  displayName?: string;
  photoURL?: string;
  role: import("./roles").UserRole;
  theme_config?: any;
  ui_preferences?: Record<string, any>;
  permissions?: Record<string, boolean>;
  deadline?: string;
  planning_month?: string;
  deadline_pre?: string;
  deadline_final?: string;
  agencyName?: string;
  birthday?: string;
  phoneNumber?: string;
  githubUsername?: string;
  portfolioUrl?: string;
}

export interface CompanionSettings {
  locationName: string;
  showWeather: boolean;
  showTrends: boolean;
  showCalendar: boolean;
  showHolidays: boolean;
  hasConfigured: boolean;
}

export interface ApprovalToken {
  id: string;
  clientId: string;
  month: string;
  status: "pending" | "approved" | "changes_requested";
  createdAt: number;
  expiresAt: number;
  clientNote?: string;
}
