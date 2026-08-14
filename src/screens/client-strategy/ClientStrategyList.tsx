import { Plus, Search, Filter, Briefcase, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ClientData } from "../../types";
import { Select } from "../../components/ui/Select/Select";
import { Input } from "../../components/ui/Input/Input";
import { Button } from "../../components/ui/Button/Button";
import { IconButton } from "../../components/ui/IconButton/IconButton";
import styles from "./ClientStrategyList.module.css";

type ClientStrategyListProps = {
  clients: ClientData[];
  filteredClients: ClientData[];
  selectedClient: ClientData | null;
  setSelectedClient: (client: ClientData | null) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  sectorFilter: string;
  setSectorFilter: (sec: string) => void;
  tagFilter: string;
  setTagFilter: (tag: string) => void;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  allSectors: string[];
  allTags: string[];
  loading: boolean;
  handleCreateDraft: () => void;
};

export function ClientStrategyList({
  filteredClients,
  selectedClient,
  setSelectedClient,
  searchTerm,
  setSearchTerm,
  sectorFilter,
  setSectorFilter,
  tagFilter,
  setTagFilter,
  showFilters,
  setShowFilters,
  allSectors,
  allTags,
  loading,
  handleCreateDraft,
}: ClientStrategyListProps) {
  return (
    <div className={styles.sidebar}>
      <div className={styles.heading}>
        <h1>Gestão Estratégica</h1>
        <p>Alinhamento de Conteúdo & Briefings</p>
      </div>

      <Button
        onClick={handleCreateDraft}
        className="w-full"
        variant="primary"
        icon={<Plus />}
      >
        Novo Briefing / Cliente
      </Button>

      <div className={styles.searchField}>
        <Search />
        <Input
          type="text"
          placeholder="Buscar por marca..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full"
        />
        <IconButton
          label="Alternar filtros"
          onClick={() => setShowFilters(!showFilters)}
          className="absolute right-3 top-1/2 -translate-y-1/2"
          variant={showFilters ? "primary" : "ghost"}
          size="small"
        >
          <Filter />
        </IconButton>
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={styles.filters}
          >
            <div className={styles.filterGrid}>
              <div className={styles.filterField}>
                <label>Setor</label>
                <Select
                  aria-label="Setor"
                  value={sectorFilter}
                  onChange={(e) => setSectorFilter(e.target.value)}
                  className="w-full"
                >
                  <option value="">Todos</option>
                  {allSectors.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </div>

              <div className={styles.filterField}>
                <label>Tag</label>
                <Select
                  aria-label="Tag"
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  className="w-full"
                >
                  <option value="">Todas</option>
                  {allTags.map((t) => (
                    <option key={t} value={t}>
                      #{t}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className={styles.filterActions}>
              <Button
                onClick={() => {
                  setSectorFilter("");
                  setTagFilter("");
                  setSearchTerm("");
                }}
                variant="danger"
                size="small"
              >
                Limpar Filtros
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={styles.clientList}>
        {loading ? (
          <div className={styles.loading}>Carregando direcionamentos...</div>
        ) : filteredClients.length > 0 ? (
          filteredClients.map((c) => {
            const isSelected = selectedClient && selectedClient.id === c.id;
            return (
              /* style-architecture-button-exception: client rows are feature-specific navigation cards. */
              <button
                type="button"
                key={c.id}
                onClick={() => setSelectedClient(c)}
                className={styles.clientRow}
                data-active={isSelected || undefined}
              >
                <div className={styles.clientIdentity}>
                  <div className={styles.avatar}>
                    {c.name ? c.name.substring(0, 2).toUpperCase() : <Briefcase />}
                  </div>
                  <div className={styles.clientCopy}>
                    <strong>{c.name || "Novo Rascunho"}</strong>
                    <span>{c.config?.sector || "Sem setor configurado"}</span>
                  </div>
                </div>
                <ChevronRight />
              </button>
            );
          })
        ) : (
          <div className={styles.empty}>Nenhum cliente encontrado.</div>
        )}
      </div>
    </div>
  );
}
