import { cn } from '@/utils/cn';

/** Marca do PouPay: um "P" cuja haste vira uma moeda — substitui o ícone genérico de carteira. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('h-8 w-8 shrink-0', className)}>
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <path
        d="M11 23V9.5h5.2a4.3 4.3 0 0 1 0 8.6H11"
        fill="none"
        stroke="hsl(var(--primary-foreground))"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="21.5" cy="22" r="2.4" fill="hsl(var(--primary-foreground))" opacity="0.9" />
    </svg>
  );
}
