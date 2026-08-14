'use client';

import { useEffect } from 'react';
import { Button } from "../src/components/ui/Button/Button";
import { AppFallback } from "../src/components/AppFallback";

const VIEW_STATE_KEY = 'content_planner_view_state';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[content-planner-route]', error);
  }, [error]);

  const returnToDashboard = () => {
    localStorage.removeItem(VIEW_STATE_KEY);
    window.location.assign('/');
  };

  return <AppFallback title="Não foi possível abrir esta tela" message="Seus dados continuam salvos. Você pode tentar carregar novamente ou voltar ao Dashboard." actions={<><Button onClick={reset} variant="ghost">Tentar novamente</Button><Button onClick={returnToDashboard} variant="primary">Voltar ao Dashboard</Button></>} />;
}
