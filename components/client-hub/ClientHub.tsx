"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, Save, Link as LinkIcon, Printer } from "lucide-react";
import type { Client, SafeUser } from "@/lib/types";
import type { HubPayload, HubDocument } from "@/lib/client-hub-types";
import { HubContent } from "./HubContent";
import { OnboardingEditor, BrandEditor, DeliveriesEditor, RelationshipEditor } from "./HubEditors";
import styles from "./Hub.module.css";

/** Ficha central conectada ao cadastro, calendário e compartilhamento do cliente. */
export function ClientHub({ client, currentUser, team, onBack, onOpenPlanner, onDirtyChange }: {
  client: Client; currentUser: SafeUser; team: { id: string; name: string }[];
  onBack: () => void; onOpenPlanner: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [payload, setPayload] = useState<HubPayload | null>(null);
  const [section, setSection] = useState("overview");
  const [preview, setPreview] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const canEdit = currentUser.role !== "designer";
  const endpoint = `/api/clients/${encodeURIComponent(client.id)}/hub`;
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);

  /** Cancelamento evita misturar respostas quando o usuário troca rapidamente de cliente. */
  useEffect(() => {
    const controller = new AbortController();
    fetch(endpoint, { signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setPayload(data);
    }).catch(err => { if (err.name !== "AbortError") setError(err.message); });
    return () => controller.abort();
  }, [endpoint]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const change = (document: HubDocument) => { if (payload) setPayload({ ...payload, document }); setDirty(true); setNotice(""); };
  /** Ações só confirmam sucesso depois da resposta persistida do servidor. */
  async function mutate(method: string, body: unknown, message: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar.");
      setPayload(data); setDirty(false); setNotice(message);
    } catch (err) { setError(err instanceof Error ? err.message : "Falha de conexão."); }
    finally { setBusy(false); }
  }
  const navigateAway = (next: () => void) => { if (!dirty || window.confirm("Existem alterações não salvas. Deseja sair e descartá-las?")) next(); };
  async function copyLink(path: string) {
    try { await navigator.clipboard.writeText(`${window.location.origin}${path}`); setNotice("Link copiado."); }
    catch { setError("Não foi possível copiar o link. Abra a página e copie o endereço."); }
  }
  const sharing = (action: string) => {
    if (dirty) { setError("Salve as alterações antes de alterar o compartilhamento."); return; }
    void mutate("POST", { action }, "Compartilhamento atualizado.");
  };
  if (!payload) return <div className={styles.root}><button className={styles.button} onClick={onBack}>Voltar</button><p role={error ? "alert" : "status"}>{error || "Carregando ficha do cliente…"}</p></div>;
  const doc = payload.document;
  return <div className={styles.root}><div className={styles.container}>
    <button type="button" className={styles.button} onClick={() => navigateAway(onBack)}><ArrowLeft size={15} />Todos os clientes</button>
    <header className={styles.header}>
      <div><div className={styles.eyebrow}>Relacionamento & experiência do cliente</div><h1>{client.name}</h1><p className={styles.muted}>{client.segment || "Cliente"} · {payload.submittedAt ? "Briefing recebido" : "Onboarding em preparação"}</p></div>
      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={() => navigateAway(onOpenPlanner)}>Abrir calendário</button>
        {payload.portalEnabled && payload.portalToken && <a href={`/cliente/${payload.portalToken}`} target="_blank" rel="noreferrer" className={styles.button}><ExternalLink size={15} />Ver portal</a>}
      </div>
    </header>
    <nav className={styles.tabs} aria-label="Seções da ficha do cliente">
      {Object.entries({ overview: "Visão geral", onboarding: "Kickoff & onboarding", deliveries: "Entregas & follow-up", brand: "Manual da marca", relationship: "Relacionamento" }).map(([key, title]) => <button className={styles.tab} type="button" key={key} aria-current={section === key ? "page" : undefined} onClick={() => setSection(key)}>{title}</button>)}
    </nav>
    {error && <div role="alert" className={styles.error}>{error} <button type="button" className={styles.button} onClick={() => { if (window.confirm("Recarregar e descartar alterações locais?")) window.location.reload(); }}>Recarregar</button></div>}
    {notice && <div role="status" className={styles.notice}>{notice}</div>}
    {section === "overview" ? <div className={styles.stack}>
      <section className={styles.hero}><div className={styles.eyebrow}>Tudo em um só lugar</div><h2>Do primeiro briefing à próxima entrega.</h2>
        <p>Organize o início do projeto, apresente resultados e mantenha a identidade da marca acessível.</p>
        <div className={styles.actions}><button className={styles.button} type="button" onClick={() => setSection("onboarding")}>Preparar onboarding</button><button className={styles.button} type="button" onClick={() => setSection("relationship")}>Acompanhar relacionamento</button></div>
      </section>
      <div className={styles.metrics}>{[
        ["Entregas registradas", doc.deliveries.length], ["Relatórios de resultado", doc.reports.length],
        ["Follow-ups em aberto", doc.followUps.filter(f => f.status === "scheduled").length], ["Arquivos da marca", doc.brand.assets.length],
      ].map(([label, value]) => <div key={label} className={styles.metric}><span className={styles.muted}>{label}</span><strong>{value}</strong></div>)}</div>
      {canEdit && <div className={styles.grid}>
        <section className={styles.card}><LinkIcon size={22} /><h2 style={{ marginTop: 14 }}>Formulário por link</h2>
          <p className={styles.muted}>O cliente ou o executivo preenche o briefing. O envio gera o documento de onboarding para revisão da equipe.</p>
          {payload.briefingToken ? <><span className={styles.badge}>{payload.briefingOpen ? "Aberto para preenchimento" : "Recebido / encerrado"}</span>
            <div className={styles.actions} style={{ marginTop: 16 }}><button className={styles.button} type="button" onClick={() => copyLink(`/briefing/${payload.briefingToken}`)}>Copiar link do briefing</button>
              <a className={styles.button} href={`/briefing/${payload.briefingToken}`} target="_blank" rel="noreferrer">Preencher com o cliente ↗</a>
              <button disabled={busy} className={styles.button} type="button" onClick={() => sharing(payload.briefingOpen ? "close" : "reopen")}>{payload.briefingOpen ? "Encerrar formulário" : "Reabrir com novo link"}</button></div></>
            : <button disabled={busy} className={styles.primary} type="button" onClick={() => sharing("initialize")}>Criar link de briefing</button>}
        </section>
        <section className={styles.card}><ExternalLink size={22} /><h2 style={{ marginTop: 14 }}>Portal do cliente</h2>
          <p className={styles.muted}>Somente conteúdos marcados para exibição são publicados. Quem tiver o link poderá consultá-los.</p>
          <span className={styles.badge}>{payload.portalEnabled ? "Portal disponível" : "Portal desativado"}</span>
          <div className={styles.actions} style={{ marginTop: 16 }}>
            <button disabled={busy} type="button" className={styles.primary} onClick={() => sharing(payload.portalEnabled ? "disable" : "enable")}>{payload.portalEnabled ? "Desativar portal" : "Ativar portal"}</button>
            {payload.portalToken && <button className={styles.button} type="button" onClick={() => copyLink(`/cliente/${payload.portalToken}`)}>Copiar link do portal</button>}
            {payload.portalToken && <button disabled={busy} className={styles.button} type="button" onClick={() => { if (window.confirm("Substituir os links do portal e do briefing? Os links anteriores deixarão de funcionar.")) sharing("rotate"); }}>Substituir links</button>}
          </div>
        </section>
      </div>}
      <section className={styles.card}><h2>Calendários compartilhados</h2>{payload.calendars.length ? payload.calendars.map(cal => <div className={styles.row} key={cal.share_token}><span>{cal.title} · {cal.month}</span><a className={styles.button} href={`/portal/${cal.share_token}`} target="_blank" rel="noreferrer">Abrir apresentação ↗</a></div>) : <p className={styles.muted}>Compartilhe um calendário para disponibilizar sua apresentação aqui.</p>}</section>
    </div> : <form onSubmit={event => { event.preventDefault(); void mutate("PUT", { revision: payload.revision, document: doc }, "Ficha salva."); }}>
      <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        {section !== "relationship" && <div className={`${styles.actions} ${styles.noPrint}`} style={{ marginBottom: 18 }}>
          {canEdit && <button className={styles.button} type="button" onClick={() => setPreview(!preview)}>{preview ? "Editar conteúdo" : "Prévia do documento"}</button>}
          {(preview || !canEdit) && <button className={styles.button} type="button" onClick={() => window.print()}><Printer size={15} />Imprimir / salvar PDF</button>}
        </div>}
        {section === "relationship" ? canEdit
          ? <RelationshipEditor document={doc} onChange={change} team={team} userName={currentUser.name} />
          : <section className={styles.card}><h2>Relacionamento</h2>{doc.followUps.map(f => <div className={styles.row} key={f.id}><div><h3>{f.title}</h3><p className={styles.text}>{f.objective}</p><span className={styles.muted}>{f.due} · {f.status === "completed" ? "Concluído" : "Agendado"}</span></div></div>)}</section>
          : preview || !canEdit ? <HubContent document={doc} section={section} />
          : section === "onboarding" ? <OnboardingEditor document={doc} onChange={change} />
          : section === "deliveries" ? <DeliveriesEditor document={doc} onChange={change} />
          : <BrandEditor document={doc} onChange={change} />}
      </fieldset>
      {canEdit && <div className={styles.toolbar}><span className={styles.muted}>{dirty ? "Há alterações para salvar." : "Conteúdo salvo."}</span><button disabled={busy || !dirty} type="submit" className={styles.primary}><Save size={15} />{busy ? "Salvando…" : "Salvar ficha"}</button></div>}
    </form>}
  </div></div>;
}
