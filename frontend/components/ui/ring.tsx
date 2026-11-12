'use client';

import { ReactNode, useEffect, useState } from 'react';
import { cn } from '@/utils/cn';

interface RingProps {
  /** progresso de 0 a 1 (acima de 1 é cortado no anel cheio) */
  value: number;
  /** diâmetro em px */
  size?: number;
  thickness?: number;
  /** cor do traço (CSS); por padrão segue o tom pelo valor */
  color?: string;
  /** a partir de quanto o anel fica âmbar / vermelho (quando sem `color`) */
  warnAt?: number;
  dangerAt?: number;
  className?: string;
  children?: ReactNode;
  'aria-label'?: string;
}

/**
 * Anel de progresso (SVG puro). Abre animado na montagem e quando o valor muda.
 * Usado em limite de cartão, metas e orçamento — o "mostrador" do Início em
 * versão pequena.
 */
export function Ring({ value, size = 64, thickness = 6, color, warnAt, dangerAt, className, children, ...rest }: RingProps) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value || 0));
  const tone =
    color ??
    (dangerAt != null && value >= dangerAt
      ? 'hsl(var(--danger))'
      : warnAt != null && value >= warnAt
        ? 'hsl(var(--warning))'
        : 'hsl(var(--primary))');

  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }} role="img" aria-label={rest['aria-label']}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--foreground) / 0.08)" strokeWidth={thickness} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${ready ? v * c : 0} ${c}`}
          className="transition-[stroke-dasharray] duration-700 ease-out motion-reduce:transition-none"
        />
      </svg>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>}
    </div>
  );
}
