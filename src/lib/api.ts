import * as clientsApi from "./api/clients-api";
import * as postsApi from "./api/posts-api";
import * as workItemsApi from "./api/work-items-api";
import * as usersAdminApi from "./api/users-admin-api";
import * as mediaUploadsApi from "./api/media-uploads-api";
import * as publicTokensApi from "./api/public-tokens-api";
import * as appApi from "./api/app-api";

export { API_URL, downloadPdf, notifyPostsUpdated } from "./api/core";
export type { ProductionGalleryFilters, ProductionGalleryResponse } from "./api/core";

export const api = {
  ...clientsApi,
  ...postsApi,
  ...workItemsApi,
  ...usersAdminApi,
  ...mediaUploadsApi,
  ...publicTokensApi,
  ...appApi,
};
