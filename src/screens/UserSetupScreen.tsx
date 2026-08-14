import { useState, useEffect } from "react";
import { ArrowLeft, User, Settings, Shield, Save, Briefcase } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../lib/api";
import { auth } from "../lib/auth";
import { UserProfile, ClientData } from "../types";
import { MainLayout } from "../components/MainLayout";
import { useTheme } from "../components/ThemeProvider";
import { useNotifications } from "../contexts/NotificationContext";
import { ProfileTab } from "./user-setup/ProfileTab";
import { PreferencesTab } from "./user-setup/PreferencesTab";
import { PortfolioTab } from "./user-setup/PortfolioTab";
import { SecurityTab } from "./user-setup/SecurityTab";
import { AppLoading } from "../components/AppStatus";
import { Button } from "../components/ui/Button/Button";
import { IconButton } from "../components/ui/IconButton/IconButton";
import { Surface } from "../components/ui/Surface/Surface";
import styles from "./UserSetupScreen.module.css";

interface UserSetupScreenProps {
  onExit: () => void;
  currentClient: ClientData | null;
  onNavigate: (screen: string) => void;
}

export function UserSetupScreen({ onExit, currentClient, onNavigate }: UserSetupScreenProps) {
  const [user, setUser] = useState<UserProfile | null>(auth.currentUser);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [pendingPhotoAssetId, setPendingPhotoAssetId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"profile" | "preferences" | "portfolio" | "security">("profile");
  const { toast } = useNotifications();

  const { theme, setTheme } = useTheme();
  const [density, setDensityState] = useState<"default" | "compact">("default");
  const [language, setLanguageState] = useState<string>("pt-BR");
  const [notifications, setNotifications] = useState<{ email: boolean; whatsapp: boolean; browser: boolean }>({
    email: true,
    whatsapp: true,
    browser: false,
  });

  useEffect(() => {
    const preferences = auth.currentUser?.ui_preferences || {};
    setDensityState(preferences.density || "default");
    setLanguageState(preferences.language || "pt-BR");
    if (preferences.notifications) setNotifications(preferences.notifications);
  }, []);

  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    if (requestedTab === "profile" || requestedTab === "preferences" || requestedTab === "portfolio" || requestedTab === "security") {
      setActiveTab(requestedTab);
    }
  }, []);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<{ type: "success" | "error" | null; message: string }>({ type: null, message: "" });

  const handleDensityChange = (val: "default" | "compact") => {
    setDensityState(val);
    void api.updateUiPreferences({ density: val }).catch(() => {});
    if (val === "compact") {
      document.documentElement.classList.add("density-compact");
    } else {
      document.documentElement.classList.remove("density-compact");
    }
  };

  const handleLanguageChange = (val: string) => {
    setLanguageState(val);
    void api.updateUiPreferences({ language: val }).catch(() => {});
  };

  const handleNotificationToggle = (key: "email" | "whatsapp" | "browser") => {
    const updated = { ...notifications, [key]: !notifications[key] };
    setNotifications(updated);
    void api.updateUiPreferences({ notifications: updated }).catch(() => {});
  };

  const handleSave = async () => {
    if (!user || saving || uploadingImage) return;
    setSaving(true);
    try {
      const updated = await api.updateOwnProfile({
        displayName: user.displayName,
        birthday: user.birthday || undefined,
        githubUsername: user.githubUsername,
        portfolioUrl: user.portfolioUrl,
        photoURL: user.photoURL,
        photoAssetId: pendingPhotoAssetId,
      });
      setUser(updated);
      setPendingPhotoAssetId(null);
      auth.currentUser = { ...auth.currentUser, ...updated };
      toast("Perfil atualizado com sucesso!", "success");
    } catch (error: any) {
      const data = error?.response?.data;
      toast(data?.error || "Não foi possível salvar o perfil.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return <AppLoading label="Carregando perfil" />;

  const tabs = [
    { id: "profile", label: "Meu Perfil", icon: User },
    { id: "preferences", label: "Preferências", icon: Settings },
    { id: "portfolio", label: "Portfólio", icon: Briefcase },
    { id: "security", label: "Segurança", icon: Shield },
  ];

  return (
    <MainLayout activeScreen="user_setup" onNavigate={onNavigate} currentClient={currentClient}>
      <div className={styles.page}>
        <div className={styles.header}>
          <div className={styles.headingGroup}>
            <IconButton
              label="Voltar"
              onClick={onExit}
              variant="glass"
            >
              <ArrowLeft />
            </IconButton>
            <div className={styles.headingText}>
              <h1 className={styles.title}>Seu Perfil</h1>
              <span className={styles.eyebrow}>Configurações de Identidade &amp; OS</span>
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving || uploadingImage}
            variant="primary"
            loading={saving || uploadingImage}
            icon={<Save />}
          >
            {uploadingImage ? "Enviando foto..." : saving ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </div>

        <div className={styles.workspace}>
          <nav className={styles.navigation} aria-label="Seções do perfil">
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                variant={activeTab === tab.id ? "primary" : "ghost"}
                icon={<tab.icon />}
              >
                {tab.label}
              </Button>
            ))}
          </nav>

          <Surface level="strong" className={styles.content}>
            <AnimatePresence mode="wait">
              {activeTab === "profile" && (
                <motion.div key="profile" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <ProfileTab
                    user={user}
                    setUser={setUser}
                    setUploadingImage={setUploadingImage}
                    setPendingPhotoAssetId={setPendingPhotoAssetId}
                    toast={toast}
                  />
                </motion.div>
              )}

              {activeTab === "portfolio" && (
                <motion.div key="portfolio" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <PortfolioTab />
                </motion.div>
              )}

              {activeTab === "preferences" && (
                <motion.div key="preferences" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <PreferencesTab
                    theme={theme}
                    setTheme={setTheme}
                    density={density}
                    handleDensityChange={handleDensityChange}
                    language={language}
                    handleLanguageChange={handleLanguageChange}
                    notifications={notifications}
                    handleNotificationToggle={handleNotificationToggle}
                  />
                </motion.div>
              )}

              {activeTab === "security" && (
                <motion.div key="security" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <SecurityTab
                    currentPassword={currentPassword}
                    setCurrentPassword={setCurrentPassword}
                    newPassword={newPassword}
                    setNewPassword={setNewPassword}
                    confirmPassword={confirmPassword}
                    setConfirmPassword={setConfirmPassword}
                    passwordStatus={passwordStatus}
                    setPasswordStatus={setPasswordStatus}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </Surface>
        </div>
      </div>
    </MainLayout>
  );
}
