import { useEffect } from "react";
import { format } from "date-fns";
import { api } from "../../lib/api";
import { AppViewState } from "../../types";

const VIEW_STATE_KEY = "content_planner_view_state";

const VALID_APP_STATES = new Set<AppViewState>([
  "login",
  "home",
  "client_selection",
  "editor",
  "planner",
  "viewer",
  "admin_roles",
  "client_setup",
  "user_setup",
  "client_strategy",
  "client_management",
  "leia_chat",
  "production_gallery",
]);

const CLIENT_REQUIRED_STATES = new Set<AppViewState>([
  "editor",
  "planner",
  "viewer",
  "client_setup",
]);

export function loadPersistedViewState(): any {
  if (typeof window === "undefined") return null;
  if (new URLSearchParams(window.location.search).get("recover") === "1") {
    return { appState: "home", currentClientId: null, currentClient: null };
  }
  try {
    const parsed = JSON.parse(localStorage.getItem(VIEW_STATE_KEY) || "null");
    if (!parsed || typeof parsed !== "object") return null;
    const appState = VALID_APP_STATES.has(parsed.appState) ? parsed.appState as AppViewState : "home";
    const currentClientId = typeof parsed.currentClientId === "string" && parsed.currentClientId.trim()
      ? parsed.currentClientId
      : typeof parsed.currentClient?.id === "string" && parsed.currentClient.id.trim()
        ? parsed.currentClient.id
        : null;
    return {
      ...parsed,
      appState: CLIENT_REQUIRED_STATES.has(appState) && !currentClientId ? "home" : appState,
      currentClientId,
    };
  } catch {
    localStorage.removeItem(VIEW_STATE_KEY);
    return null;
  }
}

export function usePlannerPersistence({
  user,
  appState,
  setAppState,
  currentClient,
  setCurrentClient,
  setIsRestoringClient,
  persistedClientId,
  initialViewState,
  currentDate,
  setCurrentDate,
  selectedDateStr,
  setSelectedDateStr,
  plannerFrequency,
  setPlannerFrequency,
  config,
  setConfig,
  setPosts,
  initializedPlannerClientId,
  parsePostingFrequency,
  DEFAULT_PLANNER_CONFIG,
}: any) {
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const applyNotificationRoute = async () => {
      const params = new URLSearchParams(window.location.search);
      const screen = params.get("screen");
      const clientId = params.get("clientId");
      const postId = params.get("postId");
      if (screen === "user_setup") {
        setAppState("user_setup");
        return;
      }
      if (!clientId) return;
      try {
        const client = await api.getClient(clientId);
        if (!client || cancelled) return;
        setCurrentClient(client);
        if (postId) {
          const loaded = await api.getPosts(clientId);
          if (cancelled) return;
          setPosts(loaded);
          const found = Object.entries(loaded).find(([, post]) => String(post.id) === postId);
          if (!found) {
            window.dispatchEvent(new CustomEvent("app-notification-unavailable"));
            return;
          }
          setSelectedDateStr(found[0]);
          setCurrentDate(new Date(found[0] + "T12:00:00"));
          setAppState("editor");
          return;
        }
        setAppState(VALID_APP_STATES.has(screen as AppViewState) && screen !== "home" ? screen as AppViewState : "editor");
      } catch {
        window.dispatchEvent(new CustomEvent("app-notification-unavailable"));
      }
    };
    void applyNotificationRoute();
    window.addEventListener("app:navigate-notification", applyNotificationRoute);
    return () => {
      cancelled = true;
      window.removeEventListener("app:navigate-notification", applyNotificationRoute);
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!initialViewState?.currentClient) return;
    const { currentClient: _legacyClient, userRole: _legacyRole, ...safeState } = initialViewState;
    localStorage.setItem(VIEW_STATE_KEY, JSON.stringify({ ...safeState, currentClientId: persistedClientId }));
  }, [initialViewState, persistedClientId]);

  useEffect(() => {
    if (!user || !persistedClientId || currentClient) {
      if (user) setIsRestoringClient(false);
      return;
    }
    let cancelled = false;
    api
      .getClient(persistedClientId)
      .then((client) => {
        if (!cancelled && client) setCurrentClient(client);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setIsRestoringClient(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, persistedClientId, currentClient]);

  useEffect(() => {
    if (!currentClient?.id || initializedPlannerClientId.current === currentClient.id) return;
    initializedPlannerClientId.current = currentClient.id;
    if (persistedClientId === currentClient.id && initialViewState?.plannerConfig) {
      const persisted = initialViewState.plannerConfig;
      setConfig({
        activeDays: Array.isArray(persisted.activeDays) && persisted.activeDays.length
          ? persisted.activeDays.filter((day: unknown) => Number.isInteger(day) && Number(day) >= 0 && Number(day) <= 6)
          : DEFAULT_PLANNER_CONFIG.activeDays,
        defaultTypes: persisted.defaultTypes && typeof persisted.defaultTypes === "object"
          ? { ...DEFAULT_PLANNER_CONFIG.defaultTypes, ...persisted.defaultTypes }
          : DEFAULT_PLANNER_CONFIG.defaultTypes,
      });
      setPlannerFrequency(initialViewState?.plannerFrequency || currentClient.postFrequency || "");
      return;
    }
    const frequency = currentClient.postFrequency || "";
    const parsedDays = parsePostingFrequency(frequency);
    setPlannerFrequency(frequency);
    setConfig((prev: any) => ({
      ...prev,
      activeDays: parsedDays.length ? parsedDays : DEFAULT_PLANNER_CONFIG.activeDays,
      defaultTypes: { ...DEFAULT_PLANNER_CONFIG.defaultTypes, ...prev.defaultTypes },
    }));
  }, [currentClient?.id, initialViewState, persistedClientId]);

  useEffect(() => {
    if (!user || appState === "login") return;
    localStorage.setItem(
      VIEW_STATE_KEY,
      JSON.stringify({
        appState,
        currentClientId: currentClient?.id || null,
        currentMonth: format(currentDate, "yyyy-MM"),
        selectedDateStr,
        plannerFrequency,
        plannerConfig: config,
      }),
    );
  }, [user, appState, currentClient?.id, currentDate, selectedDateStr, plannerFrequency, config]);
}
