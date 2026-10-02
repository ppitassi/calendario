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
  clientMode = false,
  onShare,
  isPreCalendar = false,
  onTogglePreCalendar,
}: {
  calendar: CalendarRecord;
  currentDate: Date;
  onExit: () => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  clientMode?: boolean;
  onShare?: () => void;
  isPreCalendar?: boolean;
  onTogglePreCalendar?: (enabled: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [loadingShare, setLoadingShare] = useState(false);

  /** Gera/busca o token único do cliente e copia a URL pública */
  const handleShare = async () => {
    if (onShare) {
      onShare();
      return;
    }
    try {
      setLoadingShare(true);
      const res = await fetch(`/api/calendars/${calendar.id}/share-token`);
      const data = await res.json();
      if (data.token) {
        const url = `${window.location.origin}/portal/${data.token}`;
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      } else {
        alert("Não foi possível gerar o link de compartilhamento.");
      }
    } catch {
      alert("Erro ao conectar com a API para gerar link do cliente.");
    } finally {
      setLoadingShare(false);
    }
  };

  return (
    <header className={styles.appHeader}>
      <div className={styles.identity}>
        {!clientMode && (
          <IconButton
            type="button"
            label="Voltar ao Editor"
            onClick={onExit}
            variant="glass"
          >
            <ArrowLeft />
          </IconButton>
        )}
        <div className={styles.avatar}>
          {calendar.brand.slice(0, 2).toUpperCase()}
        </div>
        <div className={styles.appTitle}>
          <h1>{calendar.brand}</h1>
          <span>
            {clientMode ? "Validação do Planejamento de Posts" : "Apresentação do Calendário de Posts"}
          </span>
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
        {!clientMode && onTogglePreCalendar && (
          <label
            className={`${styles.preCalendarToggle} ${isPreCalendar ? styles.active : ""}`}
            title="Ativar/desativar modo Pré-Calendário (aprovação apenas de copywriting, sem exibição de imagens)"
          >
            <input
              type="checkbox"
              checked={isPreCalendar}
              onChange={(e) => onTogglePreCalendar(e.target.checked)}
            />
            <span>Pré-calendário</span>
          </label>
        )}

        {clientMode && isPreCalendar && (
          <div className={styles.preCalendarClientBadge}>
            <span>📝 Pré-Calendário (Copy)</span>
          </div>
        )}

        <Button
          type="button"
          onClick={() => window.print()}
          variant="secondary"
          icon={<Printer size={14} />}
        >
          Imprimir / PDF
        </Button>

        {!clientMode && (
          <>
            <Button
              type="button"
              onClick={handleShare}
              variant="primary"
              disabled={loadingShare}
              icon={<Share2 size={14} />}
            >
              {loadingShare ? "Gerando..." : copied ? "Link Copiado!" : "Compartilhar"}
            </Button>

            <IconButton
              type="button"
              label="Fechar apresentação"
              onClick={onExit}
              variant="ghost"
            >
              <X />
            </IconButton>
          </>
        )}
      </div>
    </header>
  );
}
