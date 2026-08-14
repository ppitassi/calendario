import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ClientData } from "../../types";
import { api } from "../../lib/api";
import { LayoutEditToggle } from "../../components/LayoutEditToggle";
import { ThemeToggle } from "../../components/ThemeToggle";
import { PdfExportButton } from "../../components/PdfExportButton";
import { Button } from "../../components/ui/Button/Button";
import { IconButton } from "../../components/ui/IconButton/IconButton";
import styles from "./ViewerHeader.module.css";

type ViewerHeaderProps = {
  isExport: boolean;
  userRole: string;
  client: ClientData;
  currentDate: Date;
  onExit: () => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  canSend: boolean;
  sent: boolean;
  setSent: (sent: boolean) => void;
  user: any;
  token?: string;
  isDark: boolean;
};

export function ViewerHeader({
  isExport,
  userRole,
  client,
  currentDate,
  onExit,
  onPrevMonth,
  onNextMonth,
  canSend,
  sent,
  setSent,
  user,
  token,
  isDark,
}: ViewerHeaderProps) {
  if (isExport) {
    return (
      <div className={`${styles.exportHeader} print-header`}>
        <div className={styles.clientIdentity}>
          <div className={styles.clientAvatar}>
            {client.name.substring(0, 2).toUpperCase()}
          </div>
          <div className={styles.clientText}>
            <h1>
              {client.name}
            </h1>
            <span>
              Apresentação Estratégica de Conteúdo
            </span>
          </div>
        </div>
        <div>
          <span className={styles.monthLabel}>
            {format(currentDate, "MMMM yyyy", { locale: ptBR })}
          </span>
        </div>
      </div>
    );
  }

  if (userRole) {
    return (
      <div className={styles.appHeader}>
        <div className={styles.identity}>
          <IconButton
            type="button"
            label="Voltar ao dashboard"
            aria-label="Voltar ao Dashboard"
            onClick={onExit}
            variant="glass"
          >
            <ArrowLeft />
          </IconButton>
          <div className={styles.appTitle}>
            <h1>
              {client.name}
            </h1>
            <span>
              Apresentação do Calendário de Posts
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
          <span>
            {format(currentDate, "MMMM yyyy", { locale: ptBR })}
          </span>
          <IconButton
            type="button"
            label="Próximo mês"
            onClick={onNextMonth}
            size="small"
          >
            <ChevronRight />
          </IconButton>
        </div>

        <div className={styles.actions}>
          <Button
            type="button"
            onClick={() => {
              try {
                const opened = window.open(
                  api.getPresentationExportUrl(client.id, currentDate),
                  "_blank",
                );
                if (!opened)
                  alert(
                    "Pop-up bloqueado. Permita pop-ups para visualizar o PDF.",
                  );
              } catch (e: any) {
                alert(
                  `Erro ao abrir a versão estática: ${e.message || "URL inválida."}`,
                );
              }
            }}
            variant="secondary"
          >
            Visualizar PDF
          </Button>
          <PdfExportButton
            onExport={() => api.downloadPresentationPdf(client.id, currentDate)}
          />
          {canSend && (
            <Button
              type="button"
              onClick={async () => {
                try {
                  const tokenObj = await api.createApprovalToken(
                    client.id,
                    currentDate,
                  );
                  await navigator.clipboard.writeText(
                    `${window.location.origin}/review/${tokenObj.id}`,
                  );
                  setSent(true);
                  setTimeout(() => setSent(false), 2000);
                } catch (e) {
                  console.error(e);
                }
              }}
              variant="primary"
            >
              {sent ? "Link Copiado!" : "Compartilhar"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <header className={styles.publicHeader}>
      <div className={styles.agencyIdentity}>
        <IconButton
          type="button"
          label="Voltar para edição"
          onClick={onExit}
          title="Voltar para Edição"
        >
          <ArrowLeft />
        </IconButton>

        <div className={styles.divider} />

        <div className={styles.agencyBrand}>
          <div className={styles.logoBox}>
            <AnimatePresence mode="wait">
              {isDark
                ? (user?.agencyLogoDark || user?.agencyLogo) && (
                    <motion.img
                      key="logo-dark"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      src={user.agencyLogoDark || user.agencyLogo}
                      className={styles.logo}
                      alt="Agency Logo Dark"
                    />
                  )
                : (user?.agencyLogo || user?.agencyLogoDark) && (
                    <motion.img
                      key="logo-light"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      src={user.agencyLogo || user.agencyLogoDark}
                      className={styles.logo}
                      alt="Agency Logo"
                    />
                  )}
            </AnimatePresence>
            {!user?.agencyLogo && !user?.agencyLogoDark && (
              <div className={styles.logoFallback}>
                <span>
                  {user?.agencyName?.substring(0, 2).toUpperCase() || "3F"}
                </span>
              </div>
            )}
          </div>
          <div className={styles.agencyText}>
            <span className={styles.agencyName}>
              {user?.agencyName || "Third Floor"}
            </span>
            <span className={styles.agencyLabel}>
              Agência
            </span>
          </div>
          <div className={styles.divider} />
          <span className={styles.slogan}>
            {user?.agencySlogan || "Apresentação Estratégica"}
          </span>
        </div>
      </div>

      <div className={styles.publicActions}>
        {!isExport && token && (
          <div className={styles.pdfActions}>
            <Button
              type="button"
              onClick={() =>
                window.open(api.getReviewExportUrl(token), "_blank")
              }
              size="small"
              variant="secondary"
            >
              Visualizar PDF
            </Button>
            <PdfExportButton
              compact
              onExport={() => api.downloadReviewPdf(token)}
            />
          </div>
        )}
        <LayoutEditToggle />
        <ThemeToggle />
      </div>
    </header>
  );
}
