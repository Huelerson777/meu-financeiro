'use client';

import { X } from 'lucide-react';
import { formatCurrency } from '@/utils/currency';

interface DetailTransaction {
  id: string;
  description: string;
  amount: number | string;
  date: string;
  category?: { name: string; color: string } | null;
  account?: { name: string } | null;
}

interface TransactionDetailModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  monthLabel: string;
  transactions: DetailTransaction[];
  loading?: boolean;
  tone?: 'success' | 'danger';
}

export function TransactionDetailModal({
  open,
  onClose,
  title,
  monthLabel,
  transactions,
  loading,
  tone = 'success',
}: TransactionDetailModalProps) {
  if (!open) return null;

  const total = transactions.reduce((acc, t) => acc + Number(t.amount), 0);
  const toneClass = tone === 'success' ? 'text-success' : 'text-danger';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col border border-border">
        <div className="flex justify-between items-center p-6 pb-4 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground">{monthLabel}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 pt-4">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum lançamento neste mês.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 pb-3 border-b border-border last:border-0">
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium text-foreground truncate">{t.description}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(t.date).toLocaleDateString('pt-BR')}
                      {t.account?.name ? ` · ${t.account.name}` : ''}
                    </span>
                    {t.category && (
                      <span
                        className="mt-1 inline-flex w-fit items-center text-xs font-normal px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${t.category.color}20`, color: t.category.color }}
                      >
                        {t.category.name}
                      </span>
                    )}
                  </div>
                  <span className={`text-sm font-semibold whitespace-nowrap ${toneClass}`}>
                    {formatCurrency(Number(t.amount))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center p-6 pt-4 border-t border-border">
          <span className="text-sm text-muted-foreground">Total ({transactions.length} lançamentos)</span>
          <span className={`text-lg font-bold ${toneClass}`}>{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  );
}