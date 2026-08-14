import React from "react";
import { Info } from "lucide-react";
import { Checkbox } from "../../components/ui/Checkbox/Checkbox";
import { Input } from "../../components/ui/Input/Input";
import { Surface } from "../../components/ui/Surface/Surface";
import { Textarea } from "../../components/ui/Textarea/Textarea";
import { ClientData } from "../../types";
import styles from "./BasicsTab.module.css";

type BasicsTabProps = { selectedClient: ClientData; setClient: React.Dispatch<React.SetStateAction<ClientData | null>> };

export function BasicsTab({ selectedClient, setClient }: BasicsTabProps) {
  const update = (patch: Partial<ClientData>) => setClient({ ...selectedClient, ...patch });
  return <div className={styles.root}>
    <div className={styles.fields}>
      <Input label="Nome da Marca" value={selectedClient.name} onChange={e => update({ name: e.target.value })} />
      <Input label="WhatsApp Group ID" value={selectedClient.whatsappGroupId || ""} onChange={e => update({ whatsappGroupId: e.target.value })} />
      <Input label="Segmento" value={selectedClient.segment || ""} onChange={e => update({ segment: e.target.value })} placeholder="Ex.: Tecnologia, Saúde, Educação" />
      <Input label="Frequência de postagem" value={selectedClient.postFrequency || ""} onChange={e => update({ postFrequency: e.target.value })} placeholder="Ex.: 3x por semana" />
      <Textarea label="Tom de voz" value={selectedClient.voiceTone || ""} onChange={e => update({ voiceTone: e.target.value })} placeholder="Amigável, institucional, técnico..." rows={3} />
      <Textarea label="Público-alvo" value={selectedClient.targetAudience || ""} onChange={e => update({ targetAudience: e.target.value })} rows={3} />
      <Textarea label="Pilares de conteúdo" value={selectedClient.contentColumns || ""} onChange={e => update({ contentColumns: e.target.value })} rows={3} />
      <Textarea label="Redes e canais" value={selectedClient.networks || ""} onChange={e => update({ networks: e.target.value })} rows={3} />
      <Textarea label="Observações da marca" value={selectedClient.brandNotes || ""} onChange={e => update({ brandNotes: e.target.value })} rows={3} />
      <Textarea label="Informações visuais básicas" value={selectedClient.visualInfo || ""} onChange={e => update({ visualInfo: e.target.value })} rows={3} />
    </div>
    <Surface level="subtle" className={styles.policy}>
      <Info aria-hidden="true" />
      <div className={styles.policyCopy}><h4>Política de aprovação</h4><p>Defina se o cliente precisa ver as imagens prontas para aprovar o planejamento ou se apenas os textos são suficientes.</p></div>
      <Checkbox label="Exigir pré-calendário" checked={selectedClient.hasPreCalendar} onChange={e => update({ hasPreCalendar: e.target.checked })} />
    </Surface>
  </div>;
}
