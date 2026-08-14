import { Calendar as CalendarIcon, PenTool, Eye } from "lucide-react";
import { Button } from "../../components/ui/Button/Button";
import styles from "./PlannerMobileNav.module.css";

type PlannerMobileNavProps = {
  mobilePane: "calendar" | "editor" | "preview";
  setMobilePane: (pane: "calendar" | "editor" | "preview") => void;
};

export function PlannerMobileNav({ mobilePane, setMobilePane }: PlannerMobileNavProps) {
  return (
    <nav aria-label="Painéis do editor" className={styles.navigation}>
      {([
        ["calendar", CalendarIcon, "Calendário"],
        ["editor", PenTool, "Editor"],
        ["preview", Eye, "Prévia"],
      ] as const).map(([pane, Icon, label]) => (
        <Button
          key={pane}
          type="button"
          aria-label={label}
          aria-pressed={mobilePane === pane}
          onClick={() => setMobilePane(pane)}
          variant={mobilePane === pane ? "primary" : "ghost"}
          size="small"
          icon={<Icon />}
        >
          <span className={styles.label}>{label}</span>
        </Button>
      ))}
    </nav>
  );
}
