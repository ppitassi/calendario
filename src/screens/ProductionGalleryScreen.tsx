import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Filter, Search, X } from "lucide-react";
import { MainLayout } from "../components/MainLayout";
import { api } from "../lib/api";
import { ClientData, UserProfile } from "../types";
import { TeamFilterMenu } from "./production-gallery/TeamFilterMenu";
import { GalleryCard } from "./production-gallery/GalleryCard";
import { extractImages, GalleryPost, statusLabel } from "./production-gallery/gallery-helpers";
import { Select } from "../components/ui/Select/Select";
import { Input } from "../components/ui/Input/Input";
import { Button } from "../components/ui/Button/Button";
import { IconButton } from "../components/ui/IconButton/IconButton";
import styles from "./ProductionGalleryScreen.module.css";

export function ProductionGalleryScreen({
  onExit,
  onNavigate,
  onOpenPost,
  initialFilters,
}: {
  onExit: () => void;
  onNavigate: (screen: string) => void;
  onOpenPost: (client: ClientData, post: GalleryPost) => void;
  initialFilters?: { status?: string; members?: string[] };
}) {
  const [posts, setPosts] = useState<GalleryPost[]>([]);
  const [clients, setClients] = useState<ClientData[]>([]);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [clientId, setClientId] = useState("");
  const [month, setMonth] = useState("");
  const [status, setStatus] = useState(initialFilters?.status || "");
  const [memberTags, setMemberTags] = useState<string[]>(
    initialFilters?.members || [],
  );
  const [format, setFormat] = useState("");

  useEffect(() => {
    void api
      .getProductionGallery({ pageSize: 100 })
      .then((data) => {
        setPosts(data.items);
        setClients(data.clients);
        setMembers(data.members);
        setTotal(data.total);
      })
      .catch((error) => {
        console.error("Erro ao carregar GET /production-gallery:", error);
        setPosts([]);
        setClients([]);
        setMembers([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, []);

  const months = useMemo(
    () =>
      [
        ...new Set(
          posts
            .map((post) => String(post.date || "").slice(0, 7))
            .filter(Boolean),
        ),
      ]
        .sort()
        .reverse(),
    [posts],
  );

  const filtered = useMemo(
    () =>
      posts.filter((post) => {
        const client = clients.find((item) => item.id === post.clientId);
        const query =
          `${post.title || ""} ${post.head || ""} ${post.subhead || ""} ${client?.name || ""}`.toLowerCase();
        return (
          (!search || query.includes(search.toLowerCase())) &&
          (!clientId || post.clientId === clientId) &&
          (!month || String(post.date || "").startsWith(month)) &&
          (!status ||
            (status === "Atrasadas"
              ? Boolean(
                  post.dueDate &&
                    new Date(post.dueDate) < new Date() &&
                    !["aprovado", "publicado", "arquivado"].includes(
                      post.currentStage || "",
                    ),
                )
              : status === "Sem responsável"
                ? !post.currentAssigneeId
                : statusLabel(post.status, post.currentStage) === status)) &&
          (!memberTags.length ||
            memberTags.includes(
              String(
                post.currentAssigneeId ||
                  post.assigneeId ||
                  post.assignedTo ||
                  "",
              ),
            )) &&
          (!format || post.type === format)
        );
      }),
    [posts, clients, search, clientId, month, status, memberTags, format],
  );

  const clear = () => {
    setSearch("");
    setClientId("");
    setMonth("");
    setStatus("");
    setMemberTags([]);
    setFormat("");
  };

  return (
    <MainLayout activeScreen="production_gallery" onNavigate={onNavigate}>
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.titleGroup}>
            <IconButton
              onClick={onExit}
              label="Voltar"
              variant="glass"
            >
              <ArrowLeft />
            </IconButton>
            <div>
              <h1>
                Esteira visual de produção
              </h1>
              <p>
                Todas as artes da agência em um só lugar
              </p>
            </div>
          </div>
          <div className={styles.countBadge}>
            {total} posts ·{" "}
            {filtered.reduce((sum, post) => sum + extractImages(post).length, 0)} artes
          </div>
        </header>

        <section className={`filter-overlay-host ${styles.filters}`}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div className={styles.searchField}>
              <Search />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar arte ou post"
                className="min-w-0 flex-1"
              />
            </div>
            <Select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">Todos os clientes</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
            <Select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            >
              <option value="">Todos os meses</option>
              {months.map((value) => (
                <option key={value} value={value}>
                  {value.split("-").reverse().join("/")}
                </option>
              ))}
            </Select>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Todos os estados</option>
              {[
                "Planejados",
                "Criação",
                "Revisão",
                "Aprovação",
                "Concluído",
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </Select>
            <TeamFilterMenu
              members={members}
              selected={memberTags}
              onChange={setMemberTags}
            />
            <div className="flex gap-2">
              <Select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="min-w-0 flex-1"
              >
                <option value="">Formatos</option>
                {["post", "carousel", "reel", "story"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </Select>
              <Button
                onClick={clear}
                variant="ghost"
              >
                Limpar
              </Button>
            </div>
          </div>
        </section>

        {memberTags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {memberTags.map((uid) => {
              const user = members.find((item) => item.uid === uid);
              return (
                <Button
                  key={uid}
                  onClick={() =>
                    setMemberTags((current) =>
                      current.filter((id) => id !== uid),
                    )
                  }
                  size="small"
                  variant="glass"
                  icon={<X />}
                >
                  {user?.displayName || user?.email || uid}
                </Button>
              );
            })}
          </div>
        )}

        {loading ? (
          <div className={styles.skeletonGrid}>
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className={styles.skeleton}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>
            <div>
              <Filter />
              <h2>Nenhuma arte encontrada</h2>
              <Button
                onClick={clear}
                className="mt-3"
                size="small"
                variant="ghost"
              >
                Limpar filtros
              </Button>
            </div>
          </div>
        ) : (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filtered.map((post) => (
              <GalleryCard
                key={String(post.id || `${post.clientId}-${post.date}`)}
                post={post}
                clients={clients}
                members={members}
                onOpenPost={onOpenPost}
              />
            ))}
          </section>
        )}
      </main>
    </MainLayout>
  );
}
