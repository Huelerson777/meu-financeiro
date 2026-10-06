import { EyeOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AccountAvatar } from '@/components/accounts/account-avatar';
import { AccountVisibilityPicker } from '@/components/dashboard/account-visibility-picker';
import { formatCurrency } from '@/utils/currency';
import { cn } from '@/utils/cn';
import type { Account } from '@/types';

const TYPE_LABELS: Record<string, string> = {
  CHECKING: 'Conta corrente',
  SAVINGS: 'Poupança',
  WALLET: 'Carteira',
  CASH: 'Dinheiro',
  INVESTMENT: 'Investimento',
};

interface AccountBalancesCardProps {
  /** Todas as contas (alimenta o seletor de visibilidade no cabeçalho). */
  allAccounts: Account[];
  /** Contas visíveis, já filtradas. */
  accounts: Account[];
  isLoading: boolean;
  onHide: (accountId: string) => void;
  onOpen: () => void;
}

const FALLBACK_COLOR = '#64748B';

/** Saldo por conta: total em destaque, barra segmentada por conta e lista com participação de cada uma. */
export function AccountBalancesCard({ allAccounts, accounts, isLoading, onHide, onOpen }: AccountBalancesCardProps) {
  const balanceOf = (a: Account) => Number(a.currentBalance ?? 0);
  const sorted = [...accounts].sort((a, b) => balanceOf(b) - balanceOf(a));
  const total = sorted.reduce((s, a) => s + balanceOf(a), 0);
  const positiveTotal = sorted.reduce((s, a) => s + Math.max(0, balanceOf(a)), 0);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Saldo por Conta</CardTitle>
        <AccountVisibilityPicker accounts={allAccounts} />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-56 rounded-xl" />
        ) : sorted.length === 0 ? (
          <p className="flex h-40 items-center justify-center px-4 text-center text-sm text-muted-foreground">
            {allAccounts.length > 0
              ? 'Todas as contas foram ocultadas deste card. Use o botão de olho acima para reexibir alguma.'
              : 'Nenhuma conta cadastrada.'}
          </p>
        ) : (
          <>
            <p className="text-xs font-medium text-muted-foreground">Total nas contas exibidas</p>
            <p className={cn('font-num mt-1 text-4xl font-bold leading-none', total < 0 && 'text-danger')}>{formatCurrency(total)}</p>

            {/* barra segmentada: quanto cada conta pesa no total */}
            {positiveTotal > 0 && (
              <div className="mt-5 flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
                {sorted
                  .filter((a) => balanceOf(a) > 0)
                  .map((a) => (
                    <div
                      key={a.id}
                      className="h-full first:rounded-l-full last:rounded-r-full"
                      style={{ width: `${(balanceOf(a) / positiveTotal) * 100}%`, backgroundColor: a.color || FALLBACK_COLOR }}
                    />
                  ))}
              </div>
            )}

            <ul className="mt-4 divide-y divide-border/70">
              {sorted.map((a) => {
                const balance = balanceOf(a);
                const share = positiveTotal > 0 && balance > 0 ? (balance / positiveTotal) * 100 : 0;
                const color = a.color || FALLBACK_COLOR;
                return (
                  <li key={a.id} className="group">
                    <div className="flex items-center gap-3 py-3">
                      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left transition-theme hover:translate-x-0.5">
                        <AccountAvatar name={a.name} color={a.color} icon={a.icon} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{a.name}</span>
                          <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                            {TYPE_LABELS[a.type] ?? a.type}
                            {share > 0 && <span>· {share.toFixed(0)}% do total</span>}
                          </span>
                        </span>
                        <span className={cn('font-num shrink-0 text-base font-bold', balance < 0 && 'text-danger')}>{formatCurrency(balance)}</span>
                      </button>
                      <button
                        type="button"
                        title={`Ocultar "${a.name}" deste card`}
                        aria-label={`Ocultar ${a.name}`}
                        onClick={() => onHide(a.id)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-theme hover:bg-muted hover:text-foreground [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <EyeOff className="h-4 w-4" strokeWidth={1.75} />
                      </button>
                    </div>
                    <div className="mb-3 h-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-1 rounded-full transition-all" style={{ width: `${share}%`, backgroundColor: color }} />
                    </div>
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
