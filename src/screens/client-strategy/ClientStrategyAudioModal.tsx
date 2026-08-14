import { Button } from "../../components/ui/Button/Button";
import { Input } from "../../components/ui/Input/Input";
import { Modal } from "../../components/ui/Modal/Modal";
import styles from "./ClientStrategyAudioModal.module.css";

type ClientStrategyAudioModalProps = { showAudioSaveModal: boolean; setShowAudioSaveModal: (show: boolean) => void; audioTitle: string; setAudioTitle: (title: string) => void; saveRecordedAudio: () => Promise<void> };

export function ClientStrategyAudioModal({ showAudioSaveModal, setShowAudioSaveModal, audioTitle, setAudioTitle, saveRecordedAudio }: ClientStrategyAudioModalProps) {
  return (
    <Modal open={showAudioSaveModal} onClose={() => setShowAudioSaveModal(false)} title="Salvar gravação de reunião" className="w-full max-w-sm">
      <p className={styles.description}>Dê um nome ou identificação para facilitar a busca interna da agência.</p>
      <Input label="Título do áudio" value={audioTitle} onChange={(event) => setAudioTitle(event.target.value)} className="w-full" placeholder="Ex: Reunião inicial de briefing" />
      <div className={styles.actions}>
        <Button className="flex-1" variant="ghost" onClick={() => setShowAudioSaveModal(false)}>Descartar</Button>
        <Button className="flex-1" variant="primary" onClick={() => void saveRecordedAudio()}>Salvar gravação</Button>
      </div>
    </Modal>
  );
}
