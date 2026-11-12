'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

interface MonthSwitcherProps {
  month: number; // 1-12
  year: number;
  onChange: (month: number, year: number) => void;
  className?: string;
}

/**
 * Navegação de mês num controle só: setas pra andar um mês, e o rótulo abre
 * uma grade pra pular direto pra qualquer mês/ano. Substitui o par de
 * <select> (mês + ano) lado a lado.
 */
export function MonthSwitcher({ month, year, onChange, className }: MonthSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(year);
  const ref = useRef<HTMLDivElement>(null);
  const now = new Date();
  const isCurrent = month === now.getMonth() + 1 && year === now.getFullYear();

  useEffect(() => {
    if (!open) return;
    setViewYear(year);
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const step = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    onChange(d.getMonth() + 1, d.getFullYear());
  };

  const arrow =
    'flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-theme hover:bg-foreground/[0.06] hover:text-foreground active:scale-95';

  return (
    <div ref={ref} className={cn('relative inline-flex items-center rounded-full bg-foreground/[0.05] p-0.5', className)}>
      <button type="button" onClick={() => step(-1)} aria-label="Mês anterior" className={arrow}>
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="h-9 min-w-[8.75rem] rounded-full px-3 text-center text-sm font-semibold transition-theme hover:bg-foreground/[0.06]"
      >
        {MONTHS[month - 1]} <span className="font-num font-medium text-muted-foreground">{year}</span>
      </button>
      <button type="button" onClick={() => step(1)} aria-label="Próximo mês" className={arrow}>
        <ChevronRight className="h-4 w-4" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Escolher mês"
          className="absolute right-0 top-full z-40 mt-2 w-64 animate-fade-in rounded-2xl border border-border bg-card p-3 shadow-lift"
        >
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => setViewYear((y) => y - 1)} aria-label="Ano anterior" className={arrow}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-num text-sm font-semibold">{viewYear}</span>
            <button type="button" onClick={() => setViewYear((y) => y + 1)} aria-label="Próximo ano" className={arrow}>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {SHORT.map((label, i) => {
              const selected = i + 1 === month && viewYear === year;
              const today = i === now.getMonth() && viewYear === now.getFullYear();
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    onChange(i + 1, viewYear);
                    setOpen(false);
                  }}
                  className={cn(
                    'h-9 rounded-lg text-sm font-medium capitalize transition-theme',
                    selected
                      ? 'bg-primary font-semibold text-primary-foreground'
                      : 'text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground',
                    today && !selected && 'text-primary ring-1 ring-inset ring-primary/40',
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {!isCurrent && (
            <button
              type="button"
              onClick={() => {
                onChange(now.getMonth() + 1, now.getFullYear());
                setOpen(false);
              }}
              className="mt-2 h-9 w-full rounded-lg text-sm font-semibold text-primary transition-theme hover:bg-primary/10"
            >
              Voltar para o mês atual
            </button>
          )}
        </div>
      )}
    </div>
  );
}
