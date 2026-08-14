import React from "react";
import { Save, Check, X as XIcon } from "lucide-react";
import { ROLE_LABELS } from "../../types";
import { Button } from "../../components/ui/Button/Button";
import { IconButton } from "../../components/ui/IconButton/IconButton";
import styles from "./PermissionsTab.module.css";

type PermissionsTabProps = {
  customRoles: Record<string, Record<string, boolean>>;
  setCustomRoles: React.Dispatch<React.SetStateAction<Record<string, Record<string, boolean>>>>;
  handleSavePermissions: () => Promise<void>;
  isSaving: boolean;
};

const PERMISSION_KEYS: Array<{ key: string; label: string }> = [
  { key: "canCreateClient", label: "Criar Novos Clientes" },
  { key: "canConfigClients", label: "Configurar Marcas e Grades" },
  { key: "canDeleteClient", label: "Excluir Clientes" },
  { key: "canManageRoles", label: "Gerenciar Equipe e Permissões" },
  { key: "canCreatePost", label: "Criar Postagens" },
  { key: "canEditCopy", label: "Editar Conteúdo / Copy" },
  { key: "canEditDesign", label: "Subir Mídias e Artes" },
  { key: "canDeletePost", label: "Excluir Postagens" },
  { key: "canComment", label: "Comentar / Fazer Anotações" },
  { key: "canViewProductionGallery", label: "Acessar Esteira Visual" },
];

export function PermissionsTab({
  customRoles,
  setCustomRoles,
  handleSavePermissions,
  isSaving,
}: PermissionsTabProps) {
  const togglePermission = (role: string, permKey: string) => {
    setCustomRoles((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [permKey]: !prev[role]?.[permKey],
      },
    }));
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div>
          <h3>Matriz de Permissões por Cargo</h3>
          <p>Defina o que cada função pode visualizar ou alterar na plataforma.</p>
        </div>
        <Button
          onClick={handleSavePermissions}
          disabled={isSaving}
          variant="primary"
          loading={isSaving}
          icon={<Save />}
        >
          {isSaving ? "Salvando..." : "Salvar Matriz"}
        </Button>
      </div>

      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>Permissão</th>
              {Object.entries(ROLE_LABELS).map(([roleKey, label]) => (
                <th key={roleKey} data-centered="true">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_KEYS.map(({ key, label }) => (
              <tr key={key}>
                <td>{label}</td>
                {Object.keys(ROLE_LABELS).map((roleKey) => {
                  const allowed = customRoles[roleKey]?.[key] ?? false;
                  return (
                    <td key={roleKey} data-centered="true">
                      <IconButton
                        label={`${allowed ? "Revogar" : "Conceder"} ${label} para ${ROLE_LABELS[roleKey as keyof typeof ROLE_LABELS]}`}
                        aria-pressed={allowed}
                        onClick={() => togglePermission(roleKey, key)}
                        variant={allowed ? "primary" : "ghost"}
                        size="small"
                      >
                        {allowed ? <Check /> : <XIcon />}
                      </IconButton>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
