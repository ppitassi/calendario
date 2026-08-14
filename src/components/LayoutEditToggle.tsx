import { PenTool } from "lucide-react";
import { auth, useAuthState } from "../lib/auth";
import { useUICopy } from "../contexts/UICopyContext";
import { Button } from "./ui/Button/Button";

export function LayoutEditToggle() {
  const { isEditMode, setIsEditMode } = useUICopy();
  const [user] = useAuthState(auth);
  const canCustomizeInterface =
    user?.role === "admin" ||
    Boolean(user?.permissions?.canManageBrandSystem);

  if (!canCustomizeInterface) return null;

  return (
    <Button
      onClick={() => setIsEditMode(!isEditMode)}
      variant={isEditMode ? "primary" : "glass"}
      size="small"
      icon={<PenTool />}
      title="Ativar modo de edição da interface"
      aria-pressed={isEditMode}
    >
      {isEditMode ? "Editando interface" : "Personalizar interface"}
    </Button>
  );
}
