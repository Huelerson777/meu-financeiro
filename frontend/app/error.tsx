'use client';

import { useEffect } from 'react';
import { BrandMark } from '@/components/layout/brand-mark';

/** Erro inesperado em qualquer tela: mensagem direta e uma saída (tentar de novo). */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-6 text-center">
      <BrandMark className="h-12 w-12" />
      <h1 className="font-display mt-8 text-2xl font-bold tracking-tight">Algo deu errado</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Não foi possível carregar esta tela. Seus dados estão salvos. Tente de novo; se continuar, volte ao início.
      </p>
      <div className="mt-8 flex gap-2">
        <button
          onClick={reset}
          className="inline-flex h-11 items-center rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground transition-theme hover:brightness-110 active:scale-[0.97]"
        >
          Tentar de novo
        </button>
        <a
          href="/dashboard"
          className="inline-flex h-11 items-center rounded-md border border-input bg-card px-6 text-sm font-semibold transition-theme hover:bg-muted active:scale-[0.97]"
        >
          Ir para o início
        </a>
      </div>
    </main>
  );
}
