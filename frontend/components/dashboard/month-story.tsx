'use client';

import { useEffect, useRef, useState } from 'react';
import { formatCurrency, formatCurrencyRound } from '@/utils/currency';
import { cn } from '@/utils/cn';

/**
 * Peças do topo do Início sem "caixinhas": o mês contado numa frase
 * (<Money/> anima o número), a linha do mês (o que já aconteceu em traço
 * cheio, o que ainda vem em pontilhado) e o mostrador circular.
 * Tudo SVG/CSS puro — sem biblioteca de gráfico.
 */

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Anima de onde o número estava até o novo valor (troca de mês, pagamento…). */
export function useCountUp(value: number, duration = 700) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    if (prefersReducedMotion() || from.current === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = from.current;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const current = start + (value - start) * eased;
      from.current = current;
      setShown(current);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return shown;
}

/** Valor em reais sem centavos, com contagem animada. */
export function Money({ value, className }: { value: number; className?: string }) {
  const shown = useCountUp(value);
  return <span className={cn('font-num whitespace-nowrap', className)}>{formatCurrencyRound(shown)}</span>;
}

// ---------------------------------------------------------------------------
// Linha do mês
// ---------------------------------------------------------------------------

export interface RiverOpenItem {
  description: string;
  amount: number;
  dueDate: string;
  type: 'INCOME' | 'EXPENSE';
  isOverdue: boolean;
}

interface MonthRiverProps {
  month: number;
  year: number;
  /** Série diária do fluxo de caixa (só o que já foi pago/recebido). */
  series?: { key: string; receitas: number; despesas: number }[];
  /** O que ainda vence no mês — vira o trecho pontilhado. */
  openItems?: RiverOpenItem[];
}

interface Marker {
  day: number;
  title: string;
  value: string;
  tone: 'in' | 'out' | 'due' | 'end';
  /** Rótulo aparece só em telas maiores (evita amontoar no celular). */
  secondary?: boolean;
}

const short = (s: string, n = 22) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export function MonthRiver({ month, year, series, openItems }: MonthRiverProps) {
  const [hoverDay, setHoverDay] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const isCurrent = now.getMonth() + 1 === month && now.getFullYear() === year;
  const isFuture = new Date(year, month - 1, 1) > now;
  const days = new Date(year, month, 0).getDate();
  const lastDay = isFuture ? 0 : isCurrent ? now.getDate() : days;

  const income = new Map<number, number>();
  const expense = new Map<number, number>();
  (series ?? []).forEach((d) => {
    const day = Number(d.key.split('-')[2]);
    if (!day) return;
    income.set(day, (income.get(day) ?? 0) + d.receitas);
    expense.set(day, (expense.get(day) ?? 0) + d.despesas);
  });

  // Contas em aberto caem no dia do vencimento; as atrasadas, logo depois de hoje
  const dueByDay = new Map<number, number>();
  const openExpenses = (openItems ?? []).filter((i) => i.type === 'EXPENSE');
  const dueDay = (i: RiverOpenItem) => {
    const d = new Date(i.dueDate).getDate();
    return Math.min(days, i.isOverdue || d <= lastDay ? lastDay + 1 : d);
  };
  if (lastDay < days) openExpenses.forEach((i) => dueByDay.set(dueDay(i), (dueByDay.get(dueDay(i)) ?? 0) + i.amount));

  let acc = 0;
  const points = Array.from({ length: days }, (_, idx) => {
    const day = idx + 1;
    if (day <= lastDay) acc += (income.get(day) ?? 0) - (expense.get(day) ?? 0);
    else acc -= dueByDay.get(day) ?? 0;
    return { day, v: acc };
  });

  const values = points.map((p) => p.v);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const X = (day: number) => (days > 1 ? ((day - 1) / (days - 1)) * 100 : 50);
  const Y = (v: number) => 14 + (1 - (v - min) / span) * 66;

  const curve = (list: { day: number; v: number }[]) =>
    list
      .map((p, i) => {
        const x = X(p.day);
        const y = Y(p.v);
        if (i === 0) return `M${x.toFixed(2)},${y.toFixed(2)}`;
        const px = X(list[i - 1].day);
        const py = Y(list[i - 1].v);
        const mid = (x - px) / 2;
        return `C${(px + mid).toFixed(2)},${py.toFixed(2)} ${(x - mid).toFixed(2)},${y.toFixed(2)} ${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');

  // O traço começa do zero no dia 1 para o primeiro movimento aparecer como subida/descida
  const origin = { day: 1, v: 0 };
  const past = lastDay > 0 ? [origin, ...points.filter((p) => p.day <= lastDay)] : [];
  const future = lastDay < days ? [lastDay > 0 ? points[lastDay - 1] : origin, ...points.filter((p) => p.day > lastDay)] : [];
  const pastPath = past.length > 1 ? curve(past) : '';
  const futurePath = future.length > 1 ? curve(future) : '';
  const areaPath = pastPath ? `${pastPath} L${X(past[past.length - 1].day).toFixed(2)},100 L${X(1).toFixed(2)},100 Z` : '';

  // Marcos: maior entrada e maior saída do que já passou; as 2 maiores contas que ainda vencem; e o fim do mês
  const markers: Marker[] = [];
  const top = (map: Map<number, number>) => [...map.entries()].filter(([d, v]) => d <= lastDay && v > 0).sort((a, b) => b[1] - a[1])[0];
  const topIn = top(income);
  const topOut = top(expense);
  if (topIn) markers.push({ day: topIn[0], title: `dia ${topIn[0]}`, value: `+ ${formatCurrencyRound(topIn[1])}`, tone: 'in' });
  if (topOut && topOut[0] !== topIn?.[0]) {
    markers.push({ day: topOut[0], title: `dia ${topOut[0]}`, value: `− ${formatCurrencyRound(topOut[1])}`, tone: 'out', secondary: true });
  }
  if (lastDay < days) {
    const usedDays = new Set<number>();
    [...openExpenses]
      .sort((a, b) => b.amount - a.amount)
      .forEach((i) => {
        const d = dueDay(i);
        if (usedDays.size >= 2 || usedDays.has(d) || d >= days - 1) return;
        usedDays.add(d);
        markers.push({ day: d, title: short(i.description), value: `− ${formatCurrencyRound(i.amount)}`, tone: 'due', secondary: usedDays.size > 1 });
      });
    if (isCurrent) {
      markers.push({ day: days, title: `dia ${days} · previsto`, value: formatCurrencyRound(points[days - 1].v), tone: 'end' });
    }
  }

  const valueAt = (day: number) => points[day - 1]?.v ?? 0;
  const onMove = (e: React.PointerEvent) => {
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHoverDay(Math.round(pct * (days - 1)) + 1);
  };

  const dot: Record<Marker['tone'], string> = {
    in: 'bg-primary',
    out: 'bg-foreground',
    due: 'bg-warning',
    end: 'border-2 border-primary bg-background',
  };

  return (
    <div
      ref={boxRef}
      onPointerMove={onMove}
      onPointerLeave={() => setHoverDay(null)}
      className="relative h-44 w-full touch-pan-y select-none sm:h-56"
      role="img"
      aria-label="Resultado acumulado do mês, dia a dia: o que já aconteceu e o que ainda vence"
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <linearGradient id="riverFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.28" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        {min < 0 && (
          <line x1="0" x2="100" y1={Y(0)} y2={Y(0)} stroke="hsl(var(--border))" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        )}
        {/* O que já aconteceu "se desenha" da esquerda pra direita na entrada */}
        <g className="river-reveal">
          {areaPath && <path d={areaPath} fill="url(#riverFill)" />}
          {pastPath && (
            <path d={pastPath} fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          )}
        </g>
        {futurePath && (
          <path
            d={futurePath}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeOpacity="0.65"
            strokeWidth="2"
            strokeDasharray="2 7"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {isCurrent && (
        <div className="pointer-events-none absolute inset-y-0" style={{ left: `${X(lastDay)}%` }}>
          <div className="h-full border-l border-dashed border-foreground/20" />
          <span className={cn('absolute top-0 text-[11px] font-semibold text-muted-foreground', X(lastDay) > 88 ? 'right-1.5' : 'left-1.5')}>hoje</span>
          <span
            className="absolute left-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-4 ring-background"
            style={{ top: `${Y(valueAt(lastDay))}%` }}
          />
        </div>
      )}

      {markers.map((m) => {
        const x = X(m.day);
        const y = Y(valueAt(m.day));
        const above = m.tone === 'in' || m.tone === 'end' || y > 62;
        return (
          <div key={`${m.tone}-${m.day}`} className="pointer-events-none absolute" style={{ left: `${x}%`, top: `${y}%` }}>
            <span className={cn('absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background', dot[m.tone])} />
            <span
              className={cn(
                'absolute whitespace-nowrap text-[11px] leading-tight',
                above ? 'bottom-3' : 'top-3',
                x < 12 ? 'left-0' : x > 82 ? 'right-0 text-right' : 'left-0 -translate-x-1/2 text-center',
                m.secondary && 'hidden sm:block',
              )}
            >
              <span className="block text-muted-foreground">{m.title}</span>
              <span className="font-num block text-[13px] font-semibold text-foreground">{m.value}</span>
            </span>
          </div>
        );
      })}

      {hoverDay != null && (
        <div className="pointer-events-none absolute inset-y-0 z-10" style={{ left: `${X(hoverDay)}%` }}>
          <div className="h-full border-l border-foreground/25" />
          <span
            className="absolute left-0 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground ring-2 ring-background"
            style={{ top: `${Y(valueAt(hoverDay))}%` }}
          />
          <span
            className={cn(
              'absolute bottom-0 whitespace-nowrap rounded-full border border-border bg-card px-2.5 py-1 text-[11px] shadow-lift',
              X(hoverDay) > 75 ? 'right-2' : 'left-2',
            )}
          >
            <span className="text-muted-foreground">dia {hoverDay}{hoverDay > lastDay ? ' · previsto' : ''} · </span>
            <span className="font-num font-semibold">{formatCurrency(valueAt(hoverDay))}</span>
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mostrador
// ---------------------------------------------------------------------------

interface DialSegment {
  key: string;
  label: string;
  value: number;
  /** cor do traço (CSS) */
  color: string;
}

interface MonthDialProps {
  segments: DialSegment[];
  /** fração do mês já percorrida (0–1) — anel de dentro */
  elapsed: number;
  caption: string;
  value: number;
  negative?: boolean;
  footnote?: string;
}

const R_OUT = 84;
const R_IN = 66;
const C_OUT = 2 * Math.PI * R_OUT;
const C_IN = 2 * Math.PI * R_IN;
const GAP = 5;

export function MonthDial({ segments, elapsed, caption, value, negative, footnote }: MonthDialProps) {
  // arcos nascem zerados e abrem no primeiro frame (transição de stroke-dasharray)
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const visible = segments.filter((s) => s.value > 0);
  const total = visible.reduce((sum, s) => sum + s.value, 0) || 1;
  let offset = 0;
  const arcs = visible.map((s) => {
    const full = (s.value / total) * C_OUT;
    const len = Math.max(2, full - (visible.length > 1 ? GAP : 0));
    const arc = { ...s, len, offset };
    offset += full;
    return arc;
  });
  const focus = visible.find((s) => s.key === active);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative aspect-square w-[13.5rem] max-w-full sm:w-60">
        <div aria-hidden className="absolute inset-[3%] animate-[spin_90s_linear_infinite] rounded-full border border-dashed border-foreground/10 motion-reduce:animate-none" />
        <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90" role="img" aria-label={visible.map((s) => `${s.label}: ${formatCurrencyRound(s.value)}`).join(', ')}>
          <circle cx="100" cy="100" r={R_OUT} fill="none" stroke="hsl(var(--foreground) / 0.07)" strokeWidth="12" />
          {arcs.map((a) => (
            <circle
              key={a.key}
              cx="100"
              cy="100"
              r={R_OUT}
              fill="none"
              stroke={a.color}
              strokeLinecap="round"
              strokeWidth={active === a.key ? 16 : 12}
              strokeDasharray={`${ready ? a.len : 0} ${C_OUT}`}
              strokeDashoffset={-a.offset - (visible.length > 1 ? GAP / 2 : 0)}
              opacity={active && active !== a.key ? 0.35 : 1}
              onPointerEnter={() => setActive(a.key)}
              onPointerLeave={() => setActive(null)}
              className="cursor-pointer transition-[stroke-dasharray,stroke-width,opacity] duration-700 ease-out"
            />
          ))}
          <circle cx="100" cy="100" r={R_IN} fill="none" stroke="hsl(var(--foreground) / 0.06)" strokeWidth="3" />
          <circle
            cx="100"
            cy="100"
            r={R_IN}
            fill="none"
            stroke="hsl(var(--foreground) / 0.5)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${ready ? Math.max(0, Math.min(1, elapsed)) * C_IN : 0} ${C_IN}`}
            className="transition-[stroke-dasharray] duration-1000 ease-out"
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-9 text-center">
          <span className="text-[11px] font-medium text-muted-foreground">{focus ? focus.label : caption}</span>
          {focus ? (
            <span className="font-num mt-0.5 text-[1.6rem] font-bold leading-none">{formatCurrencyRound(focus.value)}</span>
          ) : (
            <Money value={Math.abs(value)} className={cn('mt-0.5 text-[1.6rem] font-bold leading-none', negative && 'text-danger')} />
          )}
          {footnote && !focus && <span className="mt-1.5 text-[11px] leading-tight text-muted-foreground">{footnote}</span>}
        </div>
      </div>
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {visible.map((s) => (
          <li
            key={s.key}
            onPointerEnter={() => setActive(s.key)}
            onPointerLeave={() => setActive(null)}
            className={cn('flex cursor-default items-center gap-1.5 transition-colors', active === s.key && 'text-foreground')}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
