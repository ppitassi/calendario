export type ApiParams = Record<string, string>;

export type Permission =
  | "canCreatePosts"
  | "canEditAssignedPosts"
  | "canEditCalendar"
  | "canReviewAndSend"
  | "canConfigClients"
  | "canManageBrandSystem"
  | "canManageRoles"
  | "canViewPresentation"
  | "canViewProductionGallery"
  | "canComment";

export type ApiContext = {
  userUid: string | null;
  userRole: string | null;
  isAuthenticated: boolean;
  permissions: Set<Permission>;
};
