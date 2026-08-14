import { Briefcase } from "lucide-react";
import { Button } from "../../components/ui/Button/Button";
import styles from "./PortfolioTab.module.css";

export function PortfolioTab() {
  return (
    <div className={styles.root}>
      <div className={styles.emptyState}>
        <Briefcase className={styles.icon} />
        <h4 className={styles.title}>Seu Portfólio de Criação</h4>
        <p className={styles.description}>
          Em breve: Gerencie seus melhores trabalhos realizados aqui no Content Planner e exiba-os para a agência.
        </p>
        <Button disabled title="Disponível em breve" className="mt-8" variant="ghost">
          Configurar Portfólio — em breve
        </Button>
      </div>
    </div>
  );
}
