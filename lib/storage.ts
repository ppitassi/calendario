export {
  matchesFileSignature,
  localUploadsRoot,
  localFallbackEnabled,
  MIME_EXTENSIONS,
  FILE_EXTENSIONS,
} from "./storage/core";

export {
  safeSegment,
  formatCalendarMonthFolder,
  buildLocalMediaPath,
  storeMediaLocally,
} from "./storage/local-provider";

export {
  buildPostAssetPath,
  canonicalAssetsRoot,
  compactSlug,
  fileExtension,
  isDocumentCategory,
  plannerFormat,
  publicPostsRoot,
  titleSlug,
  validateUploadName,
} from "./storage/asset-paths";

export {
  createNextcloudFolders,
  createPublicShare,
  deletePublicShare,
  nextcloudAuth,
  publicDavBase,
  storeAssetBuffer,
  initDirectNextcloudUpload,
  finalizeDirectNextcloudUpload,
  isNextcloudConfigured,
  storeMedia,
  deleteStoredAsset,
} from "./storage/nextcloud-provider";

export type { StoreMediaInput } from "./storage/nextcloud-provider";

import { localUploadsRoot } from "./storage/core";

if (process.env.NODE_ENV === "production") {
  localUploadsRoot();
  console.info("[storage] persistent upload root validated");
}
