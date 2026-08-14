import type { FormEvent } from "react";
import { ExternalLink, Settings } from "lucide-react";
import { ClientData } from "../types";
import { Button } from "../components/ui/Button/Button";
import { Input } from "../components/ui/Input/Input";
import { Modal } from "../components/ui/Modal/Modal";
import styles from "./QuickSetupModal.module.css";

interface ClientSetupModalProps { setupClient: ClientData | null; setSetupClient: (client: ClientData | null) => void; handleSaveClientSetup: (event: FormEvent) => Promise<string | null> | void; onOpenAdvanced: (clientId: string) => void }

export function ClientSetupModal({ setupClient, setSetupClient, handleSaveClientSetup, onOpenAdvanced }: ClientSetupModalProps) {
  if (!setupClient) return null;
  return (
    <Modal open onClose={() => setSetupClient(null)} title="Quick Setup" className="w-full max-w-lg">
      <div className={styles.intro}><span className={styles.icon}><Settings /></span><p>Configuração básica do cliente</p></div>
      <form onSubmit={handleSaveClientSetup} className={styles.form}>
        <Input label="Nome da marca" value={setupClient.name} onChange={(event) => setSetupClient({ ...setupClient, name: event.target.value })} placeholder="Ex: Coca-Cola" className="w-full" />
        <Button type="submit" className="w-full" size="large" variant="primary">Salvar e continuar</Button>
        <Button variant="ghost" className="w-full" icon={<ExternalLink />} onClick={async (event) => { const currentId = setupClient.id; const savedId = await handleSaveClientSetup(event); onOpenAdvanced(savedId || currentId); }}>Acessar configurações avançadas</Button>
      </form>
    </Modal>
  );
}
