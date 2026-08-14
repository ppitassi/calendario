import { AlertTriangle, CalendarClock, Clock3, MessageSquareWarning } from "lucide-react";
import styles from "./Dashboard.module.css";

export function DeadlinesWidget({ dashboardData, onOpenProduction }: { dashboardData: any; onOpenProduction?: (filters: any) => void }) {
  const deadlines = dashboardData?.modules?.deadlines || {};
  const rows = [["Vencendo hoje", deadlines.today, CalendarClock, "today"], ["Próximos 3 dias", deadlines.nextThreeDays, Clock3, "upcoming"], ["Atrasadas", deadlines.overdue, AlertTriangle, "overdue"], ["Alterações solicitadas", deadlines.changesRequested, MessageSquareWarning, "changes_requested"]] as const;
  return <div className={styles.deadlineGrid}>{rows.map(([label, value, Icon, status]) => (
    /* style-architecture-button-exception: deadline cards are feature-specific dashboard drilldowns. */
    <button key={label} onClick={() => onOpenProduction?.({ status })} className={styles.deadlineCard}><Icon data-danger={status === "overdue"} /><strong>{value || 0}</strong><span>{label}</span></button>
  ))}</div>;
}
