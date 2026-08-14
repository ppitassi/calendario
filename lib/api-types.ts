export type ApiParams = Record<string, string>;

export type LegacyPermission =
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

export type Permission = LegacyPermission | Uppercase<string>;

export type ApiContext = {
  userUid: string | null;
  userRole: string | null;
  isAuthenticated: boolean;
  permissions: Set<Permission>;
};
