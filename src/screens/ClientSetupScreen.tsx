import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Settings,
  Users,
  ContactRound,
  Globe,
  Trash2,
  Save,
  Image as ImageIcon,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../lib/api";
import { ClientData, UserProfile } from "../types";
import { MainLayout } from "../components/MainLayout";
import { useNotifications } from "../contexts/NotificationContext";
import { BasicsTab } from "./client-setup/BasicsTab";
import { TeamTab } from "./client-setup/TeamTab";
import { ContactsTab } from "./client-setup/ContactsTab";
import { IntegrationsTab } from "./client-setup/IntegrationsTab";
import { BrandingTab } from "./client-setup/BrandingTab";
import { Button } from "../components/ui/Button/Button";
import { IconButton } from "../components/ui/IconButton/IconButton";
import { Modal } from "../components/ui/Modal/Modal";
import styles from "./ClientSetupScreen.module.css";

interface ClientSetupScreenProps {
  clientId: string;
  onExit: () => void;
  currentClient: ClientData | null;
  onNavigate: (screen: string) => void;
}

export function ClientSetupScreen({
  clientId,
  onExit,
  currentClient,
  onNavigate,
}: ClientSetupScreenProps) {
  const [client, setClient] = useState<ClientData | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "basics" | "team" | "contacts" | "api" | "branding" | "danger"
  >("basics");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { toast, confirm } = useNotifications();
  const [accountSelector, setAccountSelector] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!clientId) {
        setLoading(false);
        return;
      }
      try {
        setErrorMsg(null);
        const [clientData, usersData] = await Promise.all([
          api.getClient(clientId),
          api.getTeamMembers(),
        ]);
        setClient(clientData);
        setUsers(usersData);
      } catch (e: any) {
        console.error(e);
        setErrorMsg(e.message || "Erro de conexão com o servidor.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [clientId]);

  useEffect(() => {
    if (activeTab !== "team") return;
    let cancelled = false;
    void api
      .getTeamMembers()
      .then((team) => {
        if (!cancelled) setUsers(team);
      })
      .catch(() => {
        if (!cancelled)
          toast("Não foi possível atualizar a lista da equipe.", "error");
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const handleSave = async () => {
    if (!client || saving) return;
    setSaving(true);
    try {
      await api.saveClient(client);
      toast("Configurações salvas com sucesso!", "success");
    } catch (e) {
      toast("Erro ao salvar configurações.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.deleteClient(clientId);
      onExit();
      toast("Cliente arquivado com sucesso!", "success");
    } catch (e) {
      toast("Erro ao arquivar cliente.", "error");
    }
  };

  if (errorMsg)
    return (
      <div className={styles.statePage}>
        <div className={styles.errorIcon}>
          <AlertTriangle />
        </div>
        <h2>Erro ao carregar dados</h2>
        <p>{errorMsg}</p>
        <Button onClick={() => window.location.reload()} variant="glass">
          Tentar Novamente
        </Button>
        <Button onClick={onExit} className="mt-4" variant="ghost">
          Voltar para o Início
        </Button>
      </div>
    );

  if (loading)
    return (
      <div className={styles.statePage}>Carregando painel de controle...</div>
    );
  if (!client)
    return (
      <div className={styles.statePage}>
        <div className={styles.critical}>
          Erro crítico: Cliente não encontrado.
        </div>
        <Button onClick={onExit} variant="glass" icon={<ArrowLeft />}>
          Voltar para o Início
        </Button>
      </div>
    );

  const selectedClient: ClientData = client;
  const selectableAccounts = Array.isArray(accountSelector?.accounts)
    ? accountSelector.accounts
    : [];

  const tabs = [
    { id: "basics", label: "Básico", icon: Settings },
    { id: "team", label: "Equipe", icon: Users },
    { id: "contacts", label: "Contatos", icon: ContactRound },
    { id: "api", label: "Integrações", icon: Globe },
    { id: "branding", label: "Branding", icon: ImageIcon },
    {
      id: "danger",
      label: "Avançado",
      icon: AlertTriangle,
      color: "text-rose-500",
    },
  ];

  return (
    <MainLayout
      activeScreen="client_setup"
      onNavigate={onNavigate}
      currentClient={currentClient}
    >
      <div className={styles.page}>
        <div className={styles.header}>
          <div className={styles.identity}>
            <IconButton onClick={onExit} label="Voltar" variant="glass">
              <ArrowLeft />
            </IconButton>
            <div>
              <h1>{selectedClient.name}</h1>
              <span>Configuração Profunda de Cliente</span>
            </div>
          </div>

          <Button
            onClick={handleSave}
            loading={saving || uploadingImage}
            variant="primary"
            icon={<Save />}
          >
            {uploadingImage ? "Enviando imagem..." : "Salvar alterações"}
          </Button>
        </div>

        <div className={styles.workspace}>
          <nav className={styles.navigation}>
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                variant={activeTab === tab.id ? "primary" : "glass"}
                icon={<tab.icon />}
              >
                {tab.label}
              </Button>
            ))}
          </nav>

          <div className={styles.content}>
            <AnimatePresence mode="wait">
              {activeTab === "basics" && (
                <motion.div
                  key="basics"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <BasicsTab
                    selectedClient={selectedClient}
                    setClient={setClient}
                  />
                </motion.div>
              )}

              {activeTab === "team" && (
                <motion.div
                  key="team"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <TeamTab
                    selectedClient={selectedClient}
                    setClient={setClient}
                    users={users}
                  />
                </motion.div>
              )}

              {activeTab === "contacts" && (
                <motion.div
                  key="contacts"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <ContactsTab clientId={selectedClient.id} />
                </motion.div>
              )}

              {activeTab === "api" && (
                <motion.div
                  key="api"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <IntegrationsTab
                    selectedClient={selectedClient}
                    client={client}
                    setClient={setClient}
                    setAccountSelector={setAccountSelector}
                    toast={toast}
                    confirm={confirm}
                  />
                </motion.div>
              )}

              {activeTab === "branding" && (
                <motion.div
                  key="branding"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <BrandingTab
                    selectedClient={selectedClient}
                    setClient={setClient}
                    setUploadingImage={setUploadingImage}
                    toast={toast}
                  />
                </motion.div>
              )}

              {activeTab === "danger" && (
                <motion.div
                  key="danger"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <div className={styles.dangerPanel}>
                    <div className={styles.dangerHeading}>
                      <div className={styles.dangerIcon}>
                        <Trash2 />
                      </div>
                      <h4>Excluir Cliente</h4>
                    </div>
                    <p>
                      O cliente será arquivado e deixará de aparecer nas listas
                      ativas. O histórico, os itens de trabalho e as aprovações
                      serão preservados.
                    </p>
                    {!showDeleteConfirm ? (
                      <Button
                        onClick={() => setShowDeleteConfirm(true)}
                        variant="danger"
                      >
                        Arquivar {selectedClient.name}
                      </Button>
                    ) : (
                      <div className={styles.dangerActions}>
                        <Button onClick={handleDelete} variant="danger">
                          Confirmar arquivamento
                        </Button>
                        <Button
                          onClick={() => setShowDeleteConfirm(false)}
                          variant="secondary"
                        >
                          Cancelar
                        </Button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <Modal
        open={Boolean(accountSelector)}
        onClose={() => setAccountSelector(null)}
        title="Vincular Conta Meta"
        className="w-full max-w-xl"
      >
        <p className={styles.accountIntro}>
          Escolha o perfil do Instagram e Página do Facebook correspondentes.
        </p>
        <div className={styles.accountList}>
          {selectableAccounts.length > 0 ? (
            selectableAccounts.map((acc: any) => (
              /* style-architecture-button-exception: account cards select a Meta identity during OAuth linking. */
              <button
                key={acc.pageId}
                type="button"
                onClick={async () => {
                  try {
                    if (!client) return;
                    const linked = await api.saveMetaAccount(
                      selectedClient.id,
                      accountSelector.connectionId,
                      acc.pageId,
                    );
                    setClient({
                      ...selectedClient,
                      meta_account_id: linked.igAccountId,
                      facebook_page_id: linked.pageId,
                      meta_page_name: linked.pageName,
                      meta_ig_username: linked.igUsername,
                      meta_connected: true,
                    });
                    toast("Conta vinculada com sucesso!", "success");
                    setAccountSelector(null);
                  } catch (e) {
                    console.error(e);
                    toast("Erro ao vincular conta do Meta.", "error");
                  }
                }}
                className={styles.accountCard}
              >
                <div className={styles.accountIdentity}>
                  <div className={styles.accountAvatar}>
                    {acc.igProfilePic ? (
                      <img
                        src={acc.igProfilePic}
                        alt={acc.igUsername || "Instagram"}
                      />
                    ) : (
                      <div className={styles.accountFallback}>
                        {String(acc.pageName || acc.igUsername || "Meta")
                          .substring(0, 2)
                          .toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className={styles.accountText}>
                    <strong>{acc.pageName || "Página sem nome"}</strong>
                    <span>
                      <span
                        className={styles.accountDot}
                        data-connected={Boolean(acc.igUsername)}
                      />
                      {acc.igUsername ? (
                        <>Instagram: @{acc.igUsername}</>
                      ) : (
                        <>Nenhum Instagram vinculado</>
                      )}
                    </span>
                  </div>
                </div>
                <div className={styles.accountAction}>Vincular</div>
              </button>
            ))
          ) : (
            <div className={styles.emptyAccounts}>
              Nenhuma conta ou página encontrada para este login.
            </div>
          )}
        </div>
      </Modal>
    </MainLayout>
  );
}
