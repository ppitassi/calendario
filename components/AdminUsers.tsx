"use client";
/** Administração de contas: criação direta, aprovação, papéis e exclusão. */


import { useState, useEffect } from "react";
import {
  UserPlus,
  Trash2,
  Key,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SafeUser } from "@/lib/types";
import styles from "./AdminUsers.module.css";

/** Mantém as três abas administrativas sincronizadas com a lista devolvida pela API. */
export function AdminUsers({ currentUser }: { currentUser: SafeUser }) {
  const [tab, setTab] = useState<"pending" | "create" | "all">("pending");
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  // Estado do formulário que cria uma conta já aprovada.
  const [newName, setNewName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"designer" | "social_media" | "admin">(
    "designer"
  );
  const [createMsg, setCreateMsg] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  /** Busca todas as contas administrativas e substitui a lista exibida nas três abas. */
  const loadUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (data.users) {
        setAllUsers(data.users);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Preenche as abas de pendências e usuários uma única vez na montagem.
  useEffect(() => {
    loadUsers();
  }, []);

  const pendingUsers = allUsers.filter((u) => u.status === "pending");

  /** Aprova ou rejeita uma solicitação e recarrega todas as abas após sucesso. */
  const handleApproveReject = async (
    userId: string,
    action: "approve" | "reject",
    role?: string
  ) => {
    try {
      setActionLoading(true);
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, userId, role }),
      });
      if (res.ok) {
        await loadUsers();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  /** Troca o papel de uma conta existente e atualiza a lista com a resposta persistida. */
  const handleChangeRole = async (userId: string, newRole: string) => {
    try {
      setActionLoading(true);
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "change_role", userId, newRole }),
      });
      if (res.ok) {
        await loadUsers();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  /** Exige confirmação antes de excluir outra conta e então recarrega a relação. */
  const handleDeleteUser = async (userId: string, name: string) => {
    if (
      !window.confirm(
        `Tem certeza que deseja remover o usuário "${name}" do sistema?`
      )
    )
      return;

    try {
      setActionLoading(true);
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", userId }),
      });
      if (res.ok) {
        await loadUsers();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  /** Cria uma conta ativa e limpa os campos somente depois da confirmação da API. */
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateMsg(null);
    setActionLoading(true);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name: newName,
          username: newUsername,
          password: newPassword,
          role: newRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao cadastrar usuário");

      setCreateMsg(
        `Usuário "${newName}" (${newRole}) criado e ativado com sucesso!`
      );
      setNewName("");
      setNewUsername("");
      setNewPassword("");
      await loadUsers();
    } catch (err: any) {
      setCreateError(err.message || "Erro ao cadastrar usuário");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className={styles.root}>
      {/* UI: título e abas que separam decisões pendentes, criação e manutenção. */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1>Gestão de Equipe & Usuários</h1>
          <p>
            Cadastre novos colaboradores, defina permissões e aprove cadastros.
          </p>
        </div>

        <div className={styles.tabs}>
          <button
            type="button"
            className={cn(styles.tab, tab === "pending" && styles.tabActive)}
            onClick={() => setTab("pending")}
          >
            Aprovações Pendentes
            {pendingUsers.length > 0 && (
              <span className={styles.tabBadge}>{pendingUsers.length}</span>
            )}
          </button>
          <button
            type="button"
            className={cn(styles.tab, tab === "create" && styles.tabActive)}
            onClick={() => setTab("create")}
          >
            Criar Usuário
          </button>
          <button
            type="button"
            className={cn(styles.tab, tab === "all" && styles.tabActive)}
            onClick={() => setTab("all")}
          >
            Todos os Usuários ({allUsers.length})
          </button>
        </div>
      </div>

      {/* UI: aba de criação direta de uma conta já ativa. */}
      {tab === "create" && (
        <div className={styles.card}>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.25rem",
              margin: "0 0 1rem",
            }}
          >
            Cadastrar Novo Colaborador
          </h2>

          {createMsg && (
            <div className={cn(styles.alert, styles.alertSuccess)}>
              {createMsg}
            </div>
          )}
          {createError && (
            <div className={cn(styles.alert, styles.alertError)}>
              {createError}
            </div>
          )}

          {/* UI: dados de identidade, credencial provisória e papel inicial. */}
          <form onSubmit={handleCreateUser}>
            {/* UI: grade mantém os quatro campos alinhados sem alterar a ordem de tabulação. */}
            <div className={styles.formGrid}>
              <div className={styles.formField}>
                <label>Nome Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: João Designer"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>

              <div className={styles.formField}>
                <label>Usuário (Login) *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: joao.designer"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                />
              </div>

              <div className={styles.formField}>
                <label>Senha Provisória *</label>
                <input
                  type="password"
                  required
                  minLength={12}
                  placeholder="Mínimo 12 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div className={styles.formField}>
                <label>Função / Permissão *</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                >
                  <option value="designer">Designer (Artes & Uploads)</option>
                  <option value="social_media">
                    Social Media (Criação & Calendários)
                  </option>
                  <option value="admin">Administrador Geral</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={actionLoading}
            >
              <UserPlus size={16} />
              <span>
                {actionLoading ? "Cadastrando..." : "Cadastrar e Ativar"}
              </span>
            </button>
          </form>
        </div>
      )}

      {/* UI: aba de solicitações que ainda exigem decisão administrativa. */}
      {tab === "pending" && (
        <div className={styles.card}>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.25rem",
              margin: "0 0 1rem",
            }}
          >
            Cadastros Aguardando Liberação
          </h2>

          {pendingUsers.length === 0 ? (
            <div className={styles.emptyUsers}>
              <p>Nenhuma solicitação de cadastro pendente no momento.</p>
            </div>
          ) : (
            <div className={styles.userList}>
              {pendingUsers.map((user) => (
                <div key={user.id} className={styles.userRow}>
                  <div className={styles.userInfo}>
                    <div className={styles.userAvatar}>
                      {user.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className={styles.userDetails}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <strong>{user.name}</strong>
                        {Number(user.password_reset_pending || 0) === 1 && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "0.72rem",
                              fontWeight: 600,
                              padding: "2px 8px",
                              borderRadius: "999px",
                              background: "rgba(245, 158, 11, 0.15)",
                              color: "#f59e0b",
                              border: "1px solid rgba(245, 158, 11, 0.3)",
                            }}
                          >
                            <Key size={11} /> Redefinição de Senha
                          </span>
                        )}
                      </div>
                      <span>
                        @{user.username} •{" "}
                        {Number(user.password_reset_pending || 0) === 1 ? (
                          <span style={{ color: "#f59e0b", fontWeight: 500 }}>
                            Solicitou nova senha e aguarda liberação
                          </span>
                        ) : (
                          <>
                            Solicitou perfil: <b>{user.role}</b>
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* UI: decisões mutuamente exclusivas aplicadas à solicitação desta linha. */}
                  <div className={styles.userActions}>
                    <button
                      type="button"
                      className={styles.actionBtnApprove}
                      onClick={() => handleApproveReject(user.id, "approve")}
                      disabled={actionLoading}
                    >
                      Aprovar
                    </button>
                    <button
                      type="button"
                      className={styles.actionBtnReject}
                      onClick={() => handleApproveReject(user.id, "reject")}
                      disabled={actionLoading}
                    >
                      Rejeitar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* UI: aba com todas as contas e suas permissões atuais. */}
      {tab === "all" && (
        <div className={styles.card}>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.25rem",
              margin: "0 0 1rem",
            }}
          >
            Colaboradores Cadastrados
          </h2>

          {/* UI: uma linha por conta, incluindo pendentes e recusadas. */}
          <div className={styles.userList}>
            {allUsers.map((user) => (
              <div key={user.id} className={styles.userRow}>
                <div className={styles.userInfo}>
                  <div
                    className={styles.userAvatar}
                    style={{
                      background:
                        user.role === "admin"
                          ? "var(--tenant-primary)"
                          : user.role === "social_media"
                          ? "#2563eb"
                          : "#475569",
                    }}
                  >
                    {user.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className={styles.userDetails}>
                    <strong>{user.name}</strong>
                    <span>
                      @{user.username} • Status: {user.status}
                    </span>
                  </div>
                </div>

                {/* UI: o usuário atual não pode alterar o próprio papel nem excluir a própria conta. */}
                <div className={styles.userActions}>
                  <select
                    className={styles.roleSelect}
                    value={user.role}
                    onChange={(e) => handleChangeRole(user.id, e.target.value)}
                    disabled={user.id === currentUser.id || actionLoading}
                  >
                    <option value="designer">Designer</option>
                    <option value="social_media">Social Media</option>
                    <option value="admin">Administrador</option>
                  </select>

                  {user.id !== currentUser.id && (
                    <button
                      type="button"
                      className={styles.actionBtnDelete}
                      onClick={() => handleDeleteUser(user.id, user.name)}
                      title="Excluir usuário"
                      disabled={actionLoading}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
