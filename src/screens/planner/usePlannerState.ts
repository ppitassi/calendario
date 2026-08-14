import { useState, useMemo, useEffect, useRef } from "react";
import { auth, useAuthState } from "../../lib/auth";
import { api } from "../../lib/api";
import { ROLE_PERMISSIONS, ROLE_LABELS, AppViewState, ClientData, AppConfig, PostData, UserRole } from "../../types";
import { getEditorCapabilities } from "../../lib/editor-capabilities";
import { DAY_NAMES } from "../../lib/constants";
import { usePlannerPersistence, loadPersistedViewState } from "./usePlannerPersistence";

export { loadPersistedViewState };

function monthToDate(month?: string) {
  return /^\d{4}-\d{2}$/.test(month || "") ? new Date(`${month}-01T12:00:00`) : new Date();
}

const DEFAULT_PLANNER_CONFIG: AppConfig = {
  activeDays: [1, 3, 5],
  defaultTypes: { 1: "post", 3: "carousel", 5: "reel" },
};

function normalizedPlannerConfig(value: unknown): AppConfig {
  const candidate = value && typeof value === "object" ? value as Partial<AppConfig> : {};
  const activeDays = Array.isArray(candidate.activeDays)
    ? Array.from(new Set(candidate.activeDays.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6))).sort()
    : DEFAULT_PLANNER_CONFIG.activeDays;
  const defaultTypes = candidate.defaultTypes && typeof candidate.defaultTypes === "object"
    ? { ...DEFAULT_PLANNER_CONFIG.defaultTypes, ...candidate.defaultTypes }
    : DEFAULT_PLANNER_CONFIG.defaultTypes;
  return {
    activeDays: activeDays.length ? activeDays : DEFAULT_PLANNER_CONFIG.activeDays,
    defaultTypes,
  };
}

function parsePostingFrequency(frequency?: string): number[] {
  const normalized = (frequency || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const matches: Array<[number, RegExp]> = [
    [0, /\bdomingo/i],
    [1, /\bsegunda/i],
    [2, /\bterca/i],
    [3, /\bquarta/i],
    [4, /\bquinta/i],
    [5, /\bsexta/i],
    [6, /\bsabado/i],
  ];
  return matches.filter(([, regex]) => regex.test(normalized)).map(([day]) => day);
}

function daysToFrequencyText(days: number[]): string {
  if (!days.length) return "";
  const sorted = [...days].sort((a, b) => a - b);
  const labels = sorted.map((d) => DAY_NAMES[d]);
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} e ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} e ${labels[labels.length - 1]}`;
}

export function usePlannerState() {
  const initialViewState = useMemo(() => loadPersistedViewState(), []);
  const persistedClientId = initialViewState?.currentClientId || initialViewState?.currentClient?.id || auth.currentUser?.ui_preferences?.selectedClientId || null;
  const [user, userLoading] = useAuthState(auth);
  const [appState, setAppState] = useState<AppViewState>(() => initialViewState?.appState || (auth.currentUser ? "home" : "login"));
  const [currentClient, setCurrentClient] = useState<ClientData | null>(null);
  const [isRestoringClient, setIsRestoringClient] = useState(Boolean(persistedClientId));
  const [userRole, setUserRole] = useState<UserRole>("designer");
  const [simulatedEditorRole, setSimulatedEditorRole] = useState<string | null>(null);
  const [productionGalleryFilters, setProductionGalleryFilters] = useState<{ status?: string; members?: string[] }>({});

  const [currentDate, setCurrentDate] = useState(() => monthToDate(initialViewState?.currentMonth));
  const [config, setConfig] = useState<AppConfig>(() => normalizedPlannerConfig(initialViewState?.plannerConfig));
  const [plannerFrequency, setPlannerFrequency] = useState<string>(() => initialViewState?.plannerFrequency || "");
  const initializedPlannerClientId = useRef<string | null>(null);

  const [posts, setPosts] = useState<Record<string, PostData>>({});
  const postsRef = useRef<Record<string, PostData>>({});
  const saveQueuesRef = useRef<Record<string, Promise<void>>>({});
  const saveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendingPostsRef = useRef<Record<string, PostData>>({});
  const activeClientIdRef = useRef<string | null>(null);
  const loadGenerationRef = useRef(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(() => initialViewState?.selectedDateStr || null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [customRoles, setCustomRoles] = useState<any[]>([]);

  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);
  const [mobilePane, setMobilePane] = useState<"calendar" | "editor" | "preview">("editor");
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isGeneratingPost, setIsGeneratingPost] = useState(false);
  const [isGeneratingMonth, setIsGeneratingMonth] = useState(false);

  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  useEffect(() => {
    activeClientIdRef.current = currentClient?.id || null;
  }, [currentClient?.id]);

  useEffect(() => () => {
    Object.values(saveTimersRef.current).forEach(clearTimeout);
    saveTimersRef.current = {};
    pendingPostsRef.current = {};
    loadGenerationRef.current += 1;
  }, []);

  usePlannerPersistence({
    user,
    appState,
    setAppState,
    currentClient,
    setCurrentClient,
    isRestoringClient,
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
    setUserRole,
    initializedPlannerClientId,
    parsePostingFrequency,
    DEFAULT_PLANNER_CONFIG,
  });

  const savePostInOrder = (clientId: string, date: string, post: PostData) => {
    const queueKey = `${clientId}:${date}`;
    const previousSave = saveQueuesRef.current[queueKey] || Promise.resolve();
    const nextSave = previousSave.catch(() => undefined).then(async () => {
      const calendarDate = post.date || date.split("#")[0];
      const saved = await api.savePost(clientId, calendarDate, { ...post, date: calendarDate });
      if (activeClientIdRef.current !== clientId) return;
      const latest = postsRef.current[date];
      if (latest && saved) {
        const merged = { ...latest, id: String(saved.id || latest.id || ""), workVersion: saved.workVersion ?? latest.workVersion };
        postsRef.current = { ...postsRef.current, [date]: merged };
        setPosts(postsRef.current);
      }
    });
    saveQueuesRef.current[queueKey] = nextSave;
    return nextSave;
  };

  const schedulePostSave = (clientId: string, date: string, post: PostData) => {
    const queueKey = `${clientId}:${date}`;
    pendingPostsRef.current[queueKey] = post;
    if (saveTimersRef.current[queueKey]) clearTimeout(saveTimersRef.current[queueKey]);
    setSaveState("saving");
    saveTimersRef.current[queueKey] = setTimeout(() => {
      delete saveTimersRef.current[queueKey];
      const latest = pendingPostsRef.current[queueKey];
      delete pendingPostsRef.current[queueKey];
      void savePostInOrder(clientId, date, latest)
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("error"));
    }, 650);
  };

  useEffect(() => {
    if (selectedDateStr && posts[selectedDateStr]?.id) {
      api.getPostComments(Number(posts[selectedDateStr].id)).then(setComments).catch(console.error);
    } else {
      setComments([]);
    }
  }, [selectedDateStr, posts, selectedDateStr && posts[selectedDateStr] ? posts[selectedDateStr].id : null]);

  useEffect(() => {
    if (user) api.getCustomRoles().then(setCustomRoles).catch(console.error);
  }, [user, appState]);

  const permissions = useMemo(() => {
    const effectiveRole = simulatedEditorRole || userRole;
    const defaultPerms = ROLE_PERMISSIONS[effectiveRole as UserRole] || ROLE_PERMISSIONS["designer"];
    const dbRole = customRoles.find((r: any) => r.id === effectiveRole);
    if (dbRole && dbRole.permissions) {
      try {
        const rolePermissions = typeof dbRole.permissions === "string" ? JSON.parse(dbRole.permissions) : dbRole.permissions;
        return { ...defaultPerms, ...rolePermissions };
      } catch {
        return defaultPerms;
      }
    }
    return defaultPerms;
  }, [userRole, simulatedEditorRole, customRoles]);

  const effectiveEditorRole = simulatedEditorRole || userRole;
  const effectiveCustomRole = customRoles.find((role: any) => role.id === effectiveEditorRole);
  const effectiveCustomPermissions = useMemo(() => {
    if (!effectiveCustomRole?.permissions) return undefined;
    try {
      return typeof effectiveCustomRole.permissions === "string" ? JSON.parse(effectiveCustomRole.permissions) : effectiveCustomRole.permissions;
    } catch {
      return undefined;
    }
  }, [effectiveCustomRole]);

  const editorCapabilities = useMemo(
    () => getEditorCapabilities(effectiveEditorRole, effectiveCustomPermissions),
    [effectiveEditorRole, effectiveCustomPermissions],
  );

  const editorRoleOptions = useMemo(() => {
    const defaults = (Object.keys(ROLE_LABELS) as UserRole[]).map((id) => ({ id, label: id === "admin" ? "Administrador" : ROLE_LABELS[id] }));
    const custom = customRoles
      .filter((role: any) => role?.id && !defaults.some((option) => option.id === role.id))
      .map((role: any) => ({ id: String(role.id), label: String(role.name || role.label || role.id) }));
    return [...defaults, ...custom];
  }, [customRoles]);

  useEffect(() => {
    if (!user || user.role !== "admin") setSimulatedEditorRole(null);
  }, [user]);

  useEffect(() => {
    const clientId = currentClient?.id;
    const generation = ++loadGenerationRef.current;
    postsRef.current = {};
    setPosts({});
    setSelectedDateStr((selected) => {
      if (!selected) return null;
      const selectedDate = new Date(`${selected}T12:00:00`);
      return selectedDate.getMonth() === currentDate.getMonth() && selectedDate.getFullYear() === currentDate.getFullYear()
        ? selected
        : null;
    });
    if (!clientId) return;
    api.getPosts(clientId).then((loaded) => {
      if (generation !== loadGenerationRef.current || activeClientIdRef.current !== clientId) return;
      postsRef.current = loaded;
      setPosts(loaded);
    }).catch(console.error);
  }, [currentClient, currentDate]);

  useEffect(() => {
    if (!user) return;
    if (user.role) setUserRole(user.role);
    if (appState === "login") setAppState(initialViewState?.appState || "home");
  }, [user, appState, initialViewState]);

  return {
    initialViewState,
    user,
    userLoading,
    appState,
    setAppState,
    currentClient,
    setCurrentClient,
    isRestoringClient,
    userRole,
    setUserRole,
    simulatedEditorRole,
    setSimulatedEditorRole,
    productionGalleryFilters,
    setProductionGalleryFilters,
    currentDate,
    setCurrentDate,
    config,
    setConfig,
    plannerFrequency,
    setPlannerFrequency,
    posts,
    setPosts,
    postsRef,
    pendingPostsRef,
    saveTimersRef,
    saveState,
    setSaveState,
    savePostInOrder,
    schedulePostSave,
    selectedDateStr,
    setSelectedDateStr,
    isConfirmDeleteOpen,
    setIsConfirmDeleteOpen,
    customRoles,
    isLeftCollapsed,
    setIsLeftCollapsed,
    isRightCollapsed,
    setIsRightCollapsed,
    mobilePane,
    setMobilePane,
    comments,
    setComments,
    newComment,
    setNewComment,
    isGeneratingPost,
    setIsGeneratingPost,
    isGeneratingMonth,
    setIsGeneratingMonth,
    permissions,
    editorCapabilities,
    editorRoleOptions,
    parsePostingFrequency,
    daysToFrequencyText,
  };
}
