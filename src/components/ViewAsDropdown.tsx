import { ROLE_LABELS, UserRole } from "../types";
import { LiquidDropdown, LiquidDropdownOption } from "./LiquidDropdown";

const DEFAULT_OPTIONS: LiquidDropdownOption[] = [{ id: "", label: "Minha visão" }, ...Object.entries(ROLE_LABELS).map(([id, label]) => ({ id, label: id === "admin" ? "Administrador" : label }))];
export function ViewAsDropdown({ userRole, value, onChange, options = DEFAULT_OPTIONS }: { userRole?: UserRole | string; value: string | null; onChange: (role: string | null) => void; options?: LiquidDropdownOption[] }) {
  if (userRole !== "admin") return null;
  const normalized = options.some(option => option.id === "") ? options : [{ id: "", label: "Minha visão" }, ...options];
  return <LiquidDropdown label="Visualizar como" value={value || ""} options={normalized} onChange={next => onChange(next || null)} compact />;
}
