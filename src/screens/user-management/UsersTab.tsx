import { Plus, Search, ShieldCheck, Mail, Smartphone, Save, Trash2, KeyRound } from "lucide-react";
import { UserProfile, ROLE_LABELS, UserRole } from "../../types";
import { Select } from "../../components/ui/Select/Select";
import { Input } from "../../components/ui/Input/Input";
import { Button } from "../../components/ui/Button/Button";
import { IconButton } from "../../components/ui/IconButton/IconButton";
import styles from "./UsersTab.module.css";

type UsersTabProps = {
  users: UserProfile[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  editingUser: Partial<UserProfile>;
  setEditingUser: (u: Partial<UserProfile>) => void;
  isSaving: boolean;
  handleSaveUser: () => Promise<void>;
  handleDeleteUser: (uid: string) => Promise<void>;
};

export function UsersTab({
  users,
  searchTerm,
  setSearchTerm,
  editingUser,
  setEditingUser,
  isSaving,
  handleSaveUser,
  handleDeleteUser,
}: UsersTabProps) {
  const filteredUsers = users.filter(
    (u) =>
      u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.role?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className={styles.layout}>
      {/* Coluna Esquerda: Lista de Usuários */}
      <div className={styles.listColumn}>
        <div className={styles.toolbar}>
          <div className={styles.searchField}>
            <Search />
            <Input
              type="text"
              placeholder="Buscar por nome, e-mail ou cargo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          <Button
            onClick={() => setEditingUser({ role: "designer" })}
            variant="primary"
            icon={<Plus />}
          >
            Novo Membro
          </Button>
        </div>

        <div className={styles.userList}>
          {filteredUsers.map((u) => (
            <div
              key={u.uid}
              onClick={() => setEditingUser(u)}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setEditingUser(u); } }}
              role="button"
              tabIndex={0}
              className={styles.userRow}
              data-active={editingUser.uid === u.uid || undefined}
            >
              <div className={styles.userIdentity}>
                <div className={styles.avatar}>
                  {u.displayName?.substring(0, 2).toUpperCase() || "US"}
                </div>
                <div className={styles.userCopy}>
                  <strong>{u.displayName}</strong>
                  <span>{u.email}</span>
                </div>
              </div>

              <div className={styles.userActions}>
                <span className={styles.roleBadge}>
                  {ROLE_LABELS[u.role as UserRole] || u.role}
                </span>
                <IconButton
                  label="Excluir usuário"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteUser(u.uid);
                  }}
                  variant="danger"
                  size="small"
                >
                  <Trash2 />
                </IconButton>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Coluna Direita: Formulário de Edição */}
      <div className={styles.formCard}>
        <h3>
          <ShieldCheck />
          {editingUser.uid ? "Editar Membro" : "Novo Cadastrado"}
        </h3>

        <div className={styles.formFields}>
          <div className={styles.field}>
            <label>Nome Completo</label>
            <Input
              type="text"
              value={editingUser.displayName || ""}
              onChange={(e) => setEditingUser({ ...editingUser, displayName: e.target.value })}
              className="w-full"
              placeholder="Ex: Ana Silva"
            />
          </div>

          <div className={styles.field}>
            <label>E-mail de Acesso</label>
            <div className={styles.inputWithIcon}>
              <Mail />
              <Input
                type="email"
                value={editingUser.email || ""}
                onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                className="w-full"
                placeholder="ana@agencia.com"
              />
            </div>
          </div>

          <div className={styles.field}>
            <label>Telefone / WhatsApp</label>
            <div className={styles.inputWithIcon}>
              <Smartphone />
              <Input
                type="text"
                value={editingUser.phoneNumber || ""}
                onChange={(e) => setEditingUser({ ...editingUser, phoneNumber: e.target.value })}
                className="w-full"
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>

          {!editingUser.uid && (
            <div className={styles.field}>
              <label>Senha inicial</label>
              <div className={styles.inputWithIcon}>
                <KeyRound />
                <Input
                  type="password"
                  value={String((editingUser as any).password || "")}
                  onChange={(event) => setEditingUser({ ...editingUser, password: event.target.value } as any)}
                  className="w-full"
                  placeholder="Mínimo de 8 caracteres"
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
            </div>
          )}

          <div className={styles.field}>
            <label>Cargo / Função</label>
            <Select
              aria-label="Cargo / Função"
              value={editingUser.role || "designer"}
              onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as UserRole })}
              className="w-full"
            >
              {Object.entries(ROLE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <Button
          onClick={handleSaveUser}
          disabled={isSaving}
          className="w-full"
          variant="primary"
          loading={isSaving}
          icon={<Save />}
        >
          {isSaving ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </div>
    </div>
  );
}
