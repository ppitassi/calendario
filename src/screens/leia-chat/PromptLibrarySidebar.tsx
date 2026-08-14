import { motion } from "motion/react";
import { BookOpen, X, Lightbulb, PenTool, Calendar, Target, Hash, Zap } from "lucide-react";
import { Button } from "../../components/ui/Button/Button";
import { IconButton } from "../../components/ui/IconButton/IconButton";
import styles from "./PromptLibrarySidebar.module.css";

export const PROMPT_LIBRARY = [
  { label: "💡 Ideias de Posts", text: "Gere 5 ideias de posts criativos e estratégicos para as redes sociais desse cliente, variando os formatos (carrossel, reels, feed).", icon: Lightbulb },
  { label: "✍️ Escrever Legenda", text: "Escreva uma legenda profissional para um post de feed do Instagram. Use copywriting com gancho, corpo informativo e CTA.", icon: PenTool },
  { label: "📅 Plano Semanal", text: "Crie um plano semanal de conteúdo para redes sociais (segunda a sexta) com formato e tema de cada dia.", icon: Calendar },
  { label: "🎯 Estratégia de Funil", text: "Monte uma estratégia de conteúdo completa baseada em funil de vendas (topo, meio e fundo) para este cliente.", icon: Target },
  { label: "#️⃣ Hashtags", text: "Gere 3 grupos de hashtags (alcance, nicho e marca) otimizados para o Instagram deste cliente. Máximo 30 hashtags.", icon: Hash },
  { label: "⚡ Hook de Reels", text: "Crie 5 ganchos iniciais criativos e virais para Reels curtos desse nicho. O gancho deve ser nos primeiros 2 segundos.", icon: Zap },
  { label: "📖 Briefing Criativo", text: "Gere um briefing completo para um post criativo baseado no setor e público-alvo do cliente. Inclua tom de voz, referências visuais e CTA.", icon: BookOpen },
];

type PromptLibrarySidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelectPrompt: (text: string) => void;
};

export function PromptLibrarySidebar({ isOpen, onClose, onSelectPrompt }: PromptLibrarySidebarProps) {
  if (!isOpen) return null;

  return (
    <motion.aside
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 320, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 250 }}
      className={styles.sidebar}
      aria-label="Biblioteca de prompts"
    >
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h3>
            <BookOpen /> Prompts
          </h3>
          <IconButton
            label="Fechar biblioteca de prompts"
            onClick={onClose}
            size="small"
          >
            <X />
          </IconButton>
        </div>
        <p>
          Clique em qualquer prompt para enviar automaticamente à LeIA.
        </p>
      </div>

      <div className={styles.list}>
        {PROMPT_LIBRARY.map((prompt, i) => (
          <Button
            key={i}
            onClick={() => onSelectPrompt(prompt.text)}
            className="w-full"
            variant="glass"
            icon={<prompt.icon />}
          >
            <div className={styles.promptCopy}>
              <strong>{prompt.label}</strong>
              <span>{prompt.text.substring(0, 60)}...</span>
            </div>
          </Button>
        ))}
      </div>
    </motion.aside>
  );
}
