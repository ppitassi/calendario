import { ROLE_PERMISSIONS, UserRole } from '../types';

export type EditorCapabilities = {
  canViewCopy: boolean;
  canEditCopy: boolean;
  canEditMedia: boolean;
  canUploadArtwork: boolean;
  canEditStrategy: boolean;
  canApprovePost: boolean;
  canDeletePost: boolean;
  canViewInternalNotes: boolean;
  canEditInternalNotes: boolean;
  canComment: boolean;
  canConfigClients: boolean;
};

type PermissionSource = Partial<(typeof ROLE_PERMISSIONS)[UserRole]>;

export function getEditorCapabilities(role: string, customPermissions?: PermissionSource): EditorCapabilities {
  const editorRole = role === 'estagiario' ? 'designer' : role;
  const defaults = ROLE_PERMISSIONS[editorRole as UserRole] || ROLE_PERMISSIONS.designer;
  const permissions = { ...defaults, ...(customPermissions || {}) };
  const canWorkOnPost = Boolean(permissions.canCreatePosts || permissions.canEditAssignedPosts);

  return {
    canViewCopy: Boolean(permissions.canViewPresentation || canWorkOnPost),
    // A visualização de Designer é deliberadamente somente leitura para Head/Subhead.
    canEditCopy: editorRole !== 'designer' && canWorkOnPost,
    canEditMedia: canWorkOnPost,
    canUploadArtwork: canWorkOnPost,
    canEditStrategy: canWorkOnPost,
    canApprovePost: Boolean(permissions.canReviewAndSend),
    canDeletePost: Boolean(permissions.canEditCalendar),
    // Estes campos já eram visíveis e editáveis para todas as funções no editor.
    canViewInternalNotes: true,
    canEditInternalNotes: true,
    canComment: Boolean(permissions.canComment),
    canConfigClients: Boolean(permissions.canConfigClients),
  };
}
