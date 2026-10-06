'use client';

import { notifyAlert } from '@/utils/notify';
import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import { formatCurrency } from '@/utils/currency';

interface AccountOption {
  id: string;
  name: string;
}

interface PaymentModalProps {
  title: string;
  description?: string;
  amount: number;
  category?: { name: string; color: string } | null;
  amountEditable?: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onConfirm: (accountId: string, date: string, amount: number) => Promise<void>;
}

const extractList = (raw: any): AccountOption[] => {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.data?.items)) return raw.data.items;
  if (Array.isArray(raw?.items)) return raw.items;
  return [];
};

export function PaymentModal({
  title,
  description,
  amount,
  category,
  amountEditable,
  onClose,
  onSuccess,
  onConfirm,
}: PaymentModalProps) {
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amountValue, setAmountValue] = useState(amount.toString());
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    api.get('/accounts').then((res) => {
      const list = extractList(res.data);
      setAccounts(list);
      if (list.length > 0) setAccountId(list[0].id);
    }).catch(() => setAccounts([]));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId) {
      notifyAlert('Selecione a conta de onde vai sair o pagamento.');
      return;
    }
    const parsedAmount = parseFloat(amountValue);
    if (!parsedAmount || parsedAmount <= 0) {
      notifyAlert('Informe um valor válido.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onConfirm(accountId, date, parsedAmount);
      onSuccess();
    } catch (err: any) {
      const msg = err.response?.data?.message;
      notifyAlert(Array.isArray(msg) ? msg.join('\n') : msg || 'Erro ao registrar pagamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-end justify-center z-[60] sm:items-center sm:p-4">
        <div className="bg-card rounded-t-2xl sm:rounded-xl shadow-xl w-full max-w-md p-6 border border-border animate-rise max-h-[92dvh] overflow-y-auto sm:max-h-[90vh]">
        <div className="flex justify-between items-center mb-1">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="text-foreground hover:text-foreground/80 font-bold text-lg">
            ✕
          </button>
        </div>
        {description && <p className="text-sm text-foreground mb-1">{description}</p>}
        {category && (
          <span
            className="inline-flex w-fit items-center text-xs font-normal px-2 py-0.5 rounded-full mb-4"
            style={{ backgroundColor: `${category.color}20`, color: category.color }}
          >
            {category.name}
          </span>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {amountEditable ? (
            <div>
              <label className="block text-sm font-medium mb-1">Valor a pagar (R$)</label>
              <input
                type="number" step="0.01" required
                value={amountValue} onChange={(e) => setAmountValue(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg bg-transparent"
              />
            </div>
          ) : (
            <div className="bg-muted/60 rounded-lg p-3 flex justify-between items-center">
              <span className="text-sm text-foreground">Valor a pagar</span>
              <span className="text-lg font-bold">{formatCurrency(amount)}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Pagar com a conta</label>
            <select
              required value={accountId} onChange={(e) => setAccountId(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg bg-card"
            >
              {accounts.length === 0 && <option value="">Nenhuma conta encontrada</option>}
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Data do pagamento</label>
            <input
              type="date" required
              value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg bg-transparent"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-foreground hover:underline">
              Cancelar
            </button>
            <button
              type="submit" disabled={isSubmitting || accounts.length === 0}
              className="bg-primary hover:brightness-110 active:scale-[0.97] text-primary-foreground px-5 py-2 rounded-md text-sm font-medium transition disabled:opacity-50"
            >
              {isSubmitting ? 'Pagando...' : 'Confirmar pagamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
