import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  Check,
  ChevronDown,
  Compass,
  Eye,
  MoreHorizontal,
  Search,
  Settings,
  Users,
  X,
} from "lucide-react";
import { ClientData } from "../types";
import { cn } from "../lib/utils";
import {
  normalizedSearchText,
  recentClientIdsFrom,
} from "../lib/client-selection";
import dashboardStyles from "../widgets/dashboard/Dashboard.module.css";
import { Input } from "./ui/Input/Input";
import { Button } from "./ui/Button/Button";
import { IconButton } from "./ui/IconButton/IconButton";
import styles from "./ClientSwitcher.module.css";

type Destination = "editor" | "viewer" | "client_strategy" | "client_setup";

type ClientSwitcherProps = {
  clients: ClientData[];
  currentClient: ClientData | null;
  recentClientIds?: string[];
  loading?: boolean;
  error?: boolean;
  variant?: "dashboard" | "sidebar";
  expanded?: boolean;
  canCreate?: boolean;
  initiallyOpen?: boolean;
  onSelect: (client: ClientData) => void | Promise<void>;
  onDestination: (
    client: ClientData,
    destination: Destination,
  ) => void | Promise<void>;
  onCreate?: () => void;
};

const DESTINATIONS = [
  { id: "viewer" as const, label: "Apresentação", icon: Eye },
  { id: "client_strategy" as const, label: "Estratégia", icon: Compass },
  { id: "client_setup" as const, label: "Configurar marca", icon: Settings },
];

function ClientIdentity({
  client,
  size = "large",
}: {
  client: ClientData;
  size?: "small" | "large";
}) {
  return (
    <span
      className={styles.identity}
      data-size={size}
    >
      {client.logoUrl ? (
        <Image
          src={client.logoUrl}
          alt=""
          width={48}
          height={48}
          unoptimized
          className={styles.identityImage}
        />
      ) : (
        client.name.slice(0, 2).toUpperCase()
      )}
    </span>
  );
}

function IntegrationLabel({ client }: { client: ClientData }) {
  const connected = Boolean(
    client.meta_account_id ||
    client.youtube_channel_id ||
    client.tiktok_username ||
    client.linkedin_org_id ||
    client.x_username,
  );
  return (
    <span className={styles.integrationLabel}>
      {connected ? "Conta integrada" : "Sem integração"}
    </span>
  );
}

export function ClientSwitcher({
  clients,
  currentClient,
  recentClientIds = [],
  loading = false,
  error = false,
  variant = "dashboard",
  expanded = true,
  canCreate = false,
  initiallyOpen = false,
  onSelect,
  onDestination,
  onCreate,
}: ClientSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuClientId, setMenuClientId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (initiallyOpen) setOpen(true);
  }, [initiallyOpen]);
  const accessibleIds = useMemo(
    () => new Set(clients.map((client) => client.id)),
    [clients],
  );
  const recentIds = recentClientIdsFrom(recentClientIds, accessibleIds);
  const visibleClients = useMemo(() => {
    const byId = new Map(clients.map((client) => [client.id, client]));
    const ordered = recentIds
      .map((id) => byId.get(id))
      .filter(Boolean) as ClientData[];
    if (
      currentClient &&
      accessibleIds.has(currentClient.id) &&
      !ordered.some((client) => client.id === currentClient.id)
    )
      ordered.unshift(currentClient);
    for (const client of clients) {
      if (ordered.length >= 6) break;
      if (!ordered.some((item) => item.id === client.id)) ordered.push(client);
    }
    return ordered.slice(0, 6);
  }, [clients, currentClient, recentIds.join("|"), accessibleIds]);
  const filteredClients = useMemo(() => {
    const normalizedQuery = normalizedSearchText(query);
    if (!normalizedQuery) return clients;
    return clients.filter((client) =>
      normalizedSearchText(client.name).includes(normalizedQuery),
    );
  }, [clients, query]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => searchRef.current?.focus(), 50);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    setQuery("");
    setMenuClientId(null);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  };
  const select = async (client: ClientData) => {
    setAnnouncement(
      `${client.name} selecionada. Abrindo Planejador de Calendários.`,
    );
    close();
    await onSelect(client);
  };
  const openDestination = async (
    client: ClientData,
    destination: Destination,
  ) => {
    setAnnouncement(`${client.name} selecionada.`);
    close();
    await onDestination(client, destination);
  };

  const triggerLabel = currentClient
    ? `Trocar cliente atual: ${currentClient.name}`
    : "Selecionar cliente";
  const triggerTooltip =
    variant === "sidebar"
      ? currentClient?.name || "Selecionar cliente"
      : undefined;
  const triggerIdentity = currentClient ? (
    <ClientIdentity client={currentClient} size="small" />
  ) : (
    <span className={styles.fallbackIdentity}>CL</span>
  );

  const trigger = !expanded && variant === "sidebar" ? (
    <IconButton
      ref={triggerRef}
      type="button"
      onClick={() => setOpen(true)}
      aria-haspopup="dialog"
      aria-expanded={open}
      label={triggerLabel}
      data-sidebar-tooltip={triggerTooltip}
      size="medium"
      variant="glass"
    >
      {triggerIdentity}
    </IconButton>
  ) : (
    <Button
      ref={triggerRef}
      type="button"
      onClick={() => setOpen(true)}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={triggerLabel}
      data-sidebar-tooltip={triggerTooltip}
      className="w-full"
      variant="glass"
    >
      {triggerIdentity}
      {expanded ? (
        <span className={styles.triggerCopy}>
          <strong>
            {currentClient?.name || "Selecionar cliente"}
          </strong>
          <span>
            {currentClient ? "Cliente ativo" : "Escolha o contexto"}
          </span>
        </span>
      ) : null}
      {expanded ? (
        <ChevronDown
          className={styles.chevron}
          aria-hidden="true"
        />
      ) : null}
    </Button>
  );

  const dialog = open ? (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-switcher-title"
        className={styles.dialog}
      >
        <header className={styles.dialogHeader}>
          <div>
            <h2 id="client-switcher-title">
              Selecionar cliente
            </h2>
            <p>
              Pesquise toda a carteira disponível para sua conta.
            </p>
          </div>
          <IconButton
            type="button"
            onClick={close}
            label="Fechar seletor de clientes"
          >
            <X />
          </IconButton>
        </header>
        <div className={styles.dialogBody}>
          <div className={styles.searchField}>
            <span className="sr-only">Buscar cliente</span>
            <Search aria-hidden="true" />
            <Input
              ref={searchRef}
              aria-label="Buscar cliente"
              role="combobox"
              aria-expanded="true"
              aria-controls="client-switcher-results"
              aria-autocomplete="list"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar cliente por nome..."
              className="w-full"
            />
          </div>
          <div
            id="client-switcher-results"
            className={styles.results}
            role="list"
            aria-label="Clientes disponíveis"
          >
            {filteredClients.map((client) => {
              const active = client.id === currentClient?.id;
              return (
                <div
                  key={client.id}
                  role="listitem"
                  className={styles.resultRow}
                  data-active={active || undefined}
                >
                  <Button
                    type="button"
                    onClick={() => void select(client)}
                    aria-current={active ? "true" : undefined}
                    className="min-w-0 flex-1"
                    variant="ghost"
                  >
                    <ClientIdentity client={client} size="small" />
                    <span className={styles.resultCopy}>
                      <strong>
                        {client.name}
                      </strong>
                      <IntegrationLabel client={client} />
                    </span>
                    {active ? (
                      <span className={styles.activeLabel}>
                        <Check /> Ativo
                      </span>
                    ) : null}
                  </Button>
                  <IconButton
                    type="button"
                    onClick={() =>
                      setMenuClientId(
                        menuClientId === client.id ? null : client.id,
                      )
                    }
                    label={`Mais áreas de ${client.name}`}
                    aria-expanded={menuClientId === client.id}
                  >
                    <MoreHorizontal />
                  </IconButton>
                  {menuClientId === client.id ? (
                    <div className={styles.destinationMenu}>
                      {DESTINATIONS.map(({ id, label, icon: Icon }) => (
                        <Button
                          key={id}
                          type="button"
                          onClick={() => void openDestination(client, id)}
                          className="w-full"
                          variant="ghost"
                          icon={<Icon />}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {!filteredClients.length ? (
              <div className={styles.emptyResults}>
                Nenhum cliente corresponde à busca.
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  ) : null;

  if (variant === "sidebar")
    return (
      <>
        {trigger}
        {dialog}
        <span className="sr-only" role="status" aria-live="polite">
          {announcement}
        </span>
      </>
    );

  return (
    <section
      className={dashboardStyles.nativeSection}
      aria-labelledby="dashboard-clients-title"
    >
      <header className={dashboardStyles.sectionHeader}>
        <div className={styles.sectionTitle}>
          <Users />
          <div>
            <h2 id="dashboard-clients-title">Clientes</h2>
            <p>
              Escolha uma marca para abrir o Planejador de Calendários.
            </p>
          </div>
        </div>
        {clients.length ? (
          <Button
            ref={triggerRef}
            type="button"
            onClick={() => setOpen(true)}
            size="small"
            variant="ghost"
          >
            Ver todos os clientes
          </Button>
        ) : null}
      </header>
      {loading ? (
        <div
          className={dashboardStyles.clientRow}
          aria-label="Carregando clientes"
        >
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className={styles.skeleton}
            />
          ))}
        </div>
      ) : null}
      {!loading && error ? (
        <div
          className={styles.error}
          role="alert"
        >
          Não foi possível carregar a carteira. Atualize a página para tentar
          novamente.
        </div>
      ) : null}
      {!loading && !error && !clients.length ? (
        <div className={styles.emptyState}>
          <strong>
            Nenhum cliente disponível para sua conta
          </strong>
          <span>
            Peça acesso a uma marca ou cadastre um novo cliente.
          </span>
          {canCreate && onCreate ? (
            <Button
              type="button"
              onClick={onCreate}
              className="mt-4"
              variant="primary"
            >
              Cadastrar cliente
            </Button>
          ) : null}
        </div>
      ) : null}
      {!loading && !error && visibleClients.length ? (
        <div className={dashboardStyles.clientRow}>
          {visibleClients.map((client) => {
            const active = client.id === currentClient?.id;
            return (
              <article
                key={client.id}
                className={cn(
                  dashboardStyles.clientCard,
                  active && dashboardStyles.clientCardActive,
                )}
              >
                <Button
                  type="button"
                  onClick={() => void select(client)}
                  aria-current={active ? "true" : undefined}
                  className="min-w-0 flex-1"
                  variant="ghost"
                >
                  <ClientIdentity client={client} />
                  <span className={styles.cardCopy}>
                    <strong>
                      {client.name}
                    </strong>
                    <IntegrationLabel client={client} />
                    {active ? (
                      <span className={styles.cardActiveLabel}>
                        <Check /> Cliente ativo
                      </span>
                    ) : null}
                  </span>
                </Button>
                <IconButton
                  type="button"
                  onClick={() => {
                    setMenuClientId(client.id);
                    setOpen(true);
                  }}
                  label={`Outras áreas de ${client.name}`}
                >
                  <MoreHorizontal />
                </IconButton>
              </article>
            );
          })}
        </div>
      ) : null}
      {dialog}
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </section>
  );
}
