import { Sun, Moon, Monitor, Layout, Languages } from "lucide-react";
import { NotificationPreferencesPanel } from "../../components/NotificationPreferencesPanel";
import { Select } from "../../components/ui/Select/Select";
import { Checkbox } from "../../components/ui/Checkbox/Checkbox";
import { Button } from "../../components/ui/Button/Button";
import styles from "./PreferencesTab.module.css";

type PreferencesTabProps = {
  theme: "light" | "dark" | "system";
  setTheme: (t: "light" | "dark" | "system") => void;
  density: "default" | "compact";
  handleDensityChange: (val: "default" | "compact") => void;
  language: string;
  handleLanguageChange: (val: string) => void;
  notifications: { email: boolean; whatsapp: boolean; browser: boolean };
  handleNotificationToggle: (key: "email" | "whatsapp" | "browser") => void;
};

export function PreferencesTab({
  theme,
  setTheme,
  density,
  handleDensityChange,
  language,
  handleLanguageChange,
  notifications,
  handleNotificationToggle,
}: PreferencesTabProps) {
  return (
    <div className={styles.root}>
      <div className={styles.heading}>
        <h3>Preferências do Sistema</h3>
        <p>Personalize sua experiência visual e de uso</p>
      </div>

      {/* Theme Selector */}
      <div className={styles.section}>
        <span className={styles.label}>Tema Visual</span>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(["light", "dark", "system"] as const).map((t) => {
            const labels = { light: "Claro", dark: "Escuro", system: "Sistema" };
            const icons = { light: Sun, dark: Moon, system: Monitor };
            const Icon = icons[t];
            const active = theme === t;
            return (
              <Button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                variant={active ? "primary" : "glass"}
                icon={<Icon />}
              >
                {labels[t]}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Layout Density */}
      <div className={styles.section}>
        <span className={styles.label}>Densidade do Layout</span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(["default", "compact"] as const).map((d) => {
            const labels = { default: "Padrão (Espaçoso)", compact: "Compacto (Mais Informação)" };
            const active = density === d;
            return (
              <Button
                key={d}
                type="button"
                onClick={() => handleDensityChange(d)}
                variant={active ? "primary" : "glass"}
                icon={<Layout />}
              >
                {labels[d]}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Language */}
      <div className={styles.languageSection}>
        <span className={styles.label}>Idioma do App</span>
        <div className={styles.languageField}>
          <Languages />
          <Select
            aria-label="Idioma do App"
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="w-full"
          >
            <option value="pt-BR">Português (PT-BR)</option>
            <option value="en-US">English (EN-US)</option>
            <option value="es">Español (ES)</option>
          </Select>
        </div>
      </div>

      {/* Notifications */}
      <div className={styles.section}>
        <span className={styles.label}>Canais de Notificação</span>
        <div className={styles.notificationList}>
          {(["email", "whatsapp", "browser"] as const).map((key) => {
            const labels = {
              email: "E-mail: Resumos de aprovação e relatórios de calendário",
              whatsapp: "WhatsApp: Alertas instantâneos de novos posts e prazos estourados",
              browser: "Navegador: Notificações push em tempo real na tela",
            };
            return (
              <div
                key={key}
                className={styles.notificationRow}
              >
                <Checkbox label={key === "email" ? "E-mail" : key === "whatsapp" ? "WhatsApp" : "Navegador"} checked={notifications[key]} onChange={() => handleNotificationToggle(key)} />
                <div className={styles.notificationCopy}>
                  <strong>
                    {key === "email" ? "E-mail" : key === "whatsapp" ? "WhatsApp" : "Navegador"}
                  </strong>
                  <span>{labels[key]}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <NotificationPreferencesPanel />
    </div>
  );
}
