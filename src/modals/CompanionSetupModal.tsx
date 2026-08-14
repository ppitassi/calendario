import { Calendar, Check, MapPin, RefreshCw, Sparkles, Sun, TrendingUp } from "lucide-react";
import { CompanionSettings } from "../types";
import { Button } from "../components/ui/Button/Button";
import { IconButton } from "../components/ui/IconButton/IconButton";
import { Input } from "../components/ui/Input/Input";
import { Modal } from "../components/ui/Modal/Modal";
import styles from "./CompanionSetupModal.module.css";

interface CompanionSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: CompanionSettings;
  setSettings: (settings: CompanionSettings) => void;
  onSave: (settings: CompanionSettings) => void;
  onRefreshLocation?: () => void;
}

const modules = [
  { id: "showWeather", label: "Clima e UV", icon: Sun },
  { id: "showTrends", label: "Real-time Trends", icon: TrendingUp },
  { id: "showCalendar", label: "Próximos Prazos", icon: Calendar },
  { id: "showHolidays", label: "Datas Estratégicas", icon: Sparkles },
] as const;

export function CompanionSetupModal({ isOpen, onClose, settings, setSettings, onSave, onRefreshLocation }: CompanionSetupModalProps) {
  return (
    <Modal open={isOpen} onClose={onClose} title="Companion Hub" className="w-full max-w-lg">
      <p className={styles.subtitle}>Configurações de Inteligência</p>
      <section className={styles.section}>
        <div className={styles.labelRow}>
          <span className={styles.label}>Sua localização</span>
          <span className={styles.detected}><MapPin aria-hidden="true" /> Auto-detectado</span>
        </div>
        <div className={styles.locationField}>
          <Input value={settings.locationName} onChange={(event) => setSettings({ ...settings, locationName: event.target.value })} placeholder="Sua cidade ou bairro..." className="w-full" />
          <IconButton className={styles.refreshButton} label="Recarregar localização" onClick={() => { setSettings({ ...settings, locationName: "" }); onRefreshLocation?.(); }} size="small">
            <RefreshCw />
          </IconButton>
        </div>
      </section>
      <section className={styles.section}>
        <span className={styles.label}>Painéis ativos</span>
        <div className={styles.moduleGrid}>
          {modules.map((module) => {
            const active = Boolean(settings[module.id]);
            return (
              /* style-architecture-button-exception: module cards are feature-specific multi-state selections. */
              <button key={module.id} type="button" aria-pressed={active} className={active ? `${styles.moduleCard} ${styles.moduleCardActive}` : styles.moduleCard} onClick={() => setSettings({ ...settings, [module.id]: !active })}>
                <span className={styles.moduleIcon}><module.icon />{active ? <Check /> : null}</span>
                <strong>{module.label}</strong>
              </button>
            );
          })}
        </div>
      </section>
      <Button className="w-full" variant="primary" size="large" icon={<Check />} onClick={() => onSave({ ...settings, hasConfigured: true })}>
        Salvar configurações
      </Button>
    </Modal>
  );
}
