"use client";
import { useEffect, useState } from "react";
import type { HubPayload } from "@/lib/client-hub-types";
import { HubContent } from "./HubContent";
import styles from "./Hub.module.css";
/** Portal de leitura com navegação única entre onboarding, entregas, marca e calendário. */
export function PublicHub({ token }: { token: string }) {
  const [data, setData] = useState<Pick<HubPayload, "client" | "document" | "calendars"> | null>(null);
  const [section, setSection] = useState("onboarding");
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/client-portal/${encodeURIComponent(token)}`, { signal: controller.signal }).then(async response => {
      const value = await response.json();
      if (!response.ok) throw new Error(value.error);
      setData(value);
    }).catch(err => { if (err.name !== "AbortError") setError(err.message); });
    return () => controller.abort();
  }, [token]);
  return <main className={styles.root} style={{ minHeight: "100vh" }}><div className={styles.container}>
    {error ? <div className={styles.error} role="alert">{error}</div> : !data ? <p role="status">Carregando seu portal…</p> : <>
      <header className={styles.header}><div><div className={styles.eyebrow}>Seu espaço de marca e resultados</div><h1>{data.client.name}</h1><p className={styles.muted}>Planejamento, entregas e identidade. Sempre por perto.</p></div>
        <button className={styles.button} onClick={() => window.print()}>Imprimir / salvar PDF</button></header>
      <nav className={styles.tabs} aria-label="Portal do cliente">{Object.entries({ onboarding: "Kickoff & onboarding", deliveries: "Entregas & follow-up", brand: "Manual da marca", calendars: "Calendário" }).map(([key, label]) => <button className={styles.tab} key={key} aria-current={section === key ? "page" : undefined} onClick={() => setSection(key)}>{label}</button>)}</nav>
      {section === "calendars" ? <section className={styles.card}><h2>Seus calendários</h2>{data.calendars.length ? data.calendars.map(cal => <div className={styles.row} key={cal.share_token}><span>{cal.title} · {cal.month}</span><a className={styles.button} href={`/portal/${cal.share_token}`}>Ver calendário e aprovar ↗</a></div>) : <div className={styles.empty}>Nenhum calendário compartilhado ainda.</div>}</section> : <HubContent document={data.document} section={section} />}
    </>}
  </div></main>;
}
