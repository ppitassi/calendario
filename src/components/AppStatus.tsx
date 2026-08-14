'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './ui/Button/Button';
import { Surface } from './ui/Surface/Surface';
import styles from './AppStatus.module.css';

export function AppLoading({ label = 'Carregando conteúdo' }: { label?: string }) {
  return (
    <div className={styles.loadingPage} role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className={styles.skeletonStack} aria-hidden="true">
        <div className={`${styles.skeleton} ${styles.skeletonHeading}`} />
        <div className={styles.skeletonGrid}>
          {[0, 1, 2].map(item => <div key={item} className={`${styles.skeleton} ${styles.skeletonCard}`} />)}
        </div>
      </div>
    </div>
  );
}

export function AppError({
  title = 'Não foi possível carregar esta área',
  message = 'Tente novamente. Se o problema continuar, contate o administrador.',
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className={styles.errorPage}>
      <Surface level="strong" className={styles.errorCard} role="alert">
        <AlertTriangle className={styles.errorIcon} aria-hidden="true" />
        <h1 className={styles.errorTitle}>{title}</h1>
        <p className={styles.errorMessage}>{message}</p>
        {onRetry && (
          <Button type="button" onClick={onRetry} className="mt-6" variant="primary" icon={<RefreshCw aria-hidden="true" />}>
            Tentar novamente
          </Button>
        )}
      </Surface>
    </div>
  );
}
