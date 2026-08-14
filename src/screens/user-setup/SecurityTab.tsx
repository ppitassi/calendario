import { Lock } from "lucide-react";
import { api } from "../../lib/api";
import { Input } from "../../components/ui/Input/Input";
import { Button } from "../../components/ui/Button/Button";
import styles from "./SecurityTab.module.css";

type SecurityTabProps = {
  currentPassword: string;
  setCurrentPassword: (val: string) => void;
  newPassword: string;
  setNewPassword: (val: string) => void;
  confirmPassword: string;
  setConfirmPassword: (val: string) => void;
  passwordStatus: { type: "success" | "error" | null; message: string };
  setPasswordStatus: (status: { type: "success" | "error" | null; message: string }) => void;
};

export function SecurityTab({ currentPassword, setCurrentPassword, newPassword, setNewPassword, confirmPassword, setConfirmPassword, passwordStatus, setPasswordStatus }: SecurityTabProps) {
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordStatus({ type: "error", message: "Por favor, preencha todos os campos." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: "error", message: "As novas senhas não coincidem." });
      return;
    }
    try {
      setPasswordStatus({ type: null, message: "" });
      await api.changePassword(currentPassword, newPassword);
      setPasswordStatus({ type: "success", message: "Senha alterada com sucesso!" });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (error: any) {
      setPasswordStatus({ type: "error", message: error.response?.data?.error || "Erro ao alterar a senha. Verifique se a senha atual está correta." });
    }
  };

  return (
    <div className={styles.root}>
      <div><h3 className={styles.title}>Segurança da Conta</h3><p className={styles.subtitle}>Gerencie suas credenciais de acesso</p></div>
      <form onSubmit={submit} className={styles.form}>
        {passwordStatus.message && <div className={`${styles.status} ${passwordStatus.type === "success" ? styles.success : styles.error}`} role="status">{passwordStatus.message}</div>}
        <Input label="Senha atual" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="w-full" placeholder="••••••••" />
        <Input label="Nova senha" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="w-full" placeholder="••••••••" />
        <Input label="Confirmar nova senha" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full" placeholder="••••••••" />
        <Button type="submit" className="w-full" variant="primary" icon={<Lock />}>Alterar senha</Button>
      </form>
    </div>
  );
}
