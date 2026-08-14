import { CheckCircle2 } from "lucide-react";
import { Button } from "../../components/ui/Button/Button";
import styles from "./ReviewFloatingBar.module.css";

type ReviewFloatingBarProps = { viewerRole: string; approved: boolean; onApprove: () => void; onSendWhatsApp: () => void; onOpenModal: (action: "approve_with_caveats" | "request_changes") => void; onReturnToEditor: () => void };

export function ReviewFloatingBar({ viewerRole, approved, onApprove, onSendWhatsApp, onOpenModal, onReturnToEditor }: ReviewFloatingBarProps) {
  if (approved) return null;
  const client = viewerRole === "cliente";
  const service = viewerRole === "atendimento";
  const management = viewerRole === "admin" || viewerRole === "gerente";
  const title = client ? "Revisão do Cliente" : service ? "Painel de Atendimento" : management ? "Painel de Gestão" : "Modo de Apresentação";
  const description = client ? "Aprove ou solicite ajustes para este mês." : service ? "Dispare o link do calendário no grupo do WhatsApp do cliente." : management ? "Finalize o calendário aprovando-o definitivamente." : "Visualizando calendário de posts na perspectiva do cliente.";
  const tone = service ? "success" : management ? "management" : client ? "primary" : "neutral";
  return (
    <div className={styles.bar}>
      <div className={styles.summary}><div className={styles.icon} data-tone={tone}><CheckCircle2 /></div><div><h4>{title}</h4><p>{description}</p></div></div>
      {client ? <div className={styles.clientActions}><Button className="w-full md:w-auto" variant="ghost" onClick={() => onOpenModal("request_changes")}>Reprovar com ressalvas</Button><div className={styles.approvalActions}><Button className="w-full md:w-auto" variant="primary" onClick={onApprove}>Aprovar calendário</Button><Button className="w-full md:w-auto" variant="ghost" onClick={() => onOpenModal("approve_with_caveats")}>Aprovar com ressalvas</Button></div></div> : service ? <Button className="w-full md:w-auto" variant="primary" onClick={onSendWhatsApp}>Enviar no grupo do WhatsApp</Button> : management ? <Button className="w-full md:w-auto" variant="primary" onClick={onApprove}>Liberar para publicação</Button> : <Button className="w-full md:w-auto" variant="secondary" onClick={onReturnToEditor}>Voltar para edição</Button>}
    </div>
  );
}
