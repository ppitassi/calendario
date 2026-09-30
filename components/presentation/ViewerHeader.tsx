/** Cabeçalho fixo da apresentação, com competência, impressão e compartilhamento. */

import { useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, X, Printer, Share2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { CalendarRecord } from "@/lib/types";
import { Button } from "../ui/Button/Button";
import { IconButton } from "../ui/IconButton/IconButton";
import styles from "./ViewerHeader.module.css";

/** Delega navegação ao chamador e executa apenas ações próprias do navegador. */
export function ViewerHeader({
  calendar,
  currentDate,
  onExit,
  onPrevMonth,
  onNextMonth,
}: {
  calendar: CalendarRecord;
  currentDate: Date;
  onExit: () => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const [copied, setCopied] = useState(false);

  /** Copia a URL atual e mantém por dois segundos o feedback visual de sucesso. */
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("Não foi possível copiar o link. Copie a URL diretamente da barra do navegador.");
    }
  };

  return (
    <header className={styles.appHeader}>
      <div className={styles.identity}>
        <IconButton
          type="button"
          label="Voltar ao Editor"
          onClick={onExit}
          variant="glass"
        >
          <ArrowLeft />
        </IconButton>
        <div className={styles.avatar}>
          {calendar.brand.slice(0, 2).toUpperCase()}
        </div>
        <div className={styles.appTitle}>
          <h1>{calendar.brand}</h1>
          <span>Apresentação do Calendário de Posts</span>
        </div>
      </div>

      <div className={styles.monthNav}>
        <IconButton
          type="button"
          label="Mês anterior"
          onClick={onPrevMonth}
          size="small"
        >
          <ChevronLeft />
        </IconButton>
        <span>{format(currentDate, "MMMM yyyy", { locale: ptBR })}</span>
        <IconButton
          type="button"
          label="Próximo mês"
          onClick={onNextMonth}
          size="small"
        >
          <ChevronRight />
        </IconButton>
      </div>

      {/* UI: impressão/PDF, cópia do endereço e saída da apresentação. */}
      <div className={styles.actions}>
        <Button
          type="button"
          onClick={() => window.print()}
          variant="secondary"
          icon={<Printer size={14} />}
        >
          Imprimir / PDF
        </Button>

        <Button
          type="button"
          onClick={handleShare}
          variant="primary"
          icon={<Share2 size={14} />}
        >
          {copied ? "Link Copiado!" : "Compartilhar"}
        </Button>

        <IconButton
          type="button"
          label="Fechar apresentação"
          onClick={onExit}
          variant="ghost"
        >
          <X />
        </IconButton>
      </div>
    </header>
  );
}
