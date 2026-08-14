import { ChevronDown } from "lucide-react";
import { Button } from "./ui/Button/Button";
import { Dropdown } from "./ui/Dropdown/Dropdown";

export type LiquidDropdownOption = { id: string; label: string };
export function LiquidDropdown({ label, value, options, onChange, compact = false }: { label: string; value: string; options: LiquidDropdownOption[]; onChange: (value: string) => void; compact?: boolean }) {
  const selected = options.find(option => option.id === value) || options[0];
  return <Dropdown label={label} value={value} items={options} onSelect={onChange} trigger={<Button variant="glass" size={compact ? "small" : "medium"} icon={<ChevronDown aria-hidden="true" />}><span className="hidden sm:inline">{label}: </span>{selected?.label}</Button>} />;
}
