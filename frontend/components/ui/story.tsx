import { ReactNode } from 'react';
import { cn } from '@/utils/cn';

/**
 * Cabeçalho "contado": a tela resume a situação numa frase com os números
 * dentro (use <Money/> de month-story para animar), no lugar de um número
 * solto em cima de um rótulo. Mesmo tom do Início, um tamanho abaixo.
 */
export function Story({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('font-display text-[1.35rem] font-semibold leading-[1.25] tracking-tight sm:text-[1.7rem]', className)}>
      {children}
    </p>
  );
}

/** Trecho de ligação da frase, em tom apagado (os números ficam em destaque). */
export function Dim({ children }: { children: ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}
