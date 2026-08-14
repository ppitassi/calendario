import React from "react";
import { Save, Calendar } from "lucide-react";
import { Input } from "../../components/ui/Input/Input";
import { Button } from "../../components/ui/Button/Button";
import styles from "./CycleTab.module.css";

type CycleTabProps = {
  cycleData: {
    planning_month: string;
    deadline_pre: string;
    deadline_final: string;
  };
  setCycleData: React.Dispatch<
    React.SetStateAction<{
      planning_month: string;
      deadline_pre: string;
      deadline_final: string;
    }>
  >;
  handleSaveCycle: () => Promise<void>;
  isSaving: boolean;
};

export function CycleTab({
  cycleData,
  setCycleData,
  handleSaveCycle,
  isSaving,
}: CycleTabProps) {
  return (
    <div className={styles.card}>
      <div className={styles.heading}>
        <h3>
          <Calendar /> Ciclo Atual de Produção
        </h3>
        <p>
          Defina o mês vigente e os prazos limite para entregas de pré-pauta e finalização da agência.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Input
            label="Mês de Planejamento Ativo"
            type="month"
            value={cycleData.planning_month}
            onChange={(e) => setCycleData({ ...cycleData, planning_month: e.target.value })}
            className="w-full"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Input
              label="Prazo Pré-Pauta (Textos)"
              type="date"
              value={cycleData.deadline_pre}
              onChange={(e) => setCycleData({ ...cycleData, deadline_pre: e.target.value })}
              className="w-full"
            />
          </div>

          <div>
            <Input
              label="Prazo Final (Artes)"
              type="date"
              value={cycleData.deadline_final}
              onChange={(e) => setCycleData({ ...cycleData, deadline_final: e.target.value })}
              className="w-full"
            />
          </div>
        </div>
      </div>

      <Button
        onClick={handleSaveCycle}
        disabled={isSaving}
        className="w-full"
        variant="primary"
        loading={isSaving}
        icon={<Save />}
      >
        {isSaving ? "Salvando..." : "Salvar Prazos do Ciclo"}
      </Button>
    </div>
  );
}
