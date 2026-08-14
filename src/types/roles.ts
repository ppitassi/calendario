export type UserRole =
  | "admin"
  | "gerente"
  | "atendimento"
  | "designer"
  | "estagiario"
  | "analista"
  | "socialmedia";

export const ROLE_PERMISSIONS: Record<
  UserRole,
  {
    canCreatePosts: boolean;
    canEditAssignedPosts: boolean;
    canEditCalendar: boolean;
    canReviewAndSend: boolean;
    canConfigClients: boolean;
    canManageBrandSystem: boolean;
    canManageRoles: boolean;
    canViewPresentation: boolean;
    canViewProductionGallery: boolean;
    canComment: boolean;
  }
> = {
  admin: {
    canCreatePosts: true,
    canEditAssignedPosts: true,
    canEditCalendar: true,
    canReviewAndSend: true,
    canConfigClients: true,
    canManageBrandSystem: true,
    canManageRoles: true,
    canViewPresentation: true,
    canViewProductionGallery: true,
    canComment: true,
  },
  gerente: {
    canCreatePosts: true,
    canEditAssignedPosts: true,
    canEditCalendar: true,
    canReviewAndSend: true,
    canConfigClients: true,
    canManageBrandSystem: true,
    canManageRoles: false,
    canViewPresentation: true,
    canViewProductionGallery: true,
    canComment: true,
  },
  atendimento: {
    canCreatePosts: false,
    canEditAssignedPosts: false,
    canEditCalendar: false,
    canReviewAndSend: true,
    canConfigClients: true,
    canManageBrandSystem: false,
    canManageRoles: false,
    canViewPresentation: true,
    canViewProductionGallery: true,
    canComment: true,
  },
  designer: {
    canCreatePosts: true,
    canEditAssignedPosts: true,
    canEditCalendar: true,
    canReviewAndSend: false,
    canConfigClients: true,
    canManageBrandSystem: false,
    canManageRoles: false,
    canViewPresentation: true,
    canViewProductionGallery: true,
    canComment: false,
  },
  estagiario: {
    canCreatePosts: false,
    canEditAssignedPosts: true,
    canEditCalendar: false,
    canReviewAndSend: false,
    canConfigClients: false,
    canManageBrandSystem: false,
    canManageRoles: false,
    canViewPresentation: true,
    canViewProductionGallery: true,
    canComment: false,
  },
  analista: {
    canCreatePosts: false,
    canEditAssignedPosts: false,
    canEditCalendar: false,
    canReviewAndSend: false,
    canConfigClients: false,
    canManageBrandSystem: false,
    canManageRoles: false,
    canViewPresentation: true,
    canViewProductionGallery: true,
    canComment: false,
  },
  socialmedia: {
    canCreatePosts: true,
    canEditAssignedPosts: true,
    canEditCalendar: true,
    canReviewAndSend: true,
    canConfigClients: true,
    canManageBrandSystem: false,
    canManageRoles: false,
    canViewPresentation: true,
    canViewProductionGallery: true,
    canComment: true,
  },
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  gerente: "Gerente",
  atendimento: "Atendimento",
  designer: "Designer",
  estagiario: "Estagiário",
  analista: "Analista de Dados",
  socialmedia: "Social Media",
};
