"use client";
import { useState } from "react";
import { onboardingFields, estimatedImpacts, type HubDocument, type Report, type FollowUp } from "@/lib/client-hub-types";
import { Field, SelectField, PublishCheck, civilToday, shortDate } from "./HubFields";
import styles from "./Hub.module.css";
type EditorProps = { document: HubDocument; onChange: (document: HubDocument) => void };
const id = () => crypto.randomUUID();

/** O formulário interno usa o mesmo mapeamento de campos do link preenchido pelo cliente. */
export function OnboardingEditor({ document, onChange }: EditorProps) {
  return <section className={styles.card}><h2>Kickoff e onboarding</h2>
    <p className={styles.muted}>O briefing recebido preenche estes campos automaticamente. Complete as definições da equipe antes de publicar.</p>
    <div className={styles.grid}>{Object.entries(onboardingFields).map(([key, label]) => <Field key={key} label={label}
      value={document.onboarding[key as keyof typeof onboardingFields]}
      multiline={!["contact", "email", "phone", "company", "segment"].includes(key)}
      type={key === "email" ? "email" : "text"}
      onChange={value => onChange({ ...document, onboarding: { ...document.onboarding, [key]: value } })} />)}</div>
    <p className={styles.muted}>E-mail, WhatsApp e acessos ficam disponíveis apenas para a equipe.</p>
    <PublishCheck checked={document.onboardingPublished} onChange={value => onChange({ ...document, onboardingPublished: value })} />
  </section>;
}
/** Edição de um relatório com período e origem obrigatórios para cada medição. */
function ReportEditor({ report, onChange, onRemove }: { report: Report; onChange: (report: Report) => void; onRemove: () => void }) {
  const patch = (value: Partial<Report>) => onChange({ ...report, ...value });
  return <section className={styles.card}>
    <div className={styles.row}><h2>Relatório de follow-up</h2><button className={styles.danger} type="button" onClick={onRemove}>Remover relatório</button></div>
    <div className={styles.grid}>
      <Field label="Título do relatório" required value={report.title} onChange={title => patch({ title })} />
      <div className={styles.grid}><Field label="Início do período" type="date" required value={report.start} onChange={start => patch({ start })} />
        <Field label="Fim do período" type="date" required value={report.end} onChange={end => patch({ end })} /></div>
      <Field label="Resultados e resumo da entrega" multiline value={report.summary} onChange={summary => patch({ summary })} />
      <Field label="Aprendizados" multiline value={report.learnings} onChange={learnings => patch({ learnings })} />
    </div>
    <Field label="Próximos passos, responsáveis e prazos" multiline value={report.nextSteps} onChange={nextSteps => patch({ nextSteps })} />
    <h3 style={{ marginTop: 24 }}>Analytics de redes sociais</h3>
    <p className={styles.muted}>Registre os dados exportados das plataformas. A fonte identifica o relatório ou ferramenta de origem.</p>
    {report.social.map((metric, index) => <div className={styles.subcard} key={metric.id}>
      <div className={styles.grid}>
        <Field label="Rede / perfil" required value={metric.channel} onChange={channel => patch({ social: report.social.map((r, i) => i === index ? { ...r, channel } : r) })} />
        <Field label="Métrica e unidade" required value={metric.metric} onChange={value => patch({ social: report.social.map((r, i) => i === index ? { ...r, metric: value } : r) })} />
        <Field label="Valor medido" type="number" min={0} max={1e12} step="any" required value={metric.value} onChange={value => patch({ social: report.social.map((r, i) => i === index ? { ...r, value: Number(value) } : r) })} />
        <Field label="Fonte dos dados" required value={metric.source} onChange={source => patch({ social: report.social.map((r, i) => i === index ? { ...r, source } : r) })} />
      </div><button className={styles.button} type="button" onClick={() => patch({ social: report.social.filter(r => r.id !== metric.id) })}>Remover métrica</button>
    </div>)}
    <button className={styles.button} type="button" onClick={() => patch({ social: [...report.social, { id: id(), channel: "Instagram", metric: "Alcance (contas)", value: 0, source: "" }] })}>+ Métrica social</button>
    <h3 style={{ marginTop: 24 }}>Busdoors e outdoors</h3>
    <p className={styles.muted}>Estimativa = fluxo diário por unidade × dias de veiculação × unidades × fator de exposição (0 a 1). Informe a base do fator nas premissas.</p>
    {report.outdoor.map((metric, index) => {
      const set = (value: Partial<typeof metric>) => patch({ outdoor: report.outdoor.map((r, i) => i === index ? { ...r, ...value } : r) });
      return <div className={styles.subcard} key={metric.id}><div className={styles.grid}>
        <SelectField label="Mídia" value={metric.medium} onChange={medium => set({ medium: medium as "Busdoor" | "Outdoor" })}><option>Busdoor</option><option>Outdoor</option></SelectField>
        <Field label="Local / rota" required value={metric.location} onChange={location => set({ location })} />
        <Field label="Fluxo diário por unidade" required type="number" min={0} max={1e9} value={metric.dailyFlow} onChange={value => set({ dailyFlow: Number(value) })} />
        <Field label="Dias de veiculação" required type="number" min={1} max={3660} value={metric.days} onChange={value => set({ days: Number(value) })} />
        <Field label="Quantidade de unidades" required type="number" min={1} max={100000} value={metric.units} onChange={value => set({ units: Number(value) })} />
        <Field label="Fator de exposição (0 a 1)" required type="number" min={0} max={1} step="0.01" value={metric.factor} onChange={value => set({ factor: Number(value) })} />
        <Field label="Fonte do fluxo" required value={metric.source} onChange={source => set({ source })} />
        <Field label="Premissas e limitações" required multiline value={metric.assumptions} onChange={assumptions => set({ assumptions })} />
      </div><p><strong>{estimatedImpacts(metric).toLocaleString("pt-BR")}</strong> oportunidades estimadas, com repetições.</p>
        <button className={styles.button} type="button" onClick={() => patch({ outdoor: report.outdoor.filter(r => r.id !== metric.id) })}>Remover mídia</button>
      </div>;
    })}
    <button className={styles.button} type="button" onClick={() => patch({ outdoor: [...report.outdoor, { id: id(), medium: "Outdoor", location: "", dailyFlow: 0, days: 1, units: 1, factor: 1, source: "", assumptions: "" }] })}>+ Mídia exterior</button>
    <PublishCheck checked={report.published} onChange={published => patch({ published })} />
  </section>;
}
/** Entregas e resultados compartilham a mesma seção do portal. */
export function DeliveriesEditor({ document, onChange }: EditorProps) {
  return <div className={styles.stack}>
    <section className={styles.card}><h2>Materiais entregues</h2>
      {document.deliveries.map(item => <div className={styles.subcard} key={item.id}>
        <div className={styles.grid}>{(["title", "date", "url", "description"] as const).map(key => <Field key={key}
          label={{ title: "Título da entrega", date: "Data da entrega", url: "Link do material", description: "Descrição da entrega" }[key]}
          value={item[key]} type={key === "date" ? "date" : key === "url" ? "url" : "text"} multiline={key === "description"} required={key === "title" || key === "date"}
          onChange={value => onChange({ ...document, deliveries: document.deliveries.map(r => r.id === item.id ? { ...r, [key]: value } : r) })} />)}</div>
        <PublishCheck checked={item.published} onChange={published => onChange({ ...document, deliveries: document.deliveries.map(r => r.id === item.id ? { ...r, published } : r) })} />
        <button className={styles.button} type="button" onClick={() => onChange({ ...document, deliveries: document.deliveries.filter(r => r.id !== item.id) })}>Remover entrega</button>
      </div>)}
      <button className={styles.button} type="button" onClick={() => onChange({ ...document, deliveries: [...document.deliveries, { id: id(), title: "", date: civilToday(), url: "", description: "", published: false }] })}>+ Entrega</button>
    </section>
    {document.reports.map(report => <ReportEditor key={report.id} report={report}
      onChange={value => onChange({ ...document, reports: document.reports.map(r => r.id === report.id ? value : r) })}
      onRemove={() => onChange({ ...document, reports: document.reports.filter(r => r.id !== report.id) })} />)}
    <button className={styles.button} type="button" onClick={() => onChange({ ...document, reports: [...document.reports, { id: id(), title: "", start: civilToday(), end: civilToday(), summary: "", learnings: "", nextSteps: "", published: false, social: [], outdoor: [] }] })}>+ Relatório de follow-up</button>
  </div>;
}
/** Manual padronizado com campos reutilizados na página digital publicada. */
export function BrandEditor({ document, onChange }: EditorProps) {
  const brand = document.brand;
  const patch = (value: Partial<typeof brand>) => onChange({ ...document, brand: { ...brand, ...value } });
  return <section className={styles.card}><h2>Manual digital da marca</h2>
    <div className={styles.grid}>{(["description", "colors", "typography", "rules", "voice"] as const).map(key => <Field key={key}
      label={{ description: "Sobre a marca", colors: "Cores (nome, HEX, RGB / CMYK)", typography: "Tipografia e hierarquia", rules: "Regras, usos corretos e incorretos", voice: "Tom de voz e exemplos" }[key]}
      multiline value={brand[key]} onChange={value => patch({ [key]: value })} />)}</div>
    <h3 style={{ marginTop: 24 }}>Logos, aplicações e downloads</h3>
    {brand.assets.map(asset => {
      const set = (value: Partial<typeof asset>) => patch({ assets: brand.assets.map(r => r.id === asset.id ? { ...r, ...value } : r) });
      return <div className={styles.subcard} key={asset.id}><div className={styles.grid}>
        <Field label="Nome do arquivo" required value={asset.title} onChange={title => set({ title })} />
        <SelectField label="Tipo do arquivo" value={asset.kind} onChange={kind => set({ kind: kind as typeof asset.kind })}><option>Logo</option><option>Aplicação</option><option>Arquivo</option></SelectField>
        <Field label="Link para abrir / baixar" required type="url" value={asset.url} onChange={url => set({ url })} />
        <Field label="Orientação de uso" multiline value={asset.description} onChange={description => set({ description })} />
      </div><button className={styles.button} type="button" onClick={() => patch({ assets: brand.assets.filter(r => r.id !== asset.id) })}>Remover arquivo</button></div>;
    })}
    <button className={styles.button} type="button" onClick={() => patch({ assets: [...brand.assets, { id: id(), kind: "Logo", title: "", url: "", description: "" }] })}>+ Arquivo da marca</button>
    <PublishCheck checked={brand.published} onChange={published => patch({ published })} />
  </section>;
}
/** Follow-ups são internos; contatos externos só são abertos por ação humana. */
export function RelationshipEditor({ document, onChange, team, userName }: EditorProps & { team: { id: string; name: string }[]; userName: string }) {
  const [update, setUpdate] = useState("");
  const [copied, setCopied] = useState("");
  const newFollowUp = (): FollowUp => ({ id: id(), title: "Follow-up estratégico", start: civilToday(), due: civilToday(), owner: team[0]?.id || "", participant: "", objective: "", meetingUrl: "", message: "Olá! Vamos conversar sobre os resultados das últimas entregas e alinhar os próximos passos?", status: "scheduled", outcome: "" });
  return <div className={styles.stack}>
    <section className={styles.card}><h2>Follow-up estratégico</h2><p className={styles.muted}>Defina objetivo, prazo, responsável e registre o resultado de cada conversa.</p>
      {document.followUps.map(item => {
        const set = (value: Partial<FollowUp>) => onChange({ ...document, followUps: document.followUps.map(r => r.id === item.id ? { ...r, ...value } : r) });
        const message = [item.message, item.meetingUrl].filter(Boolean).join("\n\n");
        return <div className={styles.subcard} key={item.id}><div className={styles.grid}>
          <Field label="Título do follow-up" required value={item.title} onChange={title => set({ title })} />
          <SelectField label="Status do follow-up" value={item.status} onChange={status => set({ status: status as FollowUp["status"] })}><option value="scheduled">Agendado</option><option value="completed">Concluído</option></SelectField>
          <Field label="Fazer a partir de" required type="date" value={item.start} onChange={start => set({ start })} />
          <Field label="Fazer até" required type="date" value={item.due} onChange={due => set({ due })} />
          <SelectField label="Quem faz" value={item.owner} onChange={owner => set({ owner })}><option value="">Selecione</option>{team.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</SelectField>
          <SelectField label="Segunda pessoa (opcional)" value={item.participant} onChange={participant => set({ participant })}><option value="">Ninguém</option>{team.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</SelectField>
          <Field label="Objetivo do contato" multiline value={item.objective} onChange={objective => set({ objective })} />
          <Field label="Link de agendamento / reunião" type="url" value={item.meetingUrl} onChange={meetingUrl => set({ meetingUrl })} />
          <Field label="Mensagem para o cliente" multiline value={item.message} onChange={message => set({ message })} />
          <Field label="Resultado e próximos passos da conversa" multiline value={item.outcome} onChange={outcome => set({ outcome })} />
        </div>
          <div className={styles.actions} style={{ marginTop: 14 }}>
            <button type="button" className={styles.button} onClick={async () => { try { await navigator.clipboard.writeText(message); setCopied("Mensagem copiada."); } catch { setCopied("Não foi possível copiar. Selecione o texto da mensagem."); } }}>Copiar mensagem</button>
            {document.onboarding.phone.replace(/\D/g, "").length >= 10 && <a className={styles.button} target="_blank" rel="noreferrer" href={`https://wa.me/${document.onboarding.phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`}>Abrir WhatsApp</a>}
            {document.onboarding.email && <a className={styles.button} href={`mailto:${encodeURIComponent(document.onboarding.email)}?subject=${encodeURIComponent(item.title)}&body=${encodeURIComponent(message)}`}>Preparar e-mail</a>}
            <button type="button" className={styles.danger} onClick={() => onChange({ ...document, followUps: document.followUps.filter(r => r.id !== item.id) })}>Remover follow-up</button>
          </div>
        </div>;
      })}
      <button type="button" className={styles.primary} onClick={() => onChange({ ...document, followUps: [...document.followUps, newFollowUp()] })}>+ Novo follow-up</button>
      {copied && <p role="status">{copied}</p>}
    </section>
    <section className={styles.card}><h2>Atualizações do relacionamento</h2><p className={styles.muted}>Anotações visíveis apenas para a equipe.</p>
      <Field label="O que aconteceu?" value={update} maxLength={500} multiline onChange={setUpdate} />
      <button type="button" className={styles.button} disabled={!update.trim()} onClick={() => { onChange({ ...document, updates: [{ id: id(), date: civilToday(), author: userName, text: update.trim() }, ...document.updates] }); setUpdate(""); }}>Adicionar atualização</button>
      {document.updates.map(item => <article className={styles.row} key={item.id}><div><span className={styles.muted}>{shortDate(item.date)} · {item.author}</span><p className={styles.text}>{item.text}</p></div></article>)}
    </section>
  </div>;
}
