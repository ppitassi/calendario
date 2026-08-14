import React from "react";
import { CheckCircle } from "lucide-react";
import { ClientData, UserProfile } from "../../types";
import styles from "./TeamTab.module.css";

type TeamTabProps = {
  selectedClient: ClientData;
  setClient: React.Dispatch<React.SetStateAction<ClientData | null>>;
  users: UserProfile[];
};

export function TeamTab({ selectedClient, setClient, users }: TeamTabProps) {
  return (
    <div className={styles.root}>
      <h3>Equipe Responsável</h3>
      <div className="grid grid-cols-1 gap-4">
        {users.map((u) => {
          const isAssigned = selectedClient.owners?.includes(u.uid);
          return (
            /* style-architecture-button-exception: team assignment rows are feature-specific multi-selection controls. */
            <button
              type="button"
              key={u.uid}
              onClick={() => {
                const owners = selectedClient.owners || [];
                const next = isAssigned
                  ? owners.filter((id) => id !== u.uid)
                  : [...owners, u.uid];
                setClient({ ...selectedClient, owners: next });
              }}
              className={styles.userRow}
              data-assigned={isAssigned || undefined}
              aria-pressed={isAssigned}
            >
              <div className={styles.identity}>
                <div className={styles.avatar}>
                  {u.displayName?.substring(0, 2).toUpperCase()}
                </div>
                <div className={styles.userCopy}>
                  <strong>{u.displayName}</strong>
                  <span>
                    {u.role}
                  </span>
                </div>
              </div>
              {isAssigned ? (
                <CheckCircle />
              ) : (
                <div className={styles.unchecked} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
