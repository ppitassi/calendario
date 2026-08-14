import type { ReactNode } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";
import { ViewAsDropdown } from "../../components/ViewAsDropdown";
import { IconButton } from "../../components/ui/IconButton/IconButton";
import styles from "./PlannerHeaderBar.module.css";

type Props = { selectedDateStr: string | null; setSelectedDateStr: (value: string | null) => void; navigateToPlannedPost: (date?: string) => void; previousPlannedPost: any; nextPlannedPost: any; saveState: string; user: any; simulatedEditorRole: string | null; setSimulatedEditorRole: (role: string | null) => void; editorRoleOptions: Array<{ id: string; label: string }>; workflow?: ReactNode };

export function PlannerHeaderBar({ selectedDateStr, setSelectedDateStr, navigateToPlannedPost, previousPlannedPost, nextPlannedPost, saveState, user, simulatedEditorRole, setSimulatedEditorRole, editorRoleOptions, workflow }: Props) {
  return <div className={cn("planner-context-header", styles.bar)}>
    {selectedDateStr ? <IconButton onClick={() => setSelectedDateStr(null)} label="Voltar para visão geral" size="small" variant="glass"><ArrowLeft /></IconButton> : null}
    <div className={styles.workflow}>{workflow}</div>
    <nav className={styles.navigation} aria-label="Navegação entre postagens planejadas"><IconButton onClick={() => void navigateToPlannedPost(previousPlannedPost?.date)} disabled={!previousPlannedPost || saveState === "saving"} label="Ir para o post anterior" size="small"><ChevronLeft /></IconButton><span>Posts</span><IconButton onClick={() => void navigateToPlannedPost(nextPlannedPost?.date)} disabled={!nextPlannedPost || saveState === "saving"} label="Ir para o próximo post" size="small"><ChevronRight /></IconButton></nav>
    <ViewAsDropdown userRole={user?.role} value={simulatedEditorRole} onChange={setSimulatedEditorRole} options={[{ id: "", label: "Minha visão" }, ...editorRoleOptions]} />
    <span role="status" aria-live="polite" className={cn(styles.status, saveState === "error" && styles.statusError)}>{saveState === "saving" ? "Salvando…" : saveState === "saved" ? "Salvo" : saveState === "error" ? "Falha ao salvar" : ""}</span>
  </div>;
}
