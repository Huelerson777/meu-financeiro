'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

/** Erro dentro de uma tela interna: mantém o menu e o resto do app, só esta área mostra o aviso. */
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-danger/10 text-danger">
        <AlertTriangle className="h-7 w-7" strokeWidth={1.6} />
      </span>
      <h2 className="font-display mt-4 text-xl font-bold tracking-tight">Não foi possível carregar esta tela</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Seus dados estão salvos. Tente de novo em instantes.</p>
      <button
        onClick={reset}
        className="mt-6 inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-theme hover:brightness-110 active:scale-[0.97]"
      >
        Tentar de novo
      </button>
    </div>
  );
}
