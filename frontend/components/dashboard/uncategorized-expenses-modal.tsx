'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { api } from '@/services/api';
import { useUncategorizedExpenses } from '@/hooks/use-dashboard';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/utils/currency';
import { notifyAlert } from '@/utils/notify';

interface CategoryOption {
  id: string;
  name: string;
}

function listOf(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.data?.items)) return raw.data.items;
  return [];
}

interface Props {
  month: number;
  year: number;
  onClose: () => void;
}

/** Lista os pagamentos do mês sem categoria e deixa vincular uma categoria a cada um. */
export function UncategorizedExpensesModal({ month, year, onClose }: Props) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useUncategorizedExpenses({ month, year });
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', 'options'],
    queryFn: () =>
      api
        .get('/categories')
        .then((r) => listOf(r.data) as CategoryOption[])
        .catch(() => [] as CategoryOption[]),
  });

  const assign = async (itemId: string, transactionId: string, categoryId: string) => {
    if (!categoryId) return;
    setSavingId(itemId);
    try {
      await api.patch(`/transactions/${transactionId}`, { categoryId });
      // Categorizar uma compra parcelada categoriza todas as parcelas dela
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (err: any) {
      const msg = err.response?.data?.message;
      notifyAlert(Array.isArray(msg) ? msg.join('\n') : msg || 'Erro ao categorizar.');
    } finally {
      setSavingId(null);
    }
  };

  const items = data?.items ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-[2px] sm:items-center sm:p-4">
      <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-t-2xl border border-border bg-card shadow-xl animate-rise sm:max-h-[90vh] sm:rounded-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight">Despesas sem categoria</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isLoading
                ? 'Carregando…'
                : items.length === 0
                  ? 'Tudo categorizado neste mês.'
                  : `${items.length} ${items.length === 1 ? 'pagamento' : 'pagamentos'} · ${formatCurrency(data?.total ?? 0)} fora do gráfico`}
            </p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="rounded-md p-1 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          {isLoading ? (
            <Skeleton className="h-40 rounded-xl" />
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Nenhum pagamento sem categoria. 🎉</div>
          ) : (
            <ul className="divide-y divide-border/70">
              {items.map((item) => (
                <li key={`${item.kind}-${item.id}`} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(item.date).toLocaleDateString('pt-BR')} · {item.source}
                      {item.kind === 'installment' && ' · parcela de cartão'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-num text-sm font-semibold">{formatCurrency(item.amount)}</span>
                    <select
                      value=""
                      disabled={savingId === item.id}
                      onChange={(e) => assign(item.id, item.transactionId, e.target.value)}
                      className="h-9 w-40 rounded-md border border-input bg-transparent px-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="">Escolher categoria…</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
