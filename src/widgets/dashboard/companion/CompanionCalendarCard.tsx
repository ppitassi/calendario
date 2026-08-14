import { Calendar, Sparkles } from "lucide-react";
import { format } from "date-fns";
import styles from "./CompanionCalendarCard.module.css";

type StrategicDate = { date: string; name: string; type: "holiday" | "strategic" };

export function CompanionCalendarCard({ strategicDates }: { strategicDates: StrategicDate[] }) {
  return <div className={styles.list}>{strategicDates.map((date, index) => (
    <div key={`${date.date}-${index}`} className={styles.item}>
      <div className={`${styles.iconBox} ${date.type === "holiday" ? styles.holiday : styles.strategic}`}>{date.type === "holiday" ? <Calendar /> : <Sparkles />}</div>
      <div className={styles.copy}><span className={styles.type}>{date.type === "holiday" ? "Feriado" : "Estratégico"}</span><span className={styles.name}>{format(new Date(`${date.date}T00:00:00`), "dd MMM")} : {date.name}</span></div>
    </div>
  ))}</div>;
}
