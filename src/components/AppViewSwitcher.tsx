import { subMonths, addMonths } from "date-fns";
import { AppViewState, ClientData, UserRole } from "../types";
import { HomeScreen } from "../screens/HomeScreen";
import { ViewerScreen } from "../screens/ViewerScreen";
import { UserManagementScreen } from "../screens/UserManagementScreen";
import { ProductionGalleryScreen } from "../screens/ProductionGalleryScreen";
import { ClientManagementScreen } from "../screens/ClientManagementScreen";
import { LeiaChatScreen } from "../screens/LeiaChatScreen";
import { ClientSetupScreen } from "../screens/ClientSetupScreen";
import { ClientStrategyScreen } from "../screens/ClientStrategyScreen";
import { UserSetupScreen } from "../screens/UserSetupScreen";
import { AgencySetupScreen } from "../screens/AgencySetupScreen";
import { MainLayout } from "./MainLayout";
import { auth } from "../lib/auth";
import { rememberClientSelection, synchronizeClientUrl } from "../lib/client-selection";
import { AppError } from "./AppStatus";

type AppViewSwitcherProps = {
  appState: AppViewState;
  setAppState: (state: AppViewState) => void;
  currentClient: ClientData | null;
  setCurrentClient: (client: ClientData | null) => void;
  setUserRole: (role: UserRole) => void;
  user: any;
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  posts: Record<string, any>;
  setSelectedDateStr: (dateStr: string | null) => void;
  productionGalleryFilters: any;
  setProductionGalleryFilters: (filters: any) => void;
  handleNavigate: (screen: string) => void;
  simulatedEditorRole: string | null;
  setSimulatedEditorRole: (role: string | null) => void;
  editorRoleOptions: Array<{ id: string; label: string }>;
};

export function AppViewSwitcher({
  appState,
  setAppState,
  currentClient,
  setCurrentClient,
  setUserRole,
  user,
  currentDate,
  setCurrentDate,
  posts,
  setSelectedDateStr,
  productionGalleryFilters,
  setProductionGalleryFilters,
  handleNavigate,
  simulatedEditorRole,
  setSimulatedEditorRole,
  editorRoleOptions,
}: AppViewSwitcherProps) {
  const selectClient = (client: ClientData, role: string, destination: string) => {
    setSelectedDateStr(null);
    setCurrentClient(client);
    setUserRole(role as UserRole);
    synchronizeClientUrl(client.id, currentDate);
    void rememberClientSelection(client.id).catch(() => undefined);
    setAppState((destination === "planner" ? "editor" : destination) as AppViewState);
  };
  if (appState === "home") {
    return (
      <HomeScreen
        onOpenAdmin={() => setAppState("admin_roles")}
        onSelectClient={selectClient}
        onNavigate={handleNavigate}
        currentClient={currentClient}
        onOpenProduction={(filters) => {
          setProductionGalleryFilters(filters || {});
          setAppState("production_gallery");
        }}
        simulatedRole={simulatedEditorRole}
        onSimulatedRoleChange={setSimulatedEditorRole}
        roleOptions={editorRoleOptions}
      />
    );
  }

  if (appState === "production_gallery") {
    return (
      <ProductionGalleryScreen
        onExit={() => setAppState("home")}
        onNavigate={handleNavigate}
        initialFilters={productionGalleryFilters}
        onOpenPost={(client, post) => {
          setCurrentClient(client);
          const date = String(post.date || "");
          if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            setCurrentDate(new Date(`${date}T12:00:00`));
            setSelectedDateStr(date);
          }
          setAppState("editor");
        }}
      />
    );
  }

  if (appState === "admin_roles") {
    return (
      <UserManagementScreen
        onExit={() => setAppState("home")}
        currentClient={currentClient}
        onNavigate={handleNavigate}
      />
    );
  }

  if (appState === "agency_setup" && user?.role === "admin") {
    return (
      <MainLayout
        activeScreen="agency_setup"
        onNavigate={handleNavigate}
        currentClient={currentClient}
      >
        <AgencySetupScreen
          onClose={() => setAppState("home")}
          onSave={(data) => {
            auth.currentUser = {
              ...auth.currentUser,
              agencyName: data.name,
              agencySlogan: data.slogan,
              agencyLogo: data.logo_url,
              agencyLogoDark: data.logo_dark_url,
              theme_config: data.theme_config,
              planning_month: data.planning_month,
              deadline_pre: data.deadline_pre,
              deadline_final: data.deadline_final,
            };
            setAppState("home");
          }}
        />
      </MainLayout>
    );
  }

  if (appState === "viewer" && currentClient) {
    return (
      <ViewerScreen
        posts={posts}
        client={currentClient}
        userRole={user?.role || "designer"}
        username={user?.displayName || "Leonardo"}
        user={user}
        currentClient={currentClient}
        currentDate={currentDate}
        onExit={() => setAppState("home")}
        onPrevMonth={() => setCurrentDate(subMonths(currentDate, 1))}
        onNextMonth={() => setCurrentDate(addMonths(currentDate, 1))}
        onNavigate={handleNavigate}
      />
    );
  }

  if (appState === "client_management") {
    return (
      <ClientManagementScreen
        onSelectClient={selectClient}
        currentClient={currentClient}
        onNavigate={handleNavigate}
      />
    );
  }

  if (appState === "client_setup" && currentClient) {
    return (
      <ClientSetupScreen
        clientId={currentClient.id}
        currentClient={currentClient}
        onExit={() => setAppState("editor")}
        onNavigate={handleNavigate}
      />
    );
  }

  if (appState === "client_strategy") {
    return (
      <ClientStrategyScreen
        currentClient={currentClient}
        onSelectClient={setCurrentClient}
        onNavigate={handleNavigate}
      />
    );
  }

  if (appState === "user_setup") {
    return (
      <UserSetupScreen
        currentClient={currentClient}
        onExit={() => setAppState("home")}
        onNavigate={handleNavigate}
      />
    );
  }

  if (appState === "leia_chat") {
    return <LeiaChatScreen currentClient={currentClient} onNavigate={handleNavigate} />;
  }

  return <AppError title="Esta área não pôde ser aberta" message="A navegação foi preservada, mas o destino solicitado não está disponível nesta versão." onRetry={() => handleNavigate("home")} />;
}
