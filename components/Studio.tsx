"use client";
/**
 * Área de trabalho editorial. Mantém uma única fonte de estado para calendário,
 * editor, prévia e apresentação e persiste cada alteração no SQLite.
 */


import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MonitorPlay,
  Plus,
  ArrowLeft,
  Bell,
  AlertCircle,
  X,
} from "lucide-react";
import { Calendar } from "./Calendar";
import { Editor } from "./Editor";
import { Preview } from "./Preview";
import { Presentation } from "./Presentation";
import { dateKey, monthKey, monthLabel, shiftMonth, parseMonthKey } from "../lib/date";
import type { CalendarRecord, ContentItem, ContentType } from "../lib/types";

/** Carrega uma competência, coordena sua edição e entrega os mesmos dados às três colunas. */
export function Studio({
  calendarId,
  onBack,
  onOpenPresentation,
  onMonthChange,
  initialPresenting = false,
}: {
  calendarId: string;
  onBack: () => void;
  onOpenPresentation?: () => void;
  onMonthChange?: (month: Date, calId: string) => void;
  initialPresenting?: boolean;
}) {
  const [calendar, setCalendar] = useState<CalendarRecord | null>(null);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [postingDays, setPostingDays] = useState<number[]>([]);
  const [weekdayFormats, setWeekdayFormats] = useState<Record<number, ContentType>>({});
  const [month, setMonth] = useState(() => new Date());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [presenting, setPresenting] = useState(initialPresenting);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Array<{ id: string; message: string; timestamp: Date }>>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const addNotification = (message: string) => {
    setNotifications((prev) => [
      { id: crypto.randomUUID(), message, timestamp: new Date() },
      ...prev,
    ]);
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  /** Carrega o calendário, suas publicações e a primeira seleção válida. */
  const loadCalendar = useCallback(async () => {
    try {
      setLoading(true);
      const calRes = await fetch(`/api/calendars/${calendarId}`);
      const cData = await calRes.json();

      if (cData.calendar) {
        setCalendar(cData.calendar);
        if (cData.calendar.month) {
          const mDate = parseMonthKey(cData.calendar.month);
          setMonth(mDate);
          try {
            localStorage.setItem("cp:active-month", cData.calendar.month);
          } catch {}
        }
        if (Array.isArray(cData.calendar.posting_days)) {
          setPostingDays(cData.calendar.posting_days);
        }
        if (cData.calendar.weekday_formats && typeof cData.calendar.weekday_formats === "object") {
          setWeekdayFormats(cData.calendar.weekday_formats);
        }
      }
      if (Array.isArray(cData.items)) {
        setItems(cData.items);
        if (cData.items.length > 0 && !selectedId) {
          setSelectedId(cData.items[0].id);
        }
      }
    } catch (err) {
      console.error("Error loading calendar:", err);
    } finally {
      setLoading(false);
    }
  }, [calendarId]);

  // Um novo `calendarId` reinicializa o conteúdo, a cadência e a seleção visível.
  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  // O Studio pode manter itens de outras competências; só o mês visível alimenta a tela.
  const currentMonthKey = monthKey(month);
  /** Filtra e ordena cronologicamente os itens da competência atualmente aberta. */
  const monthItems = useMemo(
    () =>
      items
        .filter((item) => item.date.startsWith(currentMonthKey))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [items, currentMonthKey]
  );

  const selected = items.find((item) => item.id === selectedId) || null;

  /**
   * Persiste metadados, cadência e a coleção completa de itens em uma única
   * atualização; o rótulo de estado informa sucesso ou falha ao operador.
   */
  const saveChanges = async (
    updatedItems = items,
    updatedCal = calendar,
    updatedPostingDays = postingDays,
    updatedWeekdayFormats = weekdayFormats
  ) => {
    if (!calendar) return;
    try {
      const res = await fetch(`/api/calendars/${calendar.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: updatedCal?.title,
          month: monthKey(month),
          brand: updatedCal?.brand,
          project: updatedCal?.project,
          accent: updatedCal?.accent,
          strategy: updatedCal?.strategy,
          audience: updatedCal?.audience,
          objective: updatedCal?.objective,
          status: updatedCal?.status,
          assignedToId: updatedCal?.assigned_to_id,
          postingDays: updatedPostingDays,
          weekdayFormats: updatedWeekdayFormats,
          items: updatedItems,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        addNotification(data.error || "Erro ao salvar alterações no banco de dados.");
      }
    } catch (err) {
      addNotification("Erro de conexão ao tentar sincronizar as alterações.");
    }
  };

  /** Salva o mês atual, garante o destino, carrega seus dados e seleciona o primeiro item. */
  const handleMonthChange = async (targetMonth: Date) => {
    if (!calendar) return;
    await saveChanges(items, calendar, postingDays);

    const mKey = monthKey(targetMonth);
    try {
      localStorage.setItem("cp:active-month", mKey);
    } catch {}

    setLoading(true);
    try {
      const ensureRes = await fetch("/api/calendars/ensure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: calendar.client_id,
          month: mKey,
        }),
      });
      const ensureData = await ensureRes.json();
      const targetCalId = ensureData.calendar?.id;

      if (targetCalId) {
        onMonthChange?.(targetMonth, targetCalId);
        const calRes = await fetch(`/api/calendars/${targetCalId}`);
        const calData = await calRes.json();
        if (calData.calendar) {
          setCalendar(calData.calendar);
          setMonth(targetMonth);
          const pDays = Array.isArray(calData.calendar.posting_days)
            ? calData.calendar.posting_days
            : postingDays;
          setPostingDays(pDays);
        }
        if (Array.isArray(calData.items)) {
          setItems(calData.items);
          if (calData.items.length > 0) {
            setSelectedId(calData.items[0].id);
          } else {
            setSelectedId(null);
          }
        }
      }
    } catch (err) {
      console.error("Error switching month:", err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Reconcilia rascunhos com a cadência semanal: preserva conteúdo preenchido,
   * remove apenas rascunhos vazios excedentes e cria os que estiverem faltando.
   */
  const handleUpdatePostingDays = async (newDays: number[]) => {
    if (!calendar) return;

    const year = month.getFullYear();
    const monthIdx = month.getMonth();
    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
    const targetCounts = new Map<string, number>();

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, monthIdx, day);
      const weekdayCount = newDays.filter((n) => n === d.getDay()).length;
      if (weekdayCount > 0) {
        targetCounts.set(dateKey(d), weekdayCount);
      }
    }

    const defaultProfile = calendar.brand
      ? `@${calendar.brand.toLowerCase().replace(/\s+/g, "")}`
      : "";

    const currentMonthPrefix = monthKey(month);
    const existingThisMonth = items.filter((it) => it.date.startsWith(currentMonthPrefix));
    const otherMonthItems = items.filter((it) => !it.date.startsWith(currentMonthPrefix));

    const updatedMonthItems: ContentItem[] = [];
    const currentCounts = new Map<string, number>();

    for (const item of existingThisMonth) {
      const target = targetCounts.get(item.date) || 0;
      const current = currentCounts.get(item.date) || 0;

      const isBlankDraft =
        item.status === "Ideia" &&
        !item.imageUrl &&
        (item.title === "Publicação" || item.title === "Nova publicação") &&
        !item.caption &&
        !item.visual;

      if (!isBlankDraft || current < target) {
        updatedMonthItems.push(item);
        currentCounts.set(item.date, current + 1);
      }
    }

    // Completa cada data até a quantidade codificada pelas repetições do dia semanal.
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, monthIdx, day);
      const key = dateKey(d);
      const target = targetCounts.get(key) || 0;
      let current = currentCounts.get(key) || 0;

      while (current < target) {
        const dayOfWeek = d.getDay();
        const defaultTypeForDay = weekdayFormats[dayOfWeek] || "Feed e Story";
        const newItem: ContentItem = {
          id: crypto.randomUUID(),
          date: key,
          title: "Publicação",
          type: defaultTypeForDay,
          status: "Ideia",
          channel: "Instagram",
          profile: defaultProfile,
          isCollab: false,
          collabProfile: "",
          objective: "",
          head: "",
          subhead: "",
          caption: "",
          visual: "",
          imageUrl: "",
          funnelStage: "Topo",
          internalNotes: "",
        };
        updatedMonthItems.push(newItem);
        current++;
      }
    }

    updatedMonthItems.sort((a, b) => a.date.localeCompare(b.date));
    const allItems = [...otherMonthItems, ...updatedMonthItems];

    setItems(allItems);
    setPostingDays(newDays);

    if (!selectedId || !allItems.some((it) => it.id === selectedId)) {
      if (updatedMonthItems.length > 0) {
        setSelectedId(updatedMonthItems[0].id);
      }
    }

    const updatedCal = {
      ...calendar,
      posting_days: newDays,
      weekday_formats: weekdayFormats,
    };
    setCalendar(updatedCal);
    await saveChanges(allItems, updatedCal, newDays, weekdayFormats);
  };

  /** Atualiza o formato padrão de um dia da semana e aplica aos rascunhos em branco desse dia. */
  const handleUpdateWeekdayFormat = async (dayNum: number, newFormat: ContentType) => {
    if (!calendar) return;
    const updatedFormats: Record<number, ContentType> = {
      ...weekdayFormats,
      [dayNum]: newFormat,
    };
    setWeekdayFormats(updatedFormats);

    // Atualiza também rascunhos em branco do mês atual que caem nesse dia da semana
    const currentMonthPrefix = monthKey(month);
    const updatedItems = items.map((it) => {
      if (it.date.startsWith(currentMonthPrefix)) {
        try {
          const parts = it.date.split("-");
          const itemDayOfWeek = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)).getDay();
          const isBlankDraft =
            it.status === "Ideia" &&
            !it.imageUrl &&
            (it.title === "Publicação" || it.title === "Nova publicação") &&
            !it.caption &&
            !it.visual;
          if (itemDayOfWeek === dayNum && isBlankDraft) {
            return { ...it, type: newFormat };
          }
        } catch {}
      }
      return it;
    });

    setItems(updatedItems);
    const updatedCal = {
      ...calendar,
      weekday_formats: updatedFormats,
    };
    setCalendar(updatedCal);
    await saveChanges(updatedItems, updatedCal, postingDays, updatedFormats);
  };

  /** Reúne marca, perfis principais e colaboradores usados no calendário, sem duplicação. */
  const availableProfiles = useMemo(() => {
    const set = new Set<string>();
    if (calendar?.brand) {
      set.add(`@${calendar.brand.toLowerCase().replace(/\s+/g, "")}`);
    }
    items.forEach((it) => {
      if (it.profile && it.profile.trim()) set.add(it.profile.trim());
      if (it.collabProfile && it.collabProfile.trim()) set.add(it.collabProfile.trim());
    });
    return Array.from(set);
  }, [calendar?.brand, items]);

  /** Substitui um item pela mesma identidade e persiste imediatamente a coleção resultante. */
  const updateItem = (item: ContentItem) => {
    const updated = items.map((entry) => (entry.id === item.id ? item : entry));
    setItems(updated);
    saveChanges(updated);
  };

  /**
   * Cria um rascunho na data indicada, aplica o perfil padrão da marca, seleciona
   * o novo item e persiste a lista atualizada.
   */
  const createOn = (date = dateKey(new Date(month.getFullYear(), month.getMonth(), 1))) => {
    const defaultProfile = calendar?.brand ? `@${calendar.brand.toLowerCase().replace(/\s+/g, "")}` : "";
    let defaultType: ContentType = "Feed e Story";
    try {
      const parts = date.split("-");
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      defaultType = weekdayFormats[d.getDay()] || "Feed e Story";
    } catch {}

    const newItem: ContentItem = {
      id: crypto.randomUUID(),
      date,
      title: "Nova publicação",
      type: defaultType,
      status: "Ideia",
      channel: "Instagram",
      profile: defaultProfile,
      isCollab: false,
      collabProfile: "",
      objective: "",
      head: "",
      subhead: "",
      caption: "",
      visual: "",
      imageUrl: "",
      funnelStage: "Topo",
      internalNotes: "",
    };
    const updated = [...items, newItem];
    setItems(updated);
    setSelectedId(newItem.id);
    saveChanges(updated);
  };

  /** Exige confirmação, remove a publicação, limpa a seleção e salva a coleção. */
  const removeItem = (id: string) => {
    if (!window.confirm("Excluir esta publicação?")) return;
    const updated = items.filter((item) => item.id !== id);
    setItems(updated);
    setSelectedId(null);
    saveChanges(updated);
  };

  /** Remove publicações e cadência somente do mês visível; outros meses permanecem. */
  const handleClearMonth = () => {
    const currentPrefix = monthKey(month);
    const remainingItems = items.filter((it) => !it.date.startsWith(currentPrefix));
    setItems(remainingItems);
    setSelectedId(null);
    setPostingDays([]);
    if (calendar) {
      const updatedCal = { ...calendar, posting_days: [] };
      setCalendar(updatedCal);
      saveChanges(remainingItems, updatedCal, []);
    }
  };

  // UI: evita montar as três colunas com dados parciais durante a troca de calendário.
  if (loading || !calendar) {
    return (
      <div className="studioLoading">
        <p>Carregando calendário do banco de dados local...</p>
      </div>
    );
  }

  // UI: no modo interno, a apresentação substitui integralmente a área de edição.
  if (presenting) {
    return (
      <Presentation
        calendar={calendar}
        month={month}
        items={monthItems}
        onClose={() => setPresenting(false)}
      />
    );
  }

  return (
    <main
      className="appShell"
      style={{ "--accent": calendar.accent || "#ef5d3d" } as React.CSSProperties}
    >
      {/* UI: barra superior com retorno, identidade do cliente e competência aberta. */}
      <header className="appHeader">
        <div className="brandArea">
          <button className="backHomeBtn" onClick={onBack} title="Voltar ao início">
            <ArrowLeft size={16} />
            <span>Início</span>
          </button>
          {calendar.client_logo_url ? (
            <div className="logoMark" style={{ background: 'transparent', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={calendar.client_logo_url} alt={calendar.brand} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
          ) : (
            <div className="logoMark">
              {calendar.brand ? calendar.brand.slice(0, 2).toUpperCase() : "CP"}
            </div>
          )}
          <div className="brandCopy">
            <strong>{calendar.brand}</strong>
            <span>{calendar.title}</span>
          </div>
        </div>

        {/* UI: navegação mensal */}
        <div className="headerContext">
          <div className="postNavigation">
            <button
              onClick={() => handleMonthChange(shiftMonth(month, -1))}
              title="Mês anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <span>{monthLabel(month)}</span>
            <button
              onClick={() => handleMonthChange(shiftMonth(month, 1))}
              title="Próximo mês"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* UI: ferramentas do cabeçalho com notificações e modo apresentação */}
        <div className="headerTools">
          <div className="notificationWrapper" ref={notificationRef}>
            <button
              type="button"
              className={`notificationBellBtn ${notifications.length > 0 ? "hasAlerts" : ""}`}
              onClick={() => setShowNotifications(!showNotifications)}
              title={notifications.length > 0 ? `${notifications.length} notificações de alerta` : "Notificações"}
            >
              <Bell size={16} />
              {notifications.length > 0 && (
                <span className="notificationBadge">{notifications.length}</span>
              )}
            </button>

            {showNotifications && (
              <div className="notificationDropdown">
                <div className="notificationDropdownHeader">
                  <strong>Notificações</strong>
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      className="notificationClearBtn"
                      onClick={() => setNotifications([])}
                    >
                      Limpar todas
                    </button>
                  )}
                </div>

                <div className="notificationDropdownList">
                  {notifications.length === 0 ? (
                    <div className="notificationEmpty">
                      <p>Nenhuma notificação ou erro no momento.</p>
                    </div>
                  ) : (
                    notifications.map((item) => (
                      <div key={item.id} className="notificationItem">
                        <AlertCircle size={15} className="notificationErrorIcon" />
                        <div className="notificationItemText">
                          <span>{item.message}</span>
                          <small>
                            {item.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </small>
                        </div>
                        <button
                          type="button"
                          className="notificationDismissBtn"
                          onClick={() => removeNotification(item.id)}
                          title="Descartar"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            className="presentButton"
            onClick={() => {
              if (onOpenPresentation) {
                onOpenPresentation();
              } else {
                setPresenting(true);
              }
            }}
            title="Apresentação em tela cheia com artes reais"
          >
            <MonitorPlay size={14} />
            <span>Apresentação</span>
          </button>
        </div>
      </header>

      {/* UI: grade de trabalho compartilhada pelas três representações do mesmo post. */}
      <div className="appBody">
        <div className="plannerShell">
          {/* UI esquerda: calendário, seleção diária e cadência semanal. */}
          <Calendar
            month={month}
            items={monthItems}
            selectedId={selectedId}
            postingDays={postingDays}
            weekdayFormats={weekdayFormats}
            onMonthChange={handleMonthChange}
            onSelect={(item) => setSelectedId(item.id)}
            onCreate={createOn}
            onUpdatePostingDays={handleUpdatePostingDays}
            onUpdateWeekdayFormat={handleUpdateWeekdayFormat}
            onClearMonth={handleClearMonth}
          />

          {/* UI central: formulário do post selecionado e upload persistente de mídia. */}
          <section className="editorPane">
            {selected ? (
              <Editor
                item={selected}
                onChange={updateItem}
                onDelete={removeItem}
                availableProfiles={availableProfiles}
                brand={calendar?.brand || ""}
              />
            ) : (
              <div className="emptyEditor">
                <CalendarDays size={48} />
                <h2>Selecione uma publicação</h2>
                <p>Escolha um card no calendário ou crie um novo para iniciar.</p>
                <button className="primaryButton" onClick={() => createOn()}>
                  <Plus size={16} /> Criar publicação
                </button>
              </div>
            )}
          </section>

          {/* UI direita: simulação do feed atualizada pelo mesmo objeto editado ao centro. */}
          <aside className="previewPane">
            {selected ? (
              <Preview
                item={selected}
                brand={calendar.brand}
                onChange={updateItem}
              />
            ) : (
              <div className="emptyPreview">Prévia da publicação selecionada</div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
