"use client";
import { useEffect, useState } from "react";
import type { Client, SafeUser } from "@/lib/types";
import type { ExternalCalendarEvent } from "@/lib/reference-events";
import { civilToday, Field, SelectField } from "./HubFields";
import styles from "./Hub.module.css";
/** Modelos editoriais revisáveis; não dependem de IA nem afirmam fatos sobre datas não verificadas. */
export function ContentOpportunities({ clients, currentUser }: { clients: Client[]; currentUser: SafeUser }) {
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [month, setMonth] = useState(civilToday().slice(0, 7));
  const [events, setEvents] = useState<ExternalCalendarEvent[]>([]);
  const [topic, setTopic] = useState("");
  const [date, setDate] = useState(civilToday());
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => { if (!clientId && clients[0]) setClientId(clients[0].id); }, [clientId, clients]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    fetch(`/api/calendar-reference-events?month=${month}&country=BR`, { signal: controller.signal }).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error); setEvents(data.events || []);
    }).catch(err => { if (err.name !== "AbortError") { setEvents([]); setError("Não foi possível consultar as datas. Você pode cadastrar um tema manualmente."); } }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [month]);
  const client = clients.find(c => c.id === clientId);
  const ideas = [
    { format: "Reel", type: "reel", stage: "Atração", title: `3 perguntas sobre ${topic || "o tema"}`, hook: `Qual é a principal dúvida de ${client?.audience || "seu público"}?`, structure: "Abra com uma pergunta, mostre três orientações práticas e finalize com um próximo passo.", cta: "Salve para consultar depois." },
    { format: "Carrossel", type: "feed_story", stage: "Consideração", title: `Guia prático: ${topic || "o tema"}`, hook: "O que você precisa saber antes de decidir?", structure: "Apresente o contexto, organize quatro pontos e inclua fontes para afirmações factuais.", cta: "Envie sua dúvida para nossa equipe." },
    { format: "Stories", type: "feed_story", stage: "Conversão", title: `Conversa com o público: ${topic || "o tema"}`, hook: "Uma enquete para entender a necessidade do cliente.", structure: "Enquete, resposta educativa e convite para atendimento com uma oferta válida.", cta: "Responda para conversar com a equipe." },
    { format: "Live", type: "reel", stage: "Consideração", title: `Conversa com especialista: ${topic || "o tema"}`, hook: "Uma questão relevante para o segmento.", structure: "Apresentação, perguntas frequentes, demonstração e resumo. Defina o convidado antes de divulgar.", cta: "Envie sua pergunta e participe." },
  ];
  async function create() {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/demands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        clientId, title: `Campanha: ${topic}`, priority: "normal", dueDate: date,
        description: `Tema: ${topic}\nSegmento: ${client?.segment || "A definir"}\nRevisar adequação, oferta e fontes antes de produzir.`,
        deliveries: selected.map(index => ({ type: ideas[index].type, title: ideas[index].title, quantity: 1, description: `Formato: ${ideas[index].format}\nFunil: ${ideas[index].stage}\nGancho: ${ideas[index].hook}\nEstrutura: ${ideas[index].structure}\nChamada: ${ideas[index].cta}` })),
      }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setNotice(`Campanha criada com ${selected.length} tarefa(s). Ela já está na fila de Tarefas e nas demandas do cliente.`); setSelected([]);
    } catch (err) { setError(err instanceof Error ? err.message : "Falha ao criar campanha."); } finally { setBusy(false); }
  }
  return <div className={styles.root}><div className={styles.container}>
    <header className={styles.header}><div><div className={styles.eyebrow}>Planejamento editorial</div><h1>Datas que viram boas conversas.</h1><p className={styles.muted}>Escolha uma referência, revise as ideias e transforme a seleção em tarefas de produção.</p></div></header>
    <div className={styles.grid}><SelectField label="Empresa" value={clientId} onChange={setClientId}><option value="">Selecione um cliente</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</SelectField><Field label="Mês de referência" type="month" value={month} onChange={value => { if (value) setMonth(value); }} /></div>
    {error && <p className={styles.error} role="alert">{error}</p>}{notice && <p className={styles.notice} role="status">{notice}</p>}
    <section className={styles.card} style={{ marginTop: 22 }}><h2>Datas de referência</h2>
      {loading ? <p role="status">Consultando calendário…</p> : events.length ? events.map(event => <div className={styles.row} key={event.externalKey}>
        <div><h3>{event.title}</h3><span className={styles.muted}>{event.startsOn} · {event.sourceLabel || "Calendário de referência"}</span></div>
        <button className={styles.button} onClick={() => { setTopic(event.title); setDate(event.startsOn); setSelected([]); }}>Sugerir conteúdo</button>
      </div>) : <p className={styles.muted}>Nenhuma data encontrada para este mês. Use o tema abaixo para planejar campanhas próprias ou meses temáticos.</p>}
    </section>
    <section className={styles.card} style={{ marginTop: 22 }}><div className={styles.grid}><Field label="Tema / data comemorativa" value={topic} onChange={value => { setTopic(value); setSelected([]); }} /><Field label="Prazo da campanha" type="date" value={date} onChange={setDate} /></div>
      <div className={styles.subcard}><div className={styles.eyebrow}>Direção estratégica · {client?.segment || "segmento a definir"}</div>
        <p>Conecte o tema a uma necessidade real do público. Em temas de conscientização, priorize informação responsável. Revise a pertinência comercial antes de incluir uma oferta.</p>
        <p className={styles.muted}>Público: {client?.audience || "A definir no cadastro do cliente"} · Tom: {client?.tone || "A definir"}</p>
      </div>
    </section>
    {topic && <><div className={styles.grid} style={{ marginTop: 22 }}>{ideas.map((idea, index) => <article className={styles.card} key={idea.format}>
      <span className={styles.badge}>{idea.format} · {idea.stage}</span><h3 style={{ marginTop: 16 }}>{idea.title}</h3>
      <p className={styles.text}><strong>Gancho</strong>{"\n"}{idea.hook}{"\n\n"}<strong>Estrutura</strong>{"\n"}{idea.structure}{"\n\n"}<strong>Chamada</strong>{"\n"}{idea.cta}</p>
      <label className={styles.check}><input type="checkbox" checked={selected.includes(index)} onChange={e => setSelected(previous => e.target.checked ? [...previous, index] : previous.filter(i => i !== index))} />Usar em campanha</label>
    </article>)}</div>
      <div className={styles.toolbar}><p className={styles.muted}>Modelos editoriais para revisão · {selected.length} selecionado(s)</p><button className={styles.primary} disabled={busy || !clientId || !date || !selected.length || currentUser.role === "designer"} onClick={create}>{busy ? "Criando…" : "Criar campanha na fila"}</button></div></>}
  </div></div>;
}
