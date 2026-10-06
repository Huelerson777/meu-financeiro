import Link from 'next/link';
import { Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/utils/currency';
import type { GoalsSummary } from '@/services/dashboard.service';

/** Anel de progresso simples em SVG (sem biblioteca). */
function Ring({ value }: { value: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
        <circle
          cx="40" cy="40" r={r} fill="none" stroke="hsl(var(--primary))" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <span className="font-num absolute inset-0 flex items-center justify-center text-lg font-bold">{Math.round(pct)}%</span>
    </div>
  );
}

/** Resumo das metas: progresso geral em anel e uma barra por meta com prazo e quanto falta. */
export function GoalsSummaryCard({ summary, isLoading }: { summary?: GoalsSummary; isLoading: boolean }) {
  const empty = !summary || summary.count === 0;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" strokeWidth={1.75} /> Metas
        </CardTitle>
        <Link href="/goals" className="text-xs font-semibold text-primary hover:underline">
          {empty ? 'Criar meta' : 'Ver todas'}
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : empty ? (
          <div className="flex flex-col items-center px-4 py-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Target className="h-6 w-6" strokeWidth={1.6} />
            </span>
            <p className="font-display mt-3 text-base font-bold">Você ainda não tem metas</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">Defina uma viagem ou uma reserva de emergência e acompanhe o progresso aqui.</p>
            <Link
              href="/goals"
              className="mt-4 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-theme hover:brightness-110 hover:-translate-y-px active:scale-[0.97] btn-sheen"
            >
              Criar primeira meta
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-5">
              <Ring value={summary.overallProgress} />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Progresso geral</p>
                <p className="font-num text-2xl font-bold leading-tight">{formatCurrency(summary.totalCurrent)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">de {formatCurrency(summary.totalTarget)} em {summary.count} {summary.count === 1 ? 'meta' : 'metas'}</p>
              </div>
            </div>

            <ul className="mt-5 flex flex-col gap-4">
              {summary.goals.map((g) => {
                const left = Math.max(0, g.targetAmount - g.currentAmount);
                return (
                  <li key={g.id}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-semibold">{g.name}</span>
                      <span className="font-num shrink-0 text-xs font-bold text-primary">{g.progress}%</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-primary transition-all duration-500" style={{ width: `${Math.min(100, g.progress)}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatCurrency(g.currentAmount)} de {formatCurrency(g.targetAmount)}
                      {left > 0 && ` · faltam ${formatCurrency(left)}`}
                      {g.deadline ? ` · até ${new Date(g.deadline).toLocaleDateString('pt-BR')}` : ''}
                    </p>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
