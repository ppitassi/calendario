import React, { useState, useEffect } from "react";
import { Palette, Save, Building2, Calendar } from "lucide-react";
import { api } from "../lib/api";
import { auth } from "../lib/auth";
import { useNotifications } from "../contexts/NotificationContext";
import { AgencyBrandingTab } from "./agency-setup/AgencyBrandingTab";
import { AgencyThemeTab } from "./agency-setup/AgencyThemeTab";
import { AgencyIdentityTab } from "./agency-setup/AgencyIdentityTab";
import { Select } from "../components/ui/Select/Select";
import { Button } from "../components/ui/Button/Button";
import { Modal } from "../components/ui/Modal/Modal";
import styles from "./AgencySetupScreen.module.css";

interface AgencySetupProps {
  onClose: () => void;
  initialData?: any;
  onSave: (data: any) => void;
  presentation?: "screen" | "modal";
}

function parseThemeConfig(value: unknown, fallback: any) {
  if (!value) return fallback;
  if (typeof value !== "string") return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function AgencySetupScreen({ onClose, initialData, onSave, presentation = "screen" }: AgencySetupProps) {
  const { toast } = useNotifications();
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAsset, setIsUploadingAsset] = useState(false);
  const [activeTab, setActiveTab] = useState<"branding" | "theme" | "identity">("branding");

  const [agencies, setAgencies] = useState<any[]>([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState(initialData?.id || "default_agency");

  const [formData, setFormData] = useState({
    id: selectedAgencyId,
    name: initialData?.name || "",
    slogan: initialData?.slogan || "",
    logo_url: initialData?.logo_url || "",
    logo_dark_url: initialData?.logo_dark_url || "",
    planning_month: initialData?.planning_month || "",
    deadline_pre: initialData?.deadline_pre || "",
    deadline_final: initialData?.deadline_final || "",
    theme_config: parseThemeConfig(initialData?.theme_config, {
      primary: "#e3002f",
      brandPalette: [],
      brandManual: null,
      light: { background: "#ffffff", surface: "#f8fafc" },
      dark: { background: "#0f172a", surface: "#1e293b" },
    }),
  });

  useEffect(() => {
    if (auth.currentUser?.role === "admin") {
      api.getAgencies().then(setAgencies).catch(console.error);
    }
    if (selectedAgencyId) {
      handleAgencyChange(selectedAgencyId);
    }
  }, []);

  const handleAgencyChange = async (id: string) => {
    setSelectedAgencyId(id);
    try {
      const data = await api.getAgencySettings(id);
      if (data) {
        setFormData({
          id: data.id,
          name: data.name || "",
          slogan: data.slogan || "",
          logo_url: data.logo_url || "",
          logo_dark_url: data.logo_dark_url || "",
          planning_month: data.planning_month || "",
          deadline_pre: data.deadline_pre || "",
          deadline_final: data.deadline_final || "",
          theme_config: parseThemeConfig(data.theme_config, formData.theme_config),
        });
      }
    } catch (e) {
      console.error("Erro ao carregar agência:", e);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "light" | "dark") => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/svg+xml"].includes(file.type)) {
      toast("Use um arquivo PNG ou SVG.", "error");
      e.target.value = "";
      return;
    }
    setIsUploadingAsset(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const cleanName = file.name.replace(/\.[^.]+$/, "") || `logo_${type}`;
      const url = await api.uploadImage(
        base64,
        `${cleanName}_${Date.now()}`,
        "branding",
      );
      setFormData((previous: any) => ({
        ...previous,
        [type === "light" ? "logo_url" : "logo_dark_url"]: url,
      }));
      toast("Logo completo enviado com sucesso!", "success");
    } catch (err) {
      toast("Não foi possível enviar o logo.", "error");
    } finally {
      setIsUploadingAsset(false);
      e.target.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast("Por favor, informe o nome da agência.", "error");
      return;
    }

    setIsSaving(true);
    try {
      await api.saveAgencySettings(formData);
      toast("Configurações da agência salvas com sucesso!", "success");
      onSave(formData);
      onClose();
    } catch (err) {
      toast("Erro ao salvar configurações da agência.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const content = (
      <div className={styles.content}>
        {presentation === "screen" ? (
          <header className={styles.header}>
            <div>
              <h1>Identidade da Agência</h1>
              <p className={styles.subtitle}>Branding, temas e prazos da agência</p>
            </div>
          </header>
        ) : (
          <p className={styles.subtitle}>Branding, temas e prazos da agência</p>
        )}

        {auth.currentUser?.role === "admin" && agencies.length > 1 && (
          <div className={styles.agencySelector}>
            <span>Selecione a Agência:</span>
            <Select
              value={selectedAgencyId}
              onChange={(e) => handleAgencyChange(e.target.value)}
            >
              {agencies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name || a.id}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div className={styles.tabs}>
          {[
            { id: "branding", label: "Branding & Logos", icon: Building2 },
            { id: "theme", label: "Cores & Tema", icon: Palette },
            { id: "identity", label: "Prazos do Ciclo", icon: Calendar },
          ].map((tab) => (
            <Button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              size="small"
              variant={activeTab === tab.id ? "primary" : "ghost"}
              icon={<tab.icon />}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div>
            {activeTab === "branding" && (
              <AgencyBrandingTab
                formData={formData}
                setFormData={setFormData}
                handleLogoUpload={handleLogoUpload}
                isUploadingAsset={isUploadingAsset}
                setIsUploadingAsset={setIsUploadingAsset}
              />
            )}
            {activeTab === "theme" && (
              <AgencyThemeTab formData={formData} setFormData={setFormData} />
            )}
            {activeTab === "identity" && (
              <AgencyIdentityTab formData={formData} setFormData={setFormData} />
            )}
          </div>

          <div className={styles.actions}>
            <Button
              type="button"
              onClick={onClose}
              variant="ghost"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSaving || isUploadingAsset}
              variant="primary"
              loading={isSaving}
              icon={<Save />}
            >
              {isSaving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      </div>
  );

  if (presentation === "modal") {
    return (
      <Modal open onClose={onClose} title="Identidade da Agência" className={styles.dialog}>
        {content}
      </Modal>
    );
  }

  return <section className={styles.screen}>{content}</section>;
}
