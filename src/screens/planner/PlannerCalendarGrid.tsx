import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import { addMonths, format, getDay, getDaysInMonth, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "../../lib/utils";
import { DAY_NAMES, DEFAULT_POST, POST_TYPES } from "../../lib/constants";
import { ClientData, PostData } from "../../types";
import { api } from "../../lib/api";
import { EditorCapabilities } from "../../lib/editor-capabilities";
import { useNotifications } from "../../contexts/NotificationContext";
import { Button } from "../../components/ui/Button/Button";
import { IconButton } from "../../components/ui/IconButton/IconButton";
import { Input } from "../../components/ui/Input/Input";
import { Select } from "../../components/ui/Select/Select";
import styles from "./PlannerCalendarGrid.module.css";

type PlannerCalendarGridProps = {
  currentClient: ClientData | null;
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  selectedDateStr: string | null;
  setSelectedDateStr: (date: string | null) => void;
  posts: Record<string, PostData>;
  setPosts: React.Dispatch<React.SetStateAction<Record<string, PostData>>>;
  orderedPlannedPosts: Array<{ date: string; id?: string }>;
  plannerFrequency: string;
  setPlannerFrequency: (value: string) => void;
  config: any;
  setConfig: React.Dispatch<React.SetStateAction<any>>;
  hasUnrecognizedFrequency: boolean;
  parsePostingFrequency: (value?: string) => number[];
  daysToFrequencyText: (days: number[]) => string;
  savePostInOrder: (clientId: string, date: string, post: PostData) => Promise<void>;
  permissions: any;
  editorCapabilities: EditorCapabilities;
  setAppState: (state: any) => void;
  setIsConfirmDeleteOpen: (open: boolean) => void;
};

const postDate = (key: string, post: PostData) => post.date || key.split("#")[0];
const previewUrl = (post: PostData) => post.feedImages?.[0] || post.coverImage || post.linkedinCover || post.storyImage || null;
const postTitle = (post: PostData) => post.title || post.head || post.subhead || post.subtitle || "Publicação sem título";

function ExpandedDayCell({ day, dateLabel, items, selectedKey, onSelect }: { day: number; dateLabel: string; items: Array<{ key: string; post: PostData }>; selectedKey: string | null; onSelect: (key: string) => void }) {
  return (
    <article className={cn(styles.expandedDay, items.length && styles.expandedDayPopulated)}>
      {/* style-architecture-button-exception: calendar day headers select a date within the planner grid. */}
      <button type="button" onClick={() => onSelect(items[0]?.key || dateLabel)} aria-label={`${day}, ${items.length} ${items.length === 1 ? "publicação" : "publicações"}`} className={styles.dayHeader}>
        <span>{day}</span>{items.length ? <span className={styles.countBadge}>{items.length}</span> : null}
      </button>
      {items.length ? (
        <div className={styles.dayPosts}>
          {items.slice(0, 3).map(({ key, post }) => {
            const image = previewUrl(post);
            const type = POST_TYPES.find((item) => item.id === post.type)?.label || post.type;
            const selected = selectedKey === key;
            return (
              /* style-architecture-button-exception: post tiles are feature-specific selectable calendar records. */
              <button key={key} type="button" onClick={() => onSelect(key)} aria-pressed={selected} title={postTitle(post)} className={cn(styles.postTile, selected && styles.postTileSelected)}>
                {image ? <img src={image} alt="" loading="lazy" className={styles.thumbnail} /> : <span className={styles.thumbnailFallback}>{String(type).slice(0, 2)}</span>}
                <span className={styles.postText}><strong>{postTitle(post)}</strong><span>{type}</span></span>
              </button>
            );
          })}
          {items.length > 3 ? <span className={styles.morePosts}>+ {items.length - 3} postagens</span> : null}
        </div>
      ) : (
        /* style-architecture-button-exception: empty calendar cells create or select a date. */
        <button type="button" onClick={() => onSelect(dateLabel)} className={styles.freeDay}>Dia livre</button>
      )}
    </article>
  );
}

export function PlannerCalendarGrid(props: PlannerCalendarGridProps) {
  const { currentClient, currentDate, setCurrentDate, selectedDateStr, setSelectedDateStr, posts, setPosts, plannerFrequency, setPlannerFrequency, config, setConfig, hasUnrecognizedFrequency, parsePostingFrequency, daysToFrequencyText, savePostInOrder, permissions, editorCapabilities, setIsConfirmDeleteOpen } = props;
  const { toast } = useNotifications();
  const [expanded, setExpanded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const activeDays: number[] = Array.isArray(config?.activeDays) ? config.activeDays.filter((day: unknown): day is number => Number.isInteger(day) && Number(day) >= 0 && Number(day) <= 6) : [];
  const defaultTypes = config?.defaultTypes && typeof config.defaultTypes === "object" ? config.defaultTypes : {};
  const postsByDate = useMemo(() => {
    const grouped = new Map<string, Array<{ key: string; post: PostData }>>();
    for (const [key, post] of Object.entries(posts)) { const date = postDate(key, post); const list = grouped.get(date) || []; list.push({ key, post }); grouped.set(date, list); }
    return grouped;
  }, [posts]);
  const selectedCalendarDate = selectedDateStr ? (posts[selectedDateStr] ? postDate(selectedDateStr, posts[selectedDateStr]) : selectedDateStr.split("#")[0]) : null;
  const monthEntries = useMemo(() => Array.from(postsByDate.entries()).flatMap(([date, items]) => date.startsWith(format(currentDate, "yyyy-MM")) ? items.map((item) => ({ ...item, date })) : []).sort((a, b) => a.date.localeCompare(b.date) || String(a.post.id || a.key).localeCompare(String(b.post.id || b.key), "pt-BR", { numeric: true })), [postsByDate, currentDate]);

  const generateCalendar = async () => {
    if (!currentClient || isGenerating) return;
    setIsGenerating(true);
    try {
      let created = 0;
      for (let day = 1; day <= getDaysInMonth(currentDate); day += 1) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        if (!activeDays.includes(getDay(date))) continue;
        const dateString = format(date, "yyyy-MM-dd");
        if ((postsByDate.get(dateString) || []).length) continue;
        const post: PostData = { ...DEFAULT_POST, type: defaultTypes[getDay(date)] || "post", date: dateString };
        await savePostInOrder(currentClient.id, dateString, post);
        setPosts((current) => ({ ...current, [dateString]: post }));
        created += 1;
      }
      if (created) { setPosts(await api.getPosts(currentClient.id)); toast(`${created} postagem${created === 1 ? "" : "s"} criada${created === 1 ? "" : "s"}.`, "success"); }
      else toast("A grade deste mês já está preenchida para os dias selecionados.", "info");
    } catch (error: any) {
      const refreshed = await api.getPosts(currentClient.id).catch(() => null);
      if (refreshed) setPosts(refreshed);
      toast(error?.response?.data?.error || "Não foi possível gerar a grade.", "error");
    } finally { setIsGenerating(false); }
  };

  return (
    <aside className={cn("planner-calendar-pane", styles.calendarPane, expanded ? styles.calendarExpanded : styles.calendarCompact)} data-calendar-expanded={expanded ? "true" : "false"}>
      <section aria-labelledby="planner-calendar-title">
        <div className={styles.sectionHeader}><h3 id="planner-calendar-title">Calendário editorial</h3><Button size="small" variant="glass" onClick={() => setExpanded((value) => !value)} aria-label={expanded ? "Recolher calendário expandido" : "Expandir calendário"} aria-pressed={expanded} icon={expanded ? <Minimize2 /> : <Maximize2 />}>{expanded ? "Recolher" : "Expandir"}</Button></div>
        <div className={styles.monthSurface}>
          <div className={styles.monthHeader}><IconButton label="Mês anterior" onClick={() => setCurrentDate(subMonths(currentDate, 1))} size="small"><ChevronLeft /></IconButton><span>{format(currentDate, "MMMM yyyy", { locale: ptBR })}</span><IconButton label="Próximo mês" onClick={() => setCurrentDate(addMonths(currentDate, 1))} size="small"><ChevronRight /></IconButton></div>
          <div className={styles.calendarGrid}>
            {DAY_NAMES.map((name) => <div key={name} className={styles.weekdayLabel}>{expanded ? name.slice(0, 3) : name[0]}</div>)}
            {Array.from({ length: getDay(startOfMonth(currentDate)) }).map((_, index) => <div key={`empty-${index}`} className={expanded ? styles.emptyExpanded : styles.emptyCompact} />)}
            {Array.from({ length: getDaysInMonth(currentDate) }).map((_, index) => {
              const day = index + 1;
              const dateString = format(new Date(currentDate.getFullYear(), currentDate.getMonth(), day), "yyyy-MM-dd");
              const dayPosts = postsByDate.get(dateString) || [];
              const selected = selectedCalendarDate === dateString;
              if (expanded) return <ExpandedDayCell key={day} day={day} dateLabel={dateString} items={dayPosts} selectedKey={selectedDateStr} onSelect={setSelectedDateStr} />;
              return (
                /* style-architecture-button-exception: compact calendar cells select a date or its first post. */
                <button key={day} type="button" onClick={() => setSelectedDateStr(dayPosts[0]?.key || dateString)} aria-label={`${day} de ${format(currentDate, "MMMM", { locale: ptBR })}${dayPosts.length ? `, ${dayPosts.length} ${dayPosts.length === 1 ? "publicação" : "publicações"}` : ", sem publicações"}`} className={cn(styles.compactDay, selected && styles.compactDaySelected, dayPosts.length && styles.compactDayPopulated)}>{day}{dayPosts.length && !selected ? <span className={styles.postDot} /> : null}</button>
              );
            })}
          </div>
        </div>
      </section>
      <div className={cn(styles.toolsGrid, expanded && permissions.canConfigClients && styles.toolsExpanded)} data-calendar-tools>
        {permissions.canConfigClients ? <section aria-labelledby="weekly-calendar-title" className={styles.toolPanel}>
          <div className={styles.toolHeader}><h3 id="weekly-calendar-title">Configurar calendário semanal</h3><span>Aplicado ao mês atual</span></div>
          <Input id="planner-frequency" label="Frequência da grade" value={plannerFrequency} onChange={(event) => { const value = event.target.value; setPlannerFrequency(value); const parsed = parsePostingFrequency(value); if (parsed.length) setConfig((previous: any) => ({ ...previous, activeDays: parsed })); }} placeholder="Ex.: Terças e quintas" className="w-full" />
          {hasUnrecognizedFrequency ? <p className={styles.warning}>Texto não identificado. Selecione os dias abaixo antes de gerar.</p> : null}
          <div className={styles.weekdayGrid}>{DAY_NAMES.map((name, index) => {
            const active = activeDays.includes(index);
            return (
              /* style-architecture-button-exception: weekday toggles configure the planner recurrence model. */
              <button key={name} type="button" aria-pressed={active} aria-label={name} onClick={() => { const next = active ? activeDays.filter((day) => day !== index) : [...activeDays, index].sort(); setConfig({ ...config, activeDays: next }); setPlannerFrequency(daysToFrequencyText(next)); }} className={cn(styles.weekdayToggle, active && styles.weekdayToggleActive)}>{name[0]}</button>
            );
          })}</div>
          <div className={styles.toolActions}><Button className="flex-1" size="small" variant="primary" loading={isGenerating} disabled={!activeDays.length} onClick={() => void generateCalendar()}>Gerar calendário</Button>{editorCapabilities.canDeletePost ? <Button size="small" variant="danger" onClick={() => setIsConfirmDeleteOpen(true)}>Limpar</Button> : null}</div>
        </section> : null}
        <section className={styles.toolPanel} aria-labelledby="scheduled-posts-title">
          <div className={styles.toolHeader}><h3 id="scheduled-posts-title">Postagens agendadas</h3><span className={styles.totalBadge}>{monthEntries.length} posts</span></div>
          {monthEntries.length ? <Select className="w-full" aria-label="Selecionar publicação do mês" value={selectedDateStr || ""} onChange={(event) => setSelectedDateStr(event.target.value || null)}><option value="">Visão geral do cliente</option>{monthEntries.map((item) => <option key={item.key} value={item.key}>{format(new Date(`${item.date}T12:00:00`), "dd/MM")} — {postTitle(item.post)}</option>)}</Select> : <p className={styles.emptyMessage}>Nenhuma publicação agendada neste mês.</p>}
        </section>
      </div>
    </aside>
  );
}
