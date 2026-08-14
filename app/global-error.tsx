'use client';

import { Button } from "../src/components/ui/Button/Button";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const recover = () => {
    try {
      localStorage.removeItem('content_planner_view_state');
    } finally {
      window.location.assign('/');
    }
  };

  return (
    <html lang="pt-BR">
      <body>
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'system-ui, sans-serif' }} role="alert">
          <section style={{ maxWidth: 520, textAlign: 'center' }}>
            <h1>O Content Planner encontrou um erro</h1>
            <p>Seus dados continuam salvos. Tente novamente ou restaure somente a navegação.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button onClick={reset} variant="ghost">Tentar novamente</Button>
              <Button onClick={recover} variant="primary">Voltar ao Dashboard</Button>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
