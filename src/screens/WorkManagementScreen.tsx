"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ChevronRight,
  FolderKanban,
  ListTodo,
  Plus,
  RefreshCw,
  Unlink,
} from "lucide-react";
import { MainLayout } from "../components/MainLayout";
import { Button } from "../components/ui/Button/Button";
import { ClientData } from "../types";
import * as workApi from "../lib/api/work-items-api";
import styles from "./WorkManagementScreen.module.css";
import { WorkItemCapabilitiesPanel } from "./work-management/WorkItemCapabilitiesPanel";

type Props = {
  currentClient: ClientData | null;
  onNavigate: (screen: string) => void;
};
const labels = {
  PROJECT: "Projeto",
  DEMAND: "Demanda",
  TASK: "Tarefa",
} as const;
export function WorkManagementScreen({ currentClient, onNavigate }: Props) {
  const [items, setItems] = useState<any[]>([]),
    [selected, setSelected] = useState<any | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [creating, setCreating] = useState(false),
    [showArchived, setShowArchived] = useState(false);
  const [type, setType] = useState<workApi.WorkItemType>("TASK"),
    [title, setTitle] = useState(""),
    [parentId, setParentId] = useState("");
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setItems(
        await workApi.listWorkItems({
          ...(currentClient?.id && { clientId: currentClient.id }),
          ...(showArchived && { archived: "true" }),
        }),
      );
    } catch (e: any) {
      setError(
        e.response?.data?.error || "Não foi possível carregar o trabalho.",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [currentClient?.id, showArchived]);
  const parents = useMemo(
    () =>
      items.filter((item) =>
        type === "DEMAND"
          ? item.type === "PROJECT"
          : type === "TASK"
            ? ["PROJECT", "DEMAND"].includes(item.type)
            : false,
      ),
    [items, type],
  );
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    try {
      await workApi.createWorkItem({
        type,
        title: title.trim(),
        parentId: parentId || null,
        clientId: currentClient?.id || null,
      });
      setTitle("");
      setParentId("");
      await load();
    } catch (e: any) {
      setError(e.response?.data?.error || "Não foi possível criar o item.");
    } finally {
      setCreating(false);
    }
  };
  const open = async (id: string) => {
    try {
      setSelected(await workApi.getWorkItem(id));
    } catch (e: any) {
      setError(e.response?.data?.error || "Não foi possível abrir o item.");
    }
  };
  const updateStatus = async (status: string) => {
    if (!selected) return;
    await workApi.updateWorkItem(selected.id, {
      status,
      progress: status === "DONE" ? 100 : selected.progress,
    });
    await open(selected.id);
    await load();
  };
  const move = async (nextParentId: string) => {
    if (!selected) return;
    await workApi.moveWorkItem(selected.id, nextParentId || null);
    await open(selected.id);
    await load();
  };
  const validParents = selected
    ? items.filter(
        (candidate) =>
          candidate.id !== selected.id &&
          (selected.type === "DEMAND"
            ? candidate.type === "PROJECT"
            : selected.type === "TASK"
              ? ["PROJECT", "DEMAND"].includes(candidate.type)
              : false),
      )
    : [];
  return (
    <MainLayout
      activeScreen="operations"
      onNavigate={onNavigate}
      currentClient={currentClient}
    >
      <main className={styles.page}>
        <header className={styles.header}>
          <div>
            <span>CORE OPERACIONAL</span>
            <h1>Projetos, demandas e tarefas</h1>
            <p>Organize o trabalho sem exigir vínculos artificiais.</p>
          </div>
          <div className={styles.headerActions}>
            <Button
              variant="glass"
              onClick={() => setShowArchived((value) => !value)}
            >
              {showArchived ? "Ocultar arquivados" : "Ver arquivados"}
            </Button>
            <Button
              variant="glass"
              icon={<RefreshCw />}
              onClick={() => void load()}
            >
              Atualizar
            </Button>
          </div>
        </header>
        {error && <div className={styles.error}>{error}</div>}
        <section className={styles.layout}>
          <div className={styles.column}>
            <form className={styles.create} onSubmit={submit}>
              <div className={styles.typeTabs}>
                {(["PROJECT", "DEMAND", "TASK"] as const).map((value) => (
                  <button
                    type="button"
                    key={value}
                    data-active={type === value}
                    onClick={() => {
                      setType(value);
                      setParentId("");
                    }}
                  >
                    {labels[value]}
                  </button>
                ))}
              </div>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={`Título da ${labels[type].toLowerCase()}`}
                aria-label="Título"
              />
              <select
                value={parentId}
                onChange={(event) => setParentId(event.target.value)}
                disabled={type === "PROJECT"}
              >
                <option value="">Sem vínculo</option>
                {parents.map((parent) => (
                  <option key={parent.id} value={parent.id}>
                    {parent.type} · {parent.title}
                  </option>
                ))}
              </select>
              <Button
                type="submit"
                variant="primary"
                loading={creating}
                icon={<Plus />}
              >
                Criar
              </Button>
            </form>
            <div className={styles.list}>
              {loading ? (
                <p>Carregando…</p>
              ) : items.length === 0 ? (
                <div className={styles.empty}>
                  <ListTodo />
                  <strong>Nenhum item ainda</strong>
                  <span>Crie uma tarefa avulsa ou comece por um projeto.</span>
                </div>
              ) : (
                items.map((item) => (
                  <button
                    key={item.id}
                    className={styles.item}
                    data-selected={selected?.id === item.id}
                    onClick={() => void open(item.id)}
                  >
                    <span className={styles.icon}>
                      {item.type === "PROJECT" ? (
                        <FolderKanban />
                      ) : (
                        <ListTodo />
                      )}
                    </span>
                    <span>
                      <small>
                        {labels[item.type as keyof typeof labels]} ·{" "}
                        {item.status}
                      </small>
                      <strong>{item.title}</strong>
                      <em>
                        {item.client_name || "Sem cliente"}
                        {item.due_at
                          ? ` · ${new Date(item.due_at).toLocaleDateString("pt-BR")}`
                          : ""}
                      </em>
                    </span>
                    <ChevronRight />
                  </button>
                ))
              )}
            </div>
          </div>
          <aside className={styles.detail}>
            {selected ? (
              <>
                <div className={styles.detailHead}>
                  <small>{labels[selected.type as keyof typeof labels]}</small>
                  <h2>{selected.title}</h2>
                  <p>{selected.description || "Sem descrição."}</p>
                </div>
                <div className={styles.metrics}>
                  <span>
                    <b>{selected.progress}%</b>Progresso
                  </span>
                  <span>
                    <b>
                      {selected.child_count || selected.children?.length || 0}
                    </b>
                    Itens filhos
                  </span>
                  <span>
                    <b>{selected.assignees?.length || 0}</b>Responsáveis
                  </span>
                </div>
                <label>
                  Status
                  <select
                    value={selected.status}
                    onChange={(event) => void updateStatus(event.target.value)}
                  >
                    {[
                      "TODO",
                      "IN_PROGRESS",
                      "BLOCKED",
                      "REVIEW",
                      "DONE",
                      "CANCELLED",
                    ].map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>
                {selected.type !== "PROJECT" && (
                  <label className={styles.hierarchyControls}>
                    Vínculo hierárquico
                    <select
                      value={selected.parent_id || ""}
                      onChange={(event) => void move(event.target.value)}
                    >
                      <option value="">Sem vínculo</option>
                      {validParents.map((parent) => (
                        <option key={parent.id} value={parent.id}>
                          {parent.type} · {parent.title}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <div className={styles.children}>
                  <h3>Itens vinculados</h3>
                  {selected.children?.map((child: any) => (
                    <button key={child.id} onClick={() => void open(child.id)}>
                      {child.title}
                      <ChevronRight />
                    </button>
                  ))}
                  {!selected.children?.length && <p>Nenhum item vinculado.</p>}
                </div>
                <WorkItemCapabilitiesPanel
                  item={selected}
                  onRefresh={async () => {
                    await open(selected.id);
                    await load();
                  }}
                />
                <div className={styles.detailActions}>
                  {selected.parent_id && (
                    <Button
                      variant="ghost"
                      icon={<Unlink />}
                      onClick={() => void move("")}
                    >
                      Desvincular
                    </Button>
                  )}
                  {selected.archived_at ? (
                    <Button
                      variant="ghost"
                      icon={<RefreshCw />}
                      onClick={() =>
                        void workApi
                          .restoreWorkItem(selected.id)
                          .then(async () => {
                            setSelected(null);
                            await load();
                          })
                      }
                    >
                      Restaurar
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      icon={<Archive />}
                      onClick={() =>
                        void workApi
                          .archiveWorkItem(selected.id)
                          .then(async () => {
                            setSelected(null);
                            await load();
                          })
                      }
                    >
                      Arquivar
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <div className={styles.empty}>
                <FolderKanban />
                <strong>Selecione um item</strong>
                <span>Detalhes, responsáveis e histórico aparecerão aqui.</span>
              </div>
            )}
          </aside>
        </section>
      </main>
    </MainLayout>
  );
}
