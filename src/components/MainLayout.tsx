import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { LogOut, Menu, X, Search } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { auth, signOut } from "../lib/auth";
import { ThemeToggle } from "./ThemeToggle";
import { ProfileModal } from "../modals/ProfileModal";
import { api } from "../lib/api";
import { MainLayoutSidebar } from "./main-layout/MainLayoutSidebar";
import { ClientData } from "../types";
import {
  rememberClientSelection,
  synchronizeClientUrl,
} from "../lib/client-selection";
import { HeaderNotificationsButton } from "../contexts/AppNotificationsContext";
import { LiquidTooltipLayer } from "./LiquidTooltipLayer";
import { Button } from "./ui/Button/Button";
import { IconButton } from "./ui/IconButton/IconButton";
import { cn } from "../lib/utils";
import styles from "./MainLayout.module.css";

interface MainLayoutProps {
  children: React.ReactNode;
  activeScreen: string;
  onNavigate: (screen: string) => void;
  currentClient?: any;
  onClientChange?: (client: any) => void;
  headerContext?: React.ReactNode;
}

export function MainLayout({
  children,
  activeScreen,
  onNavigate,
  currentClient,
  onClientChange,
  headerContext,
}: MainLayoutProps) {
  const { isDark } = useTheme();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState(
    auth.currentUser?.displayName || "",
  );
  const birthdayInput = auth.currentUser?.birthday || "";

  const [isPinned, setIsPinned] = useState(
    Boolean(auth.currentUser?.ui_preferences?.sidebarPinned),
  );
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [accessibleClients, setAccessibleClients] = useState<ClientData[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientsError, setClientsError] = useState(false);
  const [openClientSelector, setOpenClientSelector] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const glistenFrame = useRef<number | null>(null);

  useEffect(() => {
    let expanded = Boolean(auth.currentUser?.ui_preferences?.sidebarPinned);
    try {
      const stored = sessionStorage.getItem("content-planner:sidebar-expanded");
      if (stored !== null) expanded = stored === "true";
    } catch {}
    setIsPinned(expanded);
  }, []);

  useEffect(() => setIsMobileOpen(false), [activeScreen]);

  useEffect(() => {
    setOpenClientSelector(
      new URLSearchParams(window.location.search).get("selectClient") === "1",
    );
  }, []);

  useEffect(() => {
    let active = true;
    setClientsLoading(true);
    api
      .getClients()
      .then((items) => {
        if (!active) return;
        setAccessibleClients(items);
        setClientsError(false);
        if (
          currentClient &&
          !items.some((item) => item.id === currentClient.id)
        ) {
          void api
            .updateUiPreferences({ selectedClientId: null })
            .catch(() => undefined);
          if (onClientChange) {
            onClientChange(null);
            onNavigate("home");
            setOpenClientSelector(true);
          } else {
            const url = new URL(window.location.href);
            url.searchParams.delete("clientId");
            url.searchParams.set("screen", "home");
            url.searchParams.set("selectClient", "1");
            window.location.assign(`${url.pathname}${url.search}`);
          }
        }
      })
      .catch(() => {
        if (active) setClientsError(true);
      })
      .finally(() => {
        if (active) setClientsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentClient?.id]);

  useEffect(() => {
    const shell = shellRef.current;
    if (
      !shell ||
      !window.matchMedia("(hover: hover) and (pointer: fine)").matches
    )
      return;
    const move = (event: PointerEvent) => {
      shell.style.setProperty("--global-pointer-x", `${event.clientX}px`);
      shell.style.setProperty("--global-pointer-y", `${event.clientY}px`);
      shell.style.setProperty(
        "--global-glisten-color",
        "color-mix(in srgb, var(--color-primary) 9%, transparent)",
      );
      if (glistenFrame.current !== null)
        cancelAnimationFrame(glistenFrame.current);
      glistenFrame.current = requestAnimationFrame(() => {});
    };
    shell.addEventListener("pointermove", move, { passive: true });
    return () => {
      shell.removeEventListener("pointermove", move);
      if (glistenFrame.current !== null)
        cancelAnimationFrame(glistenFrame.current);
    };
  }, []);

  const togglePin = async () => {
    const nextPinned = !isPinned;
    setIsPinned(nextPinned);
    try {
      sessionStorage.setItem(
        "content-planner:sidebar-expanded",
        String(nextPinned),
      );
    } catch {}
    await api
      .updateUiPreferences({ sidebarPinned: nextPinned })
      .catch(() => undefined);
  };

  const user = auth.currentUser;
  const userRole = user?.role || "designer";
  const isViewportLocked = activeScreen === "planner";
  const recentClientIds = Array.isArray(user?.ui_preferences?.recentClientIds)
    ? user.ui_preferences.recentClientIds.map(String)
    : [];

  const selectSidebarClient = async (
    client: ClientData,
    destination = "editor",
  ) => {
    const accessibleIds = new Set(accessibleClients.map((item) => item.id));
    await rememberClientSelection(client.id, accessibleIds).catch(
      () => undefined,
    );
    synchronizeClientUrl(client.id);
    if (onClientChange) {
      await onClientChange(client);
      onNavigate(destination === "editor" ? "planner" : destination);
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("clientId", client.id);
    url.searchParams.set(
      "screen",
      destination === "editor" ? "editor" : destination,
    );
    window.location.assign(`${url.pathname}${url.search}`);
  };

  const agencySettings = {
    name: user?.agencyName || "Third Floor",
    logo: user?.agencyLogo || "",
    logoDark: user?.agencyLogoDark || "",
    slogan: user?.agencySlogan || "Estratégia Digital",
  };

  const handleUpdateProfile = async () => {
    if (!user) return;
    try {
      const updatedUser = {
        ...user,
        displayName: displayNameInput,
        birthday: birthdayInput,
      };
      await api.saveUser(updatedUser);
      auth.currentUser = updatedUser;
      setIsProfileOpen(false);
    } catch (err) {
      console.error("Erro ao atualizar perfil", err);
    }
  };

  return (
    <div
      ref={shellRef}
      className={cn("liquid-app-shell", styles.shell, isViewportLocked ? styles.shellLocked : styles.shellScrollable)}
    >
      <header className={cn("liquid-app-header", styles.header)}>
        <div className={styles.brandArea}>
          <span className={styles.mobileMenuAction}>
            <IconButton
              type="button"
              label="Alternar navegação"
              aria-label={isMobileOpen ? "Fechar navegação" : "Abrir navegação"}
              aria-expanded={isMobileOpen}
              aria-controls="app-sidebar"
              onClick={() => setIsMobileOpen((open) => !open)}
            >
              {isMobileOpen ? (
                <X />
              ) : (
                <Menu />
              )}
            </IconButton>
          </span>
          <Button
            type="button"
            variant="ghost"
            className="min-w-0"
            onClick={() => onNavigate("home")}
            aria-label="Ir para o dashboard"
          >
            <div className={styles.logoFrame}>
              <AnimatePresence mode="wait">
                {isDark
                  ? (agencySettings.logoDark || agencySettings.logo) && (
                      <motion.img
                        key="logo-dark"
                        src={agencySettings.logoDark || agencySettings.logo}
                        className={styles.logoImage}
                        alt="Logo"
                      />
                    )
                  : (agencySettings.logo || agencySettings.logoDark) && (
                      <motion.img
                        key="logo-light"
                        src={agencySettings.logo || agencySettings.logoDark}
                        className={styles.logoImage}
                        alt="Logo"
                      />
                    )}
              </AnimatePresence>
              {!agencySettings.logo && !agencySettings.logoDark && (
                <div className={styles.logoFallback}>
                  <span>CP</span>
                </div>
              )}
            </div>
            <div className={styles.brandCopy}>
              <strong>
                {agencySettings.name}
              </strong>
              <span>
                {agencySettings.slogan}
              </span>
            </div>
          </Button>
        </div>

        <div className="liquid-header-context flex min-w-0 items-center justify-center overflow-hidden">
          {headerContext}
        </div>

        <div className={styles.headerActions}>
          <div className={styles.searchAction}>
            <IconButton
              type="button"
              disabled
              label="Busca indisponível"
              aria-label="Busca indisponível"
              title="Busca em breve"
            >
              <Search />
            </IconButton>
          </div>

          <div className={styles.divider} />

          <div className={styles.userActions}>
            <ThemeToggle />
            <HeaderNotificationsButton />

            <Button
              type="button"
              onClick={() => setIsProfileOpen(true)}
              variant="ghost"
            >
              <div className={styles.userAvatar}>
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="Avatar"
                    className={styles.userPhoto}
                  />
                ) : displayNameInput ? (
                  displayNameInput.substring(0, 2)
                ) : (
                  user?.email?.substring(0, 2)
                )}
              </div>
              <div className={styles.userCopy}>
                <strong>
                  {displayNameInput || user?.email?.split("@")[0]}
                </strong>
                <span>
                  {userRole}
                </span>
              </div>
            </Button>

            <IconButton
              type="button"
              onClick={() => signOut(auth)}
              label="Sair do aplicativo"
              title="Sair"
              variant="danger"
            >
              <LogOut />
            </IconButton>
          </div>
        </div>
      </header>

      <div
        className={cn(styles.workspace, isViewportLocked && styles.workspaceLocked)}
      >
        {isMobileOpen && (
          <div
            role="presentation"
            className={styles.mobileBackdrop}
            aria-label="Fechar navegação"
            onClick={() => setIsMobileOpen(false)}
          />
        )}
        <MainLayoutSidebar
          activeScreen={activeScreen}
          onNavigate={onNavigate}
          currentClient={currentClient}
          isPinned={isPinned}
          togglePin={togglePin}
          isMobileOpen={isMobileOpen}
          userRole={userRole}
          user={user}
          clients={accessibleClients}
          clientsLoading={clientsLoading}
          clientsError={clientsError}
          recentClientIds={recentClientIds}
          openClientSelector={openClientSelector}
          onSelectClient={(client) => void selectSidebarClient(client)}
          onClientDestination={(client, destination) =>
            void selectSidebarClient(client, destination)
          }
        />

        <main className={styles.main}>
          {children}
        </main>
      </div>

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        displayNameInput={displayNameInput}
        setDisplayNameInput={setDisplayNameInput}
        handleUpdateProfile={handleUpdateProfile}
        onOpenAdvanced={() => {
          setIsProfileOpen(false);
          onNavigate("user_setup");
        }}
      />
      <LiquidTooltipLayer />
    </div>
  );
}
