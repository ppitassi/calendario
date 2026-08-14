import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Users, ArrowLeft, ShieldCheck, Calendar } from "lucide-react";
import { api } from "../lib/api";
import { auth } from "../lib/auth";
import { UserProfile, UserRole, ROLE_LABELS, ClientData, ROLE_PERMISSIONS } from "../types";
import { MainLayout } from "../components/MainLayout";
import { useNotifications } from "../contexts/NotificationContext";
import { UsersTab } from "./user-management/UsersTab";
import { PermissionsTab } from "./user-management/PermissionsTab";
import { CycleTab } from "./user-management/CycleTab";
import { Button } from "../components/ui/Button/Button";
import { IconButton } from "../components/ui/IconButton/IconButton";
import styles from "./UserManagementScreen.module.css";

interface UserManagementScreenProps {
  onExit: () => void;
  currentClient: ClientData | null;
  onNavigate: (screen: string) => void;
}

export function UserManagementScreen({ onExit, currentClient, onNavigate }: UserManagementScreenProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [activeTab, setActiveTab] = useState<"users" | "permissions" | "cycle">("users");
  const [editingUser, setEditingUser] = useState<Partial<UserProfile>>({ role: "designer" });
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast, confirm } = useNotifications();

  const [customRoles, setCustomRoles] = useState<Record<string, Record<string, boolean>>>({});
  const [cycleData, setCycleData] = useState({
    planning_month: "",
    deadline_pre: "",
    deadline_final: "",
  });

  const currentUserRole = auth.currentUser?.role || "designer";
  const showAdminTabs = currentUserRole === "admin" || currentUserRole === "gerente";

  useEffect(() => {
    loadUsers();
    if (showAdminTabs) {
      loadCustomRoles();
      loadAgencySettings();
    }
  }, []);

  const loadUsers = async () => {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadCustomRoles = async () => {
    try {
      const data = await api.getCustomRoles();
      const rolesMap: Record<string, Record<string, boolean>> = {};
      Object.keys(ROLE_LABELS).forEach((role) => {
        rolesMap[role] = { ...ROLE_PERMISSIONS[role as UserRole] };
      });
      data.forEach((r: any) => {
        if (rolesMap[r.id]) {
          rolesMap[r.id] = { ...rolesMap[r.id], ...r.permissions };
        }
      });
      setCustomRoles(rolesMap);
    } catch (e) {
      console.error("Erro ao carregar permissões:", e);
    }
  };

  const loadAgencySettings = async () => {
    try {
      const [agency] = await api.getAgencies();
      if (!agency?.id) return;
      const data = await api.getAgencySettings(agency.id);
      if (data) {
        setCycleData({
          planning_month: data.planning_month || "",
          deadline_pre: data.deadline_pre || "",
          deadline_final: data.deadline_final || "",
        });
      }
    } catch (e) {
      console.error("Erro ao carregar prazos do ciclo:", e);
    }
  };

  const handleSaveUser = async () => {
    if (!editingUser.displayName || !editingUser.email) {
      toast("Preencha nome e e-mail do usuário.", "error");
      return;
    }
    setIsSaving(true);
    try {
      const payload: any = {
        ...editingUser,
        uid: editingUser.uid || crypto.randomUUID().replace(/-/g, "").slice(0, 12),
        whatsapp: editingUser.phoneNumber || undefined,
      };
      delete payload.phoneNumber;
      await api.saveUser(payload);
      toast("Membro da equipe salvo com sucesso!", "success");
      loadUsers();
      setEditingUser({ role: "designer" });
    } catch (error: any) {
      toast(error?.response?.data?.error || "Erro ao salvar usuário.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    const isConfirmed = await confirm(
      "Excluir Usuário",
      "Tem certeza que deseja remover este membro da equipe?",
      { confirmText: "Excluir", type: "danger" },
    );
    if (!isConfirmed) return;
    try {
      await api.deleteUser(uid);
      toast("Usuário removido com sucesso.", "info");
      loadUsers();
      if (editingUser.uid === uid) setEditingUser({ role: "designer" });
    } catch (e) {
      toast("Erro ao remover usuário.", "error");
    }
  };

  const handleSavePermissions = async () => {
    setIsSaving(true);
    try {
      const formattedRoles = Object.entries(customRoles).map(([id, permissions]) => ({
        id,
        name: ROLE_LABELS[id as UserRole] || id,
        permissions,
      }));
      await api.saveCustomRoles(formattedRoles);
      toast("Matriz de permissões salva com sucesso!", "success");
    } catch (e) {
      toast("Erro ao salvar matriz de permissões.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCycle = async () => {
    setIsSaving(true);
    try {
      const [agency] = await api.getAgencies();
      if (!agency?.id) throw new Error("AGENCY_NOT_CONFIGURED");
      await api.saveAgencySettings({
        id: agency.id,
        agency_name: auth.currentUser?.agencyName || "Third Floor",
        ...cycleData,
      });
      toast("Prazos do ciclo salvos com sucesso!", "success");
    } catch (e) {
      toast("Erro ao salvar prazos do ciclo.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <MainLayout activeScreen="admin_roles" onNavigate={onNavigate} currentClient={currentClient}>
      <div className={styles.page}>
        <div className={styles.header}>
          <div className={styles.headingGroup}>
            <IconButton label="Voltar" onClick={onExit} variant="glass">
              <ArrowLeft />
            </IconButton>
            <div className={styles.headingText}>
              <h1 className={styles.title}>Gestão de Equipe &amp; Prazos</h1>
              <span className={styles.eyebrow}>Controle de Membros, Cargos e Ciclos</span>
            </div>
          </div>
        </div>

        {showAdminTabs && (
          <div className={styles.tabs} role="tablist" aria-label="Gestão da equipe">
            <Button
              onClick={() => setActiveTab("users")}
              variant={activeTab === "users" ? "primary" : "ghost"}
              icon={<Users />}
            >
              Membros ({users.length})
            </Button>
            <Button
              onClick={() => setActiveTab("permissions")}
              variant={activeTab === "permissions" ? "primary" : "ghost"}
              icon={<ShieldCheck />}
            >
              Matriz de Permissões
            </Button>
            <Button
              onClick={() => setActiveTab("cycle")}
              variant={activeTab === "cycle" ? "primary" : "ghost"}
              icon={<Calendar />}
            >
              Ciclo de Produção
            </Button>
          </div>
        )}

        <div className={styles.content}>
          <AnimatePresence mode="wait">
            {activeTab === "users" && (
              <motion.div key="users" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <UsersTab
                  users={users}
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  editingUser={editingUser}
                  setEditingUser={setEditingUser}
                  isSaving={isSaving}
                  handleSaveUser={handleSaveUser}
                  handleDeleteUser={handleDeleteUser}
                />
              </motion.div>
            )}

            {activeTab === "permissions" && (
              <motion.div key="permissions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <PermissionsTab
                  customRoles={customRoles}
                  setCustomRoles={setCustomRoles}
                  handleSavePermissions={handleSavePermissions}
                  isSaving={isSaving}
                />
              </motion.div>
            )}

            {activeTab === "cycle" && (
              <motion.div key="cycle" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <CycleTab
                  cycleData={cycleData}
                  setCycleData={setCycleData}
                  handleSaveCycle={handleSaveCycle}
                  isSaving={isSaving}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </MainLayout>
  );
}
