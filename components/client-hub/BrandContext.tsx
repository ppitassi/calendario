"use client";
import { useEffect, useState } from "react";
import type { HubDocument } from "@/lib/client-hub-types";
import { HubContent, ReportView } from "./HubContent";
import styles from "./Hub.module.css";
/** Consulta o mesmo manual usado no calendário, inclusive para demandas avulsas. */
export function BrandContext({ clientId, reportId }: { clientId: string; reportId?: string }) {
  const [document, setDocument] = useState<HubDocument | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/clients/${encodeURIComponent(clientId)}/hub`, { signal: controller.signal })
      .then(async res => { if (!res.ok) throw new Error("Não foi possível carregar o manual."); setDocument((await res.json()).document); })
      .catch(err => { if (err.name !== "AbortError") setError(err.message); });
    return () => controller.abort();
  }, [clientId]);
  const report = document?.reports.find(item => item.id === reportId);
  return <div className={styles.workContext}>{reportId && <section className={`${styles.root} ${styles.embedded}`} aria-label="Relatório vinculado ao follow-up">
    {report ? <ReportView report={report} /> : <p>{document ? "O relatório vinculado foi removido." : "Carregando relatório…"}</p>}
  </section>}<details className={`${styles.root} ${styles.embedded}`}><summary>Consultar manual da marca</summary>
    {document ? <HubContent document={document} section="brand" /> : <p role={error ? "alert" : "status"}>{error || "Carregando manual…"}</p>}
  </details></div>;
}
