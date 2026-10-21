"use client";
import { useEffect, useState } from "react";
import { emptyHub, onboardingFields } from "@/lib/client-hub-types";
import { Field } from "./HubFields";
import styles from "./Hub.module.css";
/** Formulário externo sem login, com trava de reenvio e confirmação de persistência. */
export function BriefingForm({ token }: { token: string }) {
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState(() => emptyHub().onboarding);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/briefing/${encodeURIComponent(token)}`, { signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setName(data.name); setOpen(data.open);
      setAnswers(value => ({ ...value, company: data.name }));
    }).catch(err => { if (err.name !== "AbortError") setError(err.message); }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [token]);
  async function submit() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/briefing/${encodeURIComponent(token)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSent(true); setOpen(false);
    } catch (err) { setError(err instanceof Error ? err.message : "Falha ao enviar."); }
    finally { setBusy(false); }
  }
  return <main className={styles.root} style={{ minHeight: "100vh" }}><div className={styles.container} style={{ maxWidth: 920 }}>
    <header className={styles.header}><div><div className={styles.eyebrow}>Primeiro passo · briefing</div><h1>Vamos conhecer {name || "sua marca"}.</h1><p className={styles.muted}>Preencha sozinho ou junto com seu executivo. Suas respostas serão usadas no documento de onboarding.</p></div></header>
    {error && <div role="alert" className={styles.error}>{error}</div>}
    {loading ? <p role="status">Carregando formulário…</p> : sent ? <section className={styles.card}><h2>Briefing enviado.</h2><p>Seu onboarding foi preenchido e está disponível para revisão da equipe.</p></section> : !open ? <section className={styles.card}><h2>Formulário encerrado</h2><p>Se precisar complementar as respostas, solicite um novo link à equipe.</p></section> :
      <form onSubmit={event => { event.preventDefault(); void submit(); }}>
        <fieldset disabled={busy} className={styles.card}><legend>Informações do projeto</legend><div className={styles.grid}>{Object.entries(onboardingFields).map(([key, label]) => <Field key={key}
          label={`${label}${["contact", "company", "objectives"].includes(key) ? " *" : ""}`}
          required={["contact", "company", "objectives"].includes(key)} value={answers[key as keyof typeof onboardingFields]}
          multiline={!["contact", "email", "phone", "company", "segment"].includes(key)} type={key === "email" ? "email" : "text"}
          onChange={value => setAnswers(previous => ({ ...previous, [key]: value }))} />)}</div>
          <p className={styles.muted}>Campos com * são obrigatórios. Não informe senhas, códigos de autenticação ou dados de pagamento.</p>
          <button className={styles.primary} type="submit">{busy ? "Enviando…" : "Enviar briefing e gerar onboarding"}</button>
        </fieldset>
      </form>}
  </div></main>;
}
