import Image from "next/image";
import { AlertTriangle, ArrowRight } from "lucide-react";
import styles from "./Dashboard.module.css";

export function CompactClientsWidget({ dashboardData, onSelectClient }: { dashboardData: any; onSelectClient?: any }) {
  const clients = dashboardData?.modules?.clients || [];
  if (!clients.length) return <div className={styles.widgetEmpty}>Nenhum cliente exige sua atenção agora.</div>;

  return (
    <div className={styles.clientAttentionList}>
      {clients.map((client: any) => (
        /* style-architecture-button-exception: client rows are feature-specific navigable records. */
        <button key={client.id} type="button" onClick={() => onSelectClient?.(client)} className={styles.clientAttentionRow}>
          <span className={styles.clientAttentionAvatar}>
            {client.logoUrl ? <Image src={client.logoUrl} alt="" width={36} height={36} unoptimized className={styles.clientAttentionLogo} /> : client.name.slice(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <strong className={styles.clientAttentionName}>{client.name}</strong>
            <span className={styles.clientAttentionMeta}>
              {client.pending} pendentes{Number(client.overdue) > 0 ? ` · ${client.overdue} atrasadas` : ""}
            </span>
          </span>
          {Number(client.overdue) > 0 ? <AlertTriangle className={styles.clientAttentionDanger} /> : null}
          <ArrowRight className={styles.clientAttentionArrow} />
        </button>
      ))}
    </div>
  );
}
