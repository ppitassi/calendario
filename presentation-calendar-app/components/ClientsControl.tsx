"use client";
/** Catálogo de clientes com indicadores do calendário para a competência selecionada. */


import { useState, useMemo } from "react";
import {
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Search,
  CalendarDays,
  MonitorPlay,
  ChevronLeft,
  ChevronRight,
  Trash2,
  X,
  Pencil,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "../lib/utils";
import { shiftMonth } from "../lib/date";
import type { Client, SafeUser } from "../lib/types";
import styles from "./ClientsControl.module.css";

/** Dados e ações que pertencem ao contêiner; esta tela não duplica a fonte da lista. */
interface ClientsControlProps {
  clients: Client[];
  activeMonth: Date;
  onMonthChange: (month: Date) => void;
  onOpenPlanner: (client: Client) => void;
  onOpenPresentation: (client: Client) => void;
  onReloadClients: () => Promise<void>;
  currentUser: SafeUser;
}

/** Filtra o catálogo, calcula KPIs mensais e administra o cadastro local de clientes. */
export function ClientsControl({
  clients,
  activeMonth,
  onMonthChange,
  onOpenPlanner,
  onOpenPresentation,
  onReloadClients,
  currentUser,
}: ClientsControlProps) {
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [newName, setNewName] = useState("");
  const [newSegment, setNewSegment] = useState("");
  const [newAccent, setNewAccent] = useState("#e3002f");
  const [newLogoUrl, setNewLogoUrl] = useState("");
  const [newHasMultipleProfiles, setNewHasMultipleProfiles] = useState(false);
  const [newHasPreCalendar, setNewHasPreCalendar] = useState(false);
  const [creating, setCreating] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  /** Envia a logo pelo endpoint seguro e guarda a URL para o próximo salvamento do cliente. */
  const handleLogoUpload = async (file: File) => {
    if (!file) return;
    setUploadingLogo(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao realizar upload");
      setNewLogoUrl(data.url);
    } catch (err: any) {
      alert(err.message || "Erro no upload da logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  /** Limpa resíduos de uma edição anterior e abre o modal no modo de criação. */
  const openNewModal = () => {
    setEditingClient(null);
    setNewName("");
    setNewSegment("");
    setNewAccent("#e3002f");
    setNewLogoUrl("");
    setNewHasMultipleProfiles(false);
    setNewHasPreCalendar(false);
    setShowModal(true);
  };

  /** Copia os dados do cliente para o formulário e abre o modal no modo de edição. */
  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setNewName(client.name);
    setNewSegment(client.segment || "");
    setNewAccent(client.accent || "#e3002f");
    setNewLogoUrl(client.logo_url || "");
    setNewHasMultipleProfiles(Boolean(client.has_multiple_profiles));
    setNewHasPreCalendar(Boolean(client.has_pre_calendar));
    setShowModal(true);
  };

  const formattedMonth = format(activeMonth, "MMMM 'de' yyyy", {
    locale: ptBR,
  }).toUpperCase();

  // Filtra por nome ou segmento sem alterar a lista original recebida do AppShell.
  const filteredClients = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.segment && c.segment.toLowerCase().includes(q))
    );
  }, [clients, search]);

  // Classifica aprovado como pronto, com posts como em produção e sem posts como pendente.
  const kpis = useMemo(() => {
    let ready = 0;
    let inProgress = 0;
    let pending = 0;

    for (const c of clients) {
      const itemsCount = c.month_items_count || 0;
      const status = c.month_calendar_status;

      if (status === "approved") {
        ready++;
      } else if (itemsCount > 0) {
        inProgress++;
      } else {
        pending++;
      }
    }

    return {
      total: clients.length,
      ready,
      inProgress,
      pending,
    };
  }, [clients]);

  /** Cria ou atualiza conforme o modo do modal e recarrega os indicadores após sucesso. */
  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setCreating(true);
    try {
      const isEdit = !!editingClient;
      const url = isEdit ? `/api/clients/${editingClient.id}` : "/api/clients";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          segment: newSegment.trim(),
          accent: newAccent,
          logo_url: newLogoUrl,
          has_multiple_profiles: newHasMultipleProfiles,
          has_pre_calendar: newHasPreCalendar,
        }),
      });

      if (res.ok) {
        setShowModal(false);
        await onReloadClients();
      } else {
        const data = await res.json();
        alert(data.error || "Erro ao criar cliente");
      }
    } catch (err) {
      alert("Falha de conexão ao criar cliente");
    } finally {
      setCreating(false);
    }
  };

  /** Confirma a exclusão em cascata do cliente e atualiza o catálogo depois da API. */
  const handleDeleteClient = async (client: Client) => {
    if (!window.confirm(`Tem certeza que deseja excluir o cliente "${client.name}"? Todos os seus calendários serão removidos.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await onReloadClients();
      } else {
        const data = await res.json();
        alert(data.error || "Erro ao excluir cliente");
      }
    } catch (err) {
      alert("Falha de conexão ao excluir cliente");
    }
  };

  return (
    <div className={styles.root}>
      {/* UI: título do catálogo e contexto da competência exibida. */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1>Controle de Clientes</h1>
          <p>
            Status operacional dos planejamentos e calendários para o mês.
          </p>
        </div>

        {/* UI: muda o mês dos KPIs e oferece a criação de um cliente. */}
        <div className={styles.headerControls}>
          {/* UI: seletor mensal compartilhado com o restante do aplicativo. */}
          <div className={styles.monthSwitcher}>
            <button
              type="button"
              onClick={() => onMonthChange(shiftMonth(activeMonth, -1))}
              title="Mês anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <span className={styles.monthLabel}>{formattedMonth}</span>
            <button
              type="button"
              onClick={() => onMonthChange(shiftMonth(activeMonth, 1))}
              title="Próximo mês"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            type="button"
            className={styles.newClientBtn}
            onClick={openNewModal}
          >
            <Plus size={16} />
            <span>Novo Cliente</span>
          </button>
        </div>
      </div>

      {/* UI: quatro indicadores calculados sobre todos os clientes do mês. */}
      <div className={styles.kpiGrid}>
        {/* UI: tamanho total da carteira, independentemente de calendário. */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiInfo}>
            <span>Total de Clientes</span>
            <strong>{kpis.total}</strong>
          </div>
          <div className={cn(styles.kpiIcon, styles.kpiIconTotal)}>
            <Users size={22} />
          </div>
        </div>

        {/* UI: clientes cujo calendário mensal já foi aprovado. */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiInfo}>
            <span>Prontos no Mês</span>
            <strong style={{ color: "#16a34a" }}>{kpis.ready}</strong>
          </div>
          <div className={cn(styles.kpiIcon, styles.kpiIconReady)}>
            <CheckCircle2 size={22} />
          </div>
        </div>

        {/* UI: clientes com publicações no mês, mas ainda não aprovados. */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiInfo}>
            <span>Em Produção</span>
            <strong style={{ color: "#d97706" }}>{kpis.inProgress}</strong>
          </div>
          <div className={cn(styles.kpiIcon, styles.kpiIconProgress)}>
            <Clock size={22} />
          </div>
        </div>

        {/* UI: clientes sem nenhuma publicação planejada na competência. */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiInfo}>
            <span>Pendentes</span>
            <strong style={{ color: "#64748b" }}>{kpis.pending}</strong>
          </div>
          <div className={cn(styles.kpiIcon, styles.kpiIconPending)}>
            <AlertCircle size={22} />
          </div>
        </div>
      </div>

      {/* UI: busca local por nome ou segmento; não dispara nova requisição. */}
      <div className={styles.filterBar}>
        <div className={styles.searchBox}>
          <Search />
          <input
            type="text"
            placeholder="Buscar por nome do cliente ou segmento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* UI: catálogo filtrado ou orientação vazia quando não há correspondências. */}
      <div className={styles.clientsList}>
        {filteredClients.length === 0 ? (
          <div className={styles.emptyState}>
            <Users />
            <h2>Nenhum cliente encontrado</h2>
            <p>
              {search
                ? "Nenhum cliente corresponde ao filtro de busca informado."
                : "Cadastre seu primeiro cliente para iniciar o planejamento de conteúdo."}
            </p>
            {!search && (
              <button
                type="button"
                className={styles.newClientBtn}
                onClick={openNewModal}
              >
                <Plus size={16} />
                <span>Cadastrar Cliente Agora</span>
              </button>
            )}
          </div>
        ) : (
          filteredClients.map((client) => {
            // A mesma regra dos KPIs determina o selo e as ações de cada linha.
            const itemsCount = client.month_items_count || 0;
            const status = client.month_calendar_status;
            const isReady = status === "approved";
            const isInProgress = !isReady && itemsCount > 0;
            const isPending = !isReady && !isInProgress;

            const clientInitials = client.name.slice(0, 2).toUpperCase();

            return (
              <div key={client.id} className={styles.clientRow}>
                {/* UI: logo, nome e segmento identificam o cliente. */}
                <div className={styles.clientIdentity}>
                  <div
                    className={styles.clientAvatar}
                    style={{
                      background: client.logo_url ? "transparent" : (client.accent || "var(--tenant-primary)"),
                      padding: client.logo_url ? "0.2rem" : "0",
                    }}
                  >
                    {client.logo_url ? (
                      <img src={client.logo_url} alt={client.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : (
                      clientInitials
                    )}
                  </div>
                  <div className={styles.clientDetails}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <h3>{client.name}</h3>
                      {Boolean(client.has_pre_calendar) && (
                        <span
                          style={{
                            fontSize: "0.68rem",
                            padding: "2px 7px",
                            borderRadius: "4px",
                            background: "rgba(227, 0, 47, 0.15)",
                            color: "#ff6b81",
                            fontWeight: 600,
                            letterSpacing: "0.03em",
                            border: "1px solid rgba(227, 0, 47, 0.3)",
                          }}
                        >
                          Pré-calendário
                        </span>
                      )}
                    </div>
                    <span>{client.segment || "Segmento não informado"}</span>
                  </div>
                </div>

                {/* UI: situação do calendário e volume de posts no mês ativo. */}
                <div className={styles.statusColumn}>
                  {isReady && (
                    <div className={cn(styles.statusPill, styles.statusPillReady)}>
                      <div className={styles.statusDot} />
                      <span>PRONTO PARA APRESENTAÇÃO</span>
                    </div>
                  )}
                  {isInProgress && (
                    <div
                      className={cn(styles.statusPill, styles.statusPillProgress)}
                    >
                      <div className={styles.statusDot} />
                      <span>EM PRODUÇÃO</span>
                    </div>
                  )}
                  {isPending && (
                    <div
                      className={cn(styles.statusPill, styles.statusPillPending)}
                    >
                      <div className={styles.statusDot} />
                      <span>PENDENTE NO MÊS</span>
                    </div>
                  )}
                  <span className={styles.postVolumeInfo}>
                    {itemsCount === 0
                      ? "Nenhum post planejado neste mês"
                      : `${itemsCount} post${itemsCount > 1 ? "s" : ""} planejado${
                          itemsCount > 1 ? "s" : ""
                        }`}
                  </span>
                </div>

                {/* UI: atalhos para planejar, apresentar, editar ou excluir. */}
                <div className={styles.rowActions}>
                  <button
                    type="button"
                    className={styles.actionBtnPlan}
                    onClick={() => onOpenPlanner(client)}
                    title="Abrir o planejador para compor e escrever publicações"
                  >
                    <CalendarDays size={14} />
                    <span>Planejar & Escrever</span>
                  </button>

                  <button
                    type="button"
                    className={styles.actionBtnPresent}
                    onClick={() => onOpenPresentation(client)}
                    title="Abrir a apresentação deste cliente"
                  >
                    <MonitorPlay size={14} />
                    <span>Apresentação</span>
                  </button>

                  <button
                    type="button"
                    className={styles.actionBtnEdit}
                    onClick={() => openEditModal(client)}
                    title="Editar informações e logo do cliente"
                  >
                    <Pencil size={13} />
                    <span>Editar</span>
                  </button>

                  {(currentUser.role === "admin" ||
                    currentUser.id === client.created_by_id) && (
                    <button
                      type="button"
                      className={styles.deleteClientBtn}
                      onClick={() => handleDeleteClient(client)}
                      title="Excluir cliente"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* UI: modal compartilhado pelos fluxos de criação e edição. */}
      {showModal && (
        <div className={styles.modalBackdrop} onClick={() => setShowModal(false)}>
          {/* UI: cliques dentro do cartão não podem fechar acidentalmente o formulário. */}
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            {/* UI: título reflete o modo atual e o botão fecha sem salvar. */}
            <div className={styles.modalHeader}>
              <h2>{editingClient ? "Editar Cliente" : "Novo Cliente"}</h2>
              {/* UI: fechamento explícito para teclado e leitores de tela. */}
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setShowModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* UI: identidade, segmento, cor, logo e configuração de perfis do cliente. */}
            <form onSubmit={handleSaveClient}>
              {/* UI: corpo rolável concentra os campos que serão enviados à API. */}
              <div className={styles.modalBody}>
                <div className={styles.formField}>
                  <label>Nome do Cliente / Marca *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Agência Terceiro Andar"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className={styles.formField}>
                  <label>Segmento / Nicho</label>
                  <input
                    type="text"
                    placeholder="Ex: Publicidade e Branding"
                    value={newSegment}
                    onChange={(e) => setNewSegment(e.target.value)}
                  />
                </div>

                <div className={styles.formField}>
                  <label>Cor de Destaque da Marca</label>
                  <div className={styles.colorPickerRow}>
                    <input
                      type="color"
                      value={newAccent}
                      onChange={(e) => setNewAccent(e.target.value)}
                    />
                    <input
                      type="text"
                      value={newAccent}
                      onChange={(e) => setNewAccent(e.target.value)}
                      style={{ width: "120px" }}
                    />
                  </div>
                </div>

                <div className={styles.formField}>
                  <label>Logo do Cliente (SVG)</label>
                  {newLogoUrl && (
                    <div style={{ marginBottom: "0.5rem" }}>
                      <img src={newLogoUrl} alt="Logo preview" style={{ height: 40, objectFit: "contain" }} />
                    </div>
                  )}
                  <input
                    type="file"
                    accept=".svg, image/svg+xml"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleLogoUpload(e.target.files[0]);
                      }
                    }}
                  />
                  {uploadingLogo && <span style={{ fontSize: "0.8rem", color: "#666" }}>Fazendo upload...</span>}
                </div>

                <div className={styles.formField} style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <input
                    type="checkbox"
                    id="hasMultipleProfiles"
                    checked={newHasMultipleProfiles}
                    onChange={(e) => setNewHasMultipleProfiles(e.target.checked)}
                    style={{ width: "auto" }}
                  />
                  <label htmlFor="hasMultipleProfiles" style={{ margin: 0 }}>
                    Cliente gerencia mais de um perfil de instagram
                  </label>
                </div>

                <div className={styles.formField} style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <input
                    type="checkbox"
                    id="hasPreCalendar"
                    checked={newHasPreCalendar}
                    onChange={(e) => setNewHasPreCalendar(e.target.checked)}
                    style={{ width: "auto" }}
                  />
                  <label htmlFor="hasPreCalendar" style={{ margin: 0 }}>
                    Cliente possui pré-calendário (aprovação de copywriting antes das artes)
                  </label>
                </div>
              </div>

              {/* UI: rodapé mantém cancelamento e confirmação separados do conteúdo. */}
              <div className={styles.modalFooter}>
                {/* UI: cancela sem enviar nem alterar a lista. */}
                <button
                  type="button"
                  className={styles.modalCancelBtn}
                  onClick={() => setShowModal(false)}
                  disabled={creating || uploadingLogo}
                >
                  Cancelar
                </button>
                {/* UI: confirma criação ou edição e bloqueia cliques enquanto salva. */}
                <button
                  type="submit"
                  className={styles.modalSubmitBtn}
                  disabled={creating || uploadingLogo}
                >
                  {creating ? "Salvando..." : "Salvar Cliente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
