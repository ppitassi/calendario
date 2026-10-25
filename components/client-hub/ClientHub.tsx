"use client";
import { useEffect, useState } from "react";
import { ExternalLink, Save, Link as LinkIcon, Printer } from "lucide-react";
import type { Client, SafeUser } from "@/lib/types";
import type { HubPayload, HubDocument } from "@/lib/client-hub-types";
import { HubContent } from "./HubContent";
import { OnboardingEditor, BrandEditor, DeliveriesEditor } from "./HubEditors";
import { CreateDemandDrawer } from "../tasks/CreateDemandDrawer";
import type { Report } from "@/lib/client-hub-types";
import styles from "./Hub.module.css";

/** Ficha central conectada ao cadastro, calendário e compartilhamento do cliente. */
export function ClientHub({ client, currentUser, onDirtyChange, onApplied, initialSection = "onboarding", calendarId, month }: {
  client: Pick<Client, "id" | "name" | "segment">; currentUser: SafeUser;
  onDirtyChange?: (dirty: boolean) => void; onApplied?: () => void | Promise<void>;
  initialSection?: string; calendarId?: string; month?: string;
}) {
  const [followUp, setFollowUp] = useState<Report | null>(null);
  const [team, setTeam] = useState<{ id: string; name: string; role: string }[]>([]);
  useEffect(() => { fetch("/api/tasks").then(r => r.json()).then(d => setTeam(d.teamMembers || [])).catch(() => {}); }, []);
  const [payload, setPayload] = useState<HubPayload | null>(null);
  const [section, setSection] = useState(initialSection);
  const [preview, setPreview] = useState(initialSection === "brand");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const canEdit = currentUser.role !== "designer";
  const endpoint = `/api/clients/${encodeURIComponent(client.id)}/hub`;
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);

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
      if ((body as { action?: string }).action === "apply_briefing") await onApplied?.();
    } catch (err) { setError(err instanceof Error ? err.message : "Falha de conexão."); }
    finally { setBusy(false); }
  }
  async function copyLink(path: string) {
    try { await navigator.clipboard.writeText(`${window.location.origin}${path}`); setNotice("Link copiado."); }
    catch { setError("Não foi possível copiar o link. Abra a página e copie o endereço."); }
  }
  const sharing = (action: string) => {
    if (dirty) { setError("Salve as alterações antes de alterar o compartilhamento."); return; }
    void mutate("POST", { action, revision: payload?.revision }, action === "apply_briefing" ? "Briefing aplicado ao cadastro e aos rascunhos elegíveis." : "Compartilhamento atualizado.");
  };
  if (!payload) return <div className={styles.root}><p role={error ? "alert" : "status"}>{error || "Carregando ficha do cliente…"}</p></div>;
  const doc = payload.document;
  if (followUp) return <CreateDemandDrawer isOpen embedded initialType="follow_up" followUpReportId={followUp.id} clients={[client]} preselectedClientId={client.id} teamMembers={team}
    initialTitle={`Follow-up: ${followUp.title}`} initialDescription={`${followUp.start} a ${followUp.end}\n${followUp.summary}\nPróximos passos: ${followUp.nextSteps}`}
    onClose={() => setFollowUp(null)} onSuccess={() => setNotice("Revisão criada na fila de tarefas do cliente.")} />;
  return <div className={`${styles.root} ${styles.embedded}`}><div className={styles.container}>
    <h1 className={styles.printHeading}>{client.name}</h1>
    <nav className={styles.tabs} aria-label="Seções da ficha do cliente">
      {Object.entries({ onboarding: "Kickoff & onboarding", brand: "Manual da marca", deliveries: "Entregas & follow-up", overview: "Links do cliente" }).map(([key, title]) => <button className={styles.tab} type="button" key={key} aria-current={section === key ? "page" : undefined} onClick={() => setSection(key)}>{title}</button>)}
    </nav>
    {error && <div role="alert" className={styles.error}>{error} <button type="button" className={styles.button} onClick={() => { if (window.confirm("Recarregar e descartar alterações locais?")) window.location.reload(); }}>Recarregar</button></div>}
    {notice && <div role="status" className={styles.notice}>{notice}</div>}
    {section === "overview" ? <div className={styles.stack}>
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
        {section === "onboarding" && canEdit && <section className={styles.subcard} style={{ marginBottom: 16 }}>
          <p>Após revisar e salvar, aplique segmento, público, tom de voz e objetivos ao cadastro. Os próximos calendários usarão esses dados. Rascunhos com valores herdados serão atualizados; calendários compartilhados ou personalizados serão preservados.</p>
          <button className={styles.button} type="button" disabled={dirty || busy || !payload.briefingToken} onClick={() => sharing("apply_briefing")}>Aplicar briefing ao planejamento</button>
        </section>}
        {preview || !canEdit ? <HubContent document={doc} section={section} />
          : section === "onboarding" ? <OnboardingEditor document={doc} onChange={change} />
          : section === "deliveries" ? <DeliveriesEditor document={doc} onChange={change} workDeliveries={payload.workDeliveries} calendarId={calendarId} month={month}
              onSchedule={report => { if (dirty) { setError("Salve o relatório antes de agendar a revisão."); return; } setFollowUp(report); }} />
          : <BrandEditor document={doc} onChange={change} />}
      </fieldset>
      {canEdit && <div className={styles.toolbar}><span className={styles.muted}>{dirty ? "Há alterações para salvar." : "Conteúdo salvo."}</span><button disabled={busy || !dirty} type="submit" className={styles.primary}><Save size={15} />{busy ? "Salvando…" : "Salvar ficha"}</button></div>}
    </form>}
  </div></div>;
}
