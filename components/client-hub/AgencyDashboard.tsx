"use client";
import { useEffect, useState } from "react";
import type { SafeUser, Client } from "@/lib/types";
import type { TeamMember } from "@/lib/task-types";
import { WorkUnitDrawer } from "@/components/tasks/WorkUnitDrawer";
import { civilToday, shortDate } from "./HubFields";
import styles from "./Hub.module.css";
type Dashboard = {
  today: string; month: string; stats: { open: number; overdue: number; dueToday: number; waiting: number };
  open: { id: string; title: string; clientName: string; due: string; dueTime: string; assignee: string; workUnitId: string; category: string; effort: number; serviceMode: string }[];
  ranking: { id: string; name: string; completed: number; openPoints: number }[];
  followUps: { id: string; title: string; due: string; clientId: string; clientName: string; owner: string }[];
};
/** Painel operacional com ranking derivado de eventos, sem usar updated_at como data de entrega. */
export function AgencyDashboard({ currentUser, clients, team, onCreateTask, onOpenClient }: {
  currentUser: SafeUser; clients: Client[]; team: TeamMember[]; onCreateTask: () => void; onOpenClient: (client: Client) => void;
}) {
  const [month, setMonth] = useState(civilToday().slice(0, 7));
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/agency-dashboard?month=${month}`, { signal: controller.signal }).then(async response => {
      const value = await response.json(); if (!response.ok) throw new Error(value.error);
      setData(value); setError("");
    }).catch(err => { if (err.name !== "AbortError") setError(err.message); });
    return () => controller.abort();
  }, [month, revision]);
  return <div className={styles.root}><div className={styles.container}>
    <header className={styles.header}><div><div className={styles.eyebrow}>Operação da agência</div><h1>Olá, {currentUser.name.split(" ")[0]}.</h1><p className={styles.muted}>Prazos, pessoas e próximos passos em uma visão.</p></div>
      {currentUser.role !== "designer" && <button className={styles.primary} onClick={onCreateTask}>+ Nova tarefa</button>}</header>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {!data ? <p role="status">Carregando painel…</p> : <>
      <section className={styles.hero}><div className={styles.eyebrow}>Hoje · {shortDate(data.today)}</div><h2>{data.stats.dueToday ? `${data.stats.dueToday} tarefa(s) com prazo para hoje.` : "Nenhuma tarefa com prazo para hoje."}</h2>
        <p>{currentUser.role === "designer" ? "Seu trabalho e seus follow-ups." : "Visão consolidada dos calendários e das demandas da equipe."}</p>
      </section>
      <div className={styles.metrics}>{[["Tarefas abertas", data.stats.open], ["Prazos vencidos", data.stats.overdue], ["Em espera / aprovação", data.stats.waiting], ["Follow-ups agendados", data.followUps.length]].map(([label, value]) => <div className={styles.metric} key={label}><span className={styles.muted}>{label}</span><strong>{value}</strong></div>)}</div>
      <div className={styles.grid}>
        <section className={styles.card}><h2>Próximas tarefas</h2>{data.open.slice(0, 20).map(task => <article className={styles.row} key={task.id}>
          <div><h3>{task.title}</h3><span className={styles.muted}>{task.clientName} · {task.assignee}</span><p className={styles.muted}>{task.category} · {task.effort} ponto(s) · {task.serviceMode} · {shortDate(task.due)} {task.dueTime}</p></div>
          {task.workUnitId && <button className={styles.button} onClick={() => setSelected(task.workUnitId)}>Abrir tarefa</button>}
        </article>)}{!data.open.length && <div className={styles.empty}>Nenhuma tarefa aberta.</div>}
          {data.open.length > 20 && <p className={styles.muted}>Mostrando os 20 próximos prazos. A lista completa está em Tarefas.</p>}
        </section>
        <section className={styles.card}><h2>Follow-ups do cliente</h2>{data.followUps.map(item => <article className={styles.row} key={`${item.clientId}-${item.id}`}>
          <div><h3>{item.title}</h3><p className={styles.muted}>{item.clientName} · {item.owner} · até {shortDate(item.due)}</p></div>
          <button className={styles.button} onClick={() => { const client = clients.find(c => c.id === item.clientId); if (client) onOpenClient(client); }}>Abrir ficha</button>
        </article>)}{!data.followUps.length && <div className={styles.empty}>Nenhum follow-up agendado.</div>}</section>
      </div>
      <section className={styles.card} style={{ marginTop: 20 }}><div className={styles.row}><div><div className={styles.eyebrow}>Ranking de entregas</div><h2>Trabalho concluído pela equipe</h2></div>
        <div className={styles.actions}><label className={styles.field}>Mês<input aria-label="Mês do ranking" type="month" value={month === "all" ? "" : month} onChange={e => { if (e.target.value) setMonth(e.target.value); }} /></label><button className={styles.button} aria-pressed={month === "all"} onClick={() => setMonth(month === "all" ? civilToday().slice(0, 7) : "all")}>{month === "all" ? "Este mês" : "Todo o período"}</button></div>
      </div>
        {data.ranking.map((person, index) => <div className={styles.row} key={person.id}><div style={{ flex: 1 }}>
          <strong>{data.ranking.findIndex(row => row.completed === person.completed) + 1}º · {person.name}</strong>
          <div className={styles.progress}><span style={{ width: `${person.completed / Math.max(1, data.ranking[0]?.completed || 0) * 100}%` }} /></div>
          <span className={styles.muted}>{person.openPoints} ponto(s) de esforço em aberto</span>
        </div><strong className={styles.number}>{person.completed} entregas</strong></div>)}
        <p className={styles.muted}>Contagem de tarefas e publicações concluídas, atribuídas ao responsável atual. O filtro mensal usa a última conclusão registrada no histórico; registros antigos sem evento aparecem apenas em “Todo o período”. Pontos em aberto incluem todos os prazos e não representam uma porcentagem de capacidade.</p>
      </section>
    </>}
    {selected && <WorkUnitDrawer workUnitId={selected} teamMembers={team} onClose={() => { setSelected(null); setRevision(value => value + 1); }} onStatusUpdated={() => setRevision(value => value + 1)} />}
  </div></div>;
}
