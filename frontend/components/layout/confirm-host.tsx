'use client';

import { useEffect } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConfirmStore } from '@/utils/notify';
import { cn } from '@/utils/cn';

/** Diálogo de confirmação global (montado uma vez no layout raiz) — ver `confirmDialog`. */
export function ConfirmHost() {
  const { open, message, destructive, answer } = useConfirmStore();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') answer(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, answer]);

  if (!open) return null;

  const Icon = destructive ? AlertTriangle : HelpCircle;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={() => answer(false)}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm animate-rise rounded-t-2xl border border-border bg-card p-6 pb-8 shadow-lift sm:rounded-xl sm:pb-6"
      >
        <span
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-md',
            destructive ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary',
          )}
        >
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <p className="mt-4 text-[0.95rem] font-medium leading-relaxed">{message}</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => answer(false)}>
            Cancelar
          </Button>
          <Button variant={destructive ? 'destructive' : 'default'} onClick={() => answer(true)} autoFocus>
            {destructive ? 'Confirmar' : 'Continuar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
