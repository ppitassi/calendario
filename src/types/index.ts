// ─── App State ───────────────────────────────────────────────────────────────
export type AppViewState = 'login' | 'home' | 'client_selection' | 'editor' | 'viewer' | 'admin_roles' | 'data_analysis' | 'client_setup' | 'user_setup' | 'client_strategy' | 'client_management' | 'leia_chat' | 'analytics_growth' | 'analytics_visibility' | 'analytics_primetime' | 'analytics_content';

export type PostType = 'post' | 'carousel' | 'reel' | 'story' | 'linkedin' | 'promoted';

export type ViewMode = 'list' | 'grid';

export type UserRole = 'admin' | 'gerente' | 'atendimento' | 'designer' | 'estagiario' | 'analista' | 'socialmedia';

// ─── Permissions matrix ──────────────────────────────────────────────────────
export const ROLE_PERMISSIONS: Record<UserRole, {
  canCreatePosts: boolean;
  canEditAssignedPosts: boolean;
  canEditCalendar: boolean; // Mudar datas e prazos
  canReviewAndSend: boolean;
  canConfigClients: boolean;
  canManageRoles: boolean;
  canViewPresentation: boolean;
  canComment: boolean;
}> = {
  admin: {
    canCreatePosts: true,
    canEditAssignedPosts: true,
    canEditCalendar: true,
    canReviewAndSend: true,
    canConfigClients: true,
    canManageRoles: true,
    canViewPresentation: true,
    canComment: true,
  },
  gerente: {
    canCreatePosts: true,
    canEditAssignedPosts: true,
    canEditCalendar: true, // Gerentes podem mudar datas e prazos
    canReviewAndSend: true, // Gerentes podem aprovar e enviar
    canConfigClients: true,
    canManageRoles: false, // Mas não gerenciam cargos
    canViewPresentation: true,
    canComment: true,
  },
  atendimento: {
    canCreatePosts: false,
    canEditAssignedPosts: false,
    canEditCalendar: false,
    canReviewAndSend: true, // Atendimento envia ao cliente
    canConfigClients: true,
    canManageRoles: false,
    canViewPresentation: true,
    canComment: true,
  },
  designer: {
    canCreatePosts: true,
    canEditAssignedPosts: true,
    canEditCalendar: true,
    canReviewAndSend: false,
    canConfigClients: true,
    canManageRoles: false,
    canViewPresentation: true,
    canComment: false, // Designer não comenta
  },
  estagiario: {
    canCreatePosts: false,
    canEditAssignedPosts: true,
    canEditCalendar: false,
    canReviewAndSend: false,
    canConfigClients: false,
    canManageRoles: false,
    canViewPresentation: true,
    canComment: false, // Estagiário não comenta
  },
  analista: {
    canCreatePosts: false,
    canEditAssignedPosts: false,
    canEditCalendar: false,
    canReviewAndSend: false,
    canConfigClients: false,
    canManageRoles: false,
    canViewPresentation: true,
    canComment: false, // Analista não comenta
  },
  socialmedia: {
    canCreatePosts: true,
    canEditAssignedPosts: true,
    canEditCalendar: true,
    canReviewAndSend: true,
    canConfigClients: true,
    canManageRoles: false,
    canViewPresentation: true,
    canComment: true, // Social Media comenta!
  },
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  gerente: 'Gerente',
  atendimento: 'Atendimento',
  designer: 'Designer',
  estagiario: 'Estagiário',
  analista: 'Analista de Dados',
  socialmedia: 'Social Media',
};

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
  tenant_id?: string;
  // Meta / Instagram
  meta_access_token?: string;
  meta_account_id?: string;
  facebook_page_id?: string;
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
  id?: string;
  date?: string;
  type: PostType;
  head: string;
  subhead: string;
  subtitle: string;
  objective: string;
  theme?: string;
  script?: string;
  feedImages: string[] | string;
  storyImage?: string;
  coverImage?: string;
  linkedinCover?: string;
  videoUrl?: string;
  assignedTo?: string;
  deadline?: string | number;
  comments?: { text: string; author: string; date: number }[];
  status?: 'pending' | 'producing' | 'review' | 'waiting' | 'approved' | 'planejado' | 'em produção' | 'aguardando aprovação' | 'aprovado' | 'ajuste solicitado';
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
  funnelStage?: 'topo' | 'meio' | 'fundo';
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
  audioRecordings?: Array<{ id: string; name: string; url: string; createdAt: number; duration?: number }>;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: UserRole;
  tenant_id?: string;
  theme_config?: any;
  ui_preferences?: Record<string, any>;
  deadline?: string;
  planning_month?: string;
  deadline_pre?: string;
  deadline_final?: string;
  agencyName?: string;
  birthday?: string;
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
  status: 'pending' | 'approved' | 'changes_requested';
  createdAt: number;
  expiresAt: number;
  clientNote?: string;
}
