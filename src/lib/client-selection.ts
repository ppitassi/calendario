import { format } from "date-fns";
import { api } from "./api";
import { auth } from "./auth";

export function normalizedSearchText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function recentClientIdsFrom(value: unknown, accessibleIds?: Set<string>) {
  const ids = Array.isArray(value) ? value.map(String) : [];
  return Array.from(new Set(ids)).filter((id) => !accessibleIds || accessibleIds.has(id)).slice(0, 6);
}

export async function rememberClientSelection(clientId: string, accessibleIds?: Set<string>) {
  const preferences = auth.currentUser?.ui_preferences || {};
  const recent = recentClientIdsFrom(preferences.recentClientIds, accessibleIds).filter((id) => id !== clientId);
  const patch = { selectedClientId: clientId, recentClientIds: [clientId, ...recent].slice(0, 6) };
  if (auth.currentUser) auth.currentUser.ui_preferences = { ...preferences, ...patch };
  return api.updateUiPreferences(patch);
}

export function synchronizeClientUrl(clientId: string, date = new Date()) {
  const url = new URL(window.location.href);
  url.searchParams.set("clientId", clientId);
  url.searchParams.set("month", format(date, "yyyy-MM"));
  url.searchParams.delete("postId");
  url.searchParams.delete("selectClient");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}
