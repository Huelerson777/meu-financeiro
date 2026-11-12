import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/utils/cn';

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

/** Opção clicável em forma de pílula — filtros e escolhas rápidas em formulários. */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(({ active, className, type = 'button', ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    aria-pressed={active}
    className={cn(
      'inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-medium transition-theme active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
      active
        ? 'border-primary/40 bg-primary/10 font-semibold text-primary'
        : 'border-border/80 bg-transparent text-muted-foreground hover:border-foreground/25 hover:text-foreground',
      className,
    )}
    {...props}
  />
));
Chip.displayName = 'Chip';
