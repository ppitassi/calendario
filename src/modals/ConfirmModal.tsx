import { AlertCircle } from "lucide-react";
import { Button } from "../components/ui/Button/Button";
import { Modal } from "../components/ui/Modal/Modal";

export function ConfirmModal({ isOpen, onClose, onConfirm, title, message }: { isOpen: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string }) {
  return <Modal open={isOpen} onClose={onClose} title={title}><div className="grid gap-6 text-center"><AlertCircle className="mx-auto" aria-hidden="true" /><p>{message}</p><div className="flex gap-4"><Button className="flex-1" variant="secondary" onClick={onClose}>Cancelar</Button><Button className="flex-1" variant="danger" onClick={() => { onConfirm(); onClose(); }}>Excluir tudo</Button></div></div></Modal>;
}
