import { History } from "lucide-react";
import styles from "./Dashboard.module.css";

export function RecentActivityWidget({ dashboardData, onOpenPost }: { dashboardData: any; onOpenPost?: (clientId: string, postId: string) => void }) {
  const items = dashboardData?.modules?.recentActivities || [];
  if (!items.length) return <div className={styles.widgetEmpty}>Nenhuma atividade recente.</div>;
  return <div className={styles.activityList}>{items.slice(0, 6).map((item: any) => (
    /* style-architecture-button-exception: activity rows are feature-specific navigable records. */
    <button key={item.id} onClick={() => onOpenPost?.(item.clientId, String(item.postId))} className={styles.activityRow}><History /><span><strong>{item.summary}</strong><small>{item.clientName || ""} · {new Date(item.createdAt).toLocaleString("pt-BR")}</small></span></button>
  ))}</div>;
}
