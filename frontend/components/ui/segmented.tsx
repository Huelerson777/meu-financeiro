import { LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  /** Classe aplicada só quando a opção está selecionada (ex: cor por tipo). */
  activeClass?: string;
}

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  className?: string;
  size?: 'sm' | 'md';
  'aria-label'?: string;
}

/** Escolha única entre poucas opções — substitui <select> quando dá pra ver tudo de uma vez. */
export function Segmented<T extends string>({ value, onChange, options, className, size = 'md', ...rest }: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={rest['aria-label']}
      className={cn('inline-flex rounded-full bg-foreground/[0.05] p-1', className)}
    >
      {options.map(({ value: v, label, icon: Icon, activeClass }) => {
        const active = v === value;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(v)}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition-theme focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              size === 'sm' ? 'h-8 px-3 text-xs' : 'h-9 px-4 text-[13px]',
              active
                ? cn('bg-card text-foreground shadow-soft', activeClass)
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {Icon && <Icon className="h-4 w-4" strokeWidth={1.9} />}
            {label}
          </button>
        );
      })}
    </div>
  );
}
