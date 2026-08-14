import { ExternalLink } from "lucide-react";
import { auth } from "../lib/auth";
import { Button } from "../components/ui/Button/Button";
import { Input } from "../components/ui/Input/Input";
import { Modal } from "../components/ui/Modal/Modal";
import styles from "./QuickSetupModal.module.css";

interface ProfileModalProps { isOpen: boolean; onClose: () => void; displayNameInput: string; setDisplayNameInput: (value: string) => void; handleUpdateProfile: () => void; onOpenAdvanced: () => void }

export function ProfileModal({ isOpen, onClose, displayNameInput, setDisplayNameInput, handleUpdateProfile, onOpenAdvanced }: ProfileModalProps) {
  return (
    <Modal open={isOpen} onClose={onClose} title="Ajuste rápido" className="w-full max-w-md">
      <div className={styles.intro}>
        <span className={styles.avatar}>{auth.currentUser?.photoURL ? <img src={auth.currentUser.photoURL} alt="" /> : displayNameInput.substring(0, 2).toUpperCase()}</span>
        <p>Identidade no Hub</p>
      </div>
      <div className={styles.form}>
        <Input label="Nome de exibição" value={displayNameInput} onChange={(event) => setDisplayNameInput(event.target.value)} placeholder="Seu nome" className="w-full" />
        <Button className="w-full" size="large" variant="primary" onClick={handleUpdateProfile}>Atualizar nome</Button>
        <Button className="w-full" variant="ghost" icon={<ExternalLink />} onClick={() => { onOpenAdvanced(); onClose(); }}>Gerenciar perfil completo</Button>
      </div>
    </Modal>
  );
}
