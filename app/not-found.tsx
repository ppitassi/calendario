import Link from 'next/link';
import { AppFallback } from '../src/components/AppFallback';
import styles from './not-found.module.css';

export default function NotFound() {
  return <AppFallback eyebrow="404" title="Página não encontrada" message="O endereço pode ter mudado ou não está disponível." actions={<Link href="/" className={styles.link}>Voltar ao aplicativo</Link>} />;
}
