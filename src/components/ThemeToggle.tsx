import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { IconButton } from "./ui/IconButton/IconButton";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return <div className="flex gap-1" role="group" aria-label="Selecionar tema">
    <IconButton label="Modo claro" aria-pressed={theme === "light"} variant={theme === "light" ? "primary" : "glass"} onClick={() => setTheme("light")}><Sun /></IconButton>
    <IconButton label="Modo escuro" aria-pressed={theme === "dark"} variant={theme === "dark" ? "primary" : "glass"} onClick={() => setTheme("dark")}><Moon /></IconButton>
  </div>;
}
