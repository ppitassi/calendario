import { ExternalLink } from "lucide-react";
import styles from "./CompanionTrendsCard.module.css";

type Trend = { term: string; url: string };

export function CompanionTrendsCard({ trends }: { trends: Trend[] }) {
  return <div className={styles.list}>{trends.map((trend, index) => (
    <a key={trend.url || index} href={trend.url} target="_blank" rel="noopener noreferrer" className={styles.item}>
      <div className={styles.copy}><span className={styles.rank}>#{index + 1} Trending</span><span className={styles.term}>{trend.term}</span></div>
      <ExternalLink className={styles.icon} />
    </a>
  ))}</div>;
}
