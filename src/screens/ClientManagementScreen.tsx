import React, { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  LayoutTemplate,
  PenTool,
  Users,
  Zap,
  Clock,
  Sparkles,
  Settings,
} from "lucide-react";
import { MainLayout } from "../components/MainLayout";
import { Input } from "../components/ui/Input/Input";
import { Button } from "../components/ui/Button/Button";
import { IconButton } from "../components/ui/IconButton/IconButton";
import { api } from "../lib/api";
import { auth } from "../lib/auth";
import { ClientData } from "../types";
import { ClientSetupModal } from "../modals/ClientSetupModal";
import { ClientCard } from "./client-management/ClientCard";
import styles from "./ClientManagementScreen.module.css";
import { Modal } from "../components/ui/Modal/Modal";

interface ClientManagementScreenProps {
  onSelectClient: (client: ClientData, role: string, destination: string) => void;
  currentClient: ClientData | null;
  onNavigate: (screen: string) => void;
}

export function ClientManagementScreen({ onSelectClient, currentClient, onNavigate }: ClientManagementScreenProps) {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedClientForActions, setSelectedClientForActions] = useState<ClientData | null>(null);

  const [setupClient, setSetupClient] = useState<ClientData | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const userRole = auth.currentUser?.role || "designer";
  const isAdmin = ["admin", "gerente", "atendimento"].includes(userRole);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const loaded = await api.getClients();
        setClients(loaded);
      } catch (e) {
        console.error("Error fetching clients", e);
      } finally {
        setLoading(false);
      }
    };
    fetchClients();
  }, [refreshTrigger]);

  const filteredClients = useMemo(() => {
    return clients.filter((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [clients, searchTerm]);

  const handleDeleteClient = async (clientId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Tem certeza que deseja excluir permanentemente este cliente e todos os seus posts/métricas?")) {
      return;
    }
    try {
      await api.deleteClient(clientId);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      console.error("Erro ao deletar cliente:", err);
    }
  };

  const handleSaveClientSetup = async (e: React.FormEvent): Promise<string | null> => {
    e.preventDefault();
    if (!setupClient) return null;
    try {
      const savedId = await api.saveClient(setupClient);
      setSetupClient(null);
      setRefreshTrigger((prev) => prev + 1);
      return savedId;
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const totalClients = clients.length;
  const integratedCount = useMemo(() => {
    return clients.filter((c) => c.meta_account_id || c.youtube_channel_id || c.tiktok_username || c.linkedin_org_id || c.x_username).length;
  }, [clients]);

  return (
    <MainLayout activeScreen="client_management" onNavigate={onNavigate} currentClient={currentClient}>
      <div className={styles.page}>
        <div className={styles.header}>
          <div className={styles.title}>
            <h1>Gestão da Carteira</h1>
            <span>Visualize, configure e organize todos os clientes ativos da agência</span>
          </div>

          <div className={styles.headerActions}>
            <div className={styles.viewToggle}>
              <IconButton
                type="button"
                label="Visualização em grade"
                aria-label="Visualização em grade"
                onClick={() => setViewMode("grid")}
                variant={viewMode === "grid" ? "primary" : "ghost"}
                size="small"
              >
                <LayoutGrid />
              </IconButton>
              <IconButton
                type="button"
                label="Visualização em lista"
                aria-label="Visualização em lista"
                onClick={() => setViewMode("list")}
                variant={viewMode === "list" ? "primary" : "ghost"}
                size="small"
              >
                <List />
              </IconButton>
            </div>

            {isAdmin && (
              <Button
                onClick={() =>
                  setSetupClient({
                    id: Math.random().toString(16).slice(2, 8),
                    name: "",
                    socialLinks: {},
                    owners: [auth.currentUser?.uid || ""],
                  } as ClientData)
                }
                variant="primary"
                icon={<Plus />}
              >
                Novo Cliente
              </Button>
            )}
          </div>
        </div>

        <div className={styles.stats}>
          {[
            { label: "Total de Marcas", val: totalClients, desc: "Clientes ativos na carteira", tone: "primary", icon: Users },
            { label: "Contas Integradas", val: `${integratedCount} / ${totalClients}`, desc: "Com conexões de API ativas", tone: "success", icon: Zap },
            { label: "Ciclo Vigente", val: auth.currentUser?.planning_month ? `${auth.currentUser.planning_month.split("-")[1]}/${auth.currentUser.planning_month.split("-")[0]}` : "N/D", desc: "Mês de Planejamento Ativo", tone: "info", icon: Clock },
            { label: "Status da Agência", val: "Estável", desc: "Sistemas e APIs Meta operantes", tone: "warning", icon: Sparkles },
          ].map((card, i) => (
            <div key={i} className={styles.statCard}>
              <div className={styles.statIcon} data-tone={card.tone}>
                <card.icon />
              </div>
              <div className={styles.statText}>
                <span className={styles.statLabel}>{card.label}</span>
                <span className={styles.statValue}>{card.val}</span>
                <span className={styles.statDescription}>{card.desc}</span>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.search}>
          <Search className={styles.searchIcon} />
          <Input
            aria-label="Filtrar clientes"
            type="text"
            placeholder="Filtrar por nome do cliente ou palavra-chave..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>

        {loading ? (
          <div className={styles.loading}>
            <Clock />
            <p>Carregando carteira de clientes...</p>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className={styles.empty}>
            <Users />
            <p>Nenhum cliente encontrado</p>
          </div>
        ) : (
          <div className={viewMode === "grid" ? styles.clientGrid : styles.clientList}>
            {filteredClients.map((client, idx) => (
              <ClientCard
                key={client.id}
                client={client}
                idx={idx}
                viewMode={viewMode}
                isAdmin={isAdmin}
                onSelect={() => setSelectedClientForActions(client)}
                onDelete={(e) => handleDeleteClient(client.id, e)}
              />
            ))}
          </div>
        )}

        <Modal open={Boolean(selectedClientForActions)} onClose={() => setSelectedClientForActions(null)} title="Área de trabalho" className="w-full max-w-md">
          {selectedClientForActions ? <>
                <div className={styles.modalHeader}>
                  <div className={styles.modalClient}>
                    <div className={styles.modalIdentity}>
                      {selectedClientForActions.name.substring(0, 2)}
                    </div>
                    <div className={styles.modalText}>
                      <h4>
                        {selectedClientForActions.name}
                      </h4>
                      <span>Selecione a Área de Trabalho</span>
                    </div>
                  </div>
                </div>

                <div className={styles.destinations}>
                  {[
                    { id: "planner", label: "Editor de Posts", desc: "Calendário e pautas de posts do mês", icon: PenTool, tone: "primary" },
                    { id: "viewer", label: "Apresentação de Feed", desc: "Pitch visual para aprovação do cliente", icon: LayoutTemplate, tone: "success" },
                    { id: "client_setup", label: "Configurações de Acesso", desc: "Tokens, logins e dados cadastrais", icon: Settings, tone: "neutral" },
                  ].map((action) => (
                    /* style-architecture-button-exception: destination cards are a feature-specific navigation pattern. */
                    <button
                      key={action.id}
                      onClick={() => {
                        onSelectClient(selectedClientForActions, userRole, action.id);
                        setSelectedClientForActions(null);
                      }}
                      className={styles.destinationButton}
                    >
                      <div className={`${styles.destinationIcon} ${styles.destinationIconLayout}`} data-tone={action.tone}>
                        <action.icon />
                      </div>
                      <div className={styles.destinationText}>
                        <span>{action.label}</span>
                        <span>{action.desc}</span>
                      </div>
                    </button>
                  ))}
                </div>
          </> : null}
        </Modal>
      </div>

      <ClientSetupModal
        setupClient={setupClient}
        setSetupClient={setSetupClient}
        handleSaveClientSetup={handleSaveClientSetup}
        onOpenAdvanced={(id) => onSelectClient({ id } as ClientData, userRole, "client_setup")}
      />
    </MainLayout>
  );
}
