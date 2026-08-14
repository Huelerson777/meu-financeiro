'use client';

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
  onClose: () => void;
  onSuccess: () => void;
  onConfirm: (accountId: string, date: string) => Promise<void>;
}

const extractList = (raw: any): AccountOption[] => {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.data?.items)) return raw.data.items;
  if (Array.isArray(raw?.items)) return raw.items;
  return [];
};

export function PaymentModal({ title, description, amount, onClose, onSuccess, onConfirm }: PaymentModalProps) {
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
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
      alert('Selecione a conta de onde vai sair o pagamento.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onConfirm(accountId, date);
      onSuccess();
    } catch (err: any) {
      const msg = err.response?.data?.message;
      alert(Array.isArray(msg) ? msg.join('\n') : msg || 'Erro ao registrar pagamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-md p-6 border border-gray-200 dark:border-zinc-800">
        <div className="flex justify-between items-center mb-1">
          <h2 className="text-xl font-bold dark:text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 font-bold text-lg">
            ✕
          </button>
        </div>
        {description && <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{description}</p>}

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-lg p-3 flex justify-between items-center">
            <span className="text-sm text-gray-500 dark:text-gray-400">Valor a pagar</span>
            <span className="text-lg font-bold dark:text-white">{formatCurrency(amount)}</span>
          </div>

          <div>
            <label className="block text-sm font-medium dark:text-gray-300 mb-1">Pagar com a conta</label>
            <select
              required value={accountId} onChange={(e) => setAccountId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 dark:text-white"
            >
              {accounts.length === 0 && <option value="">Nenhuma conta encontrada</option>}
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium dark:text-gray-300 mb-1">Data do pagamento</label>
            <input
              type="date" required
              value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-transparent dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:underline">
              Cancelar
            </button>
            <button
              type="submit" disabled={isSubmitting || accounts.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              {isSubmitting ? 'Pagando...' : 'Confirmar pagamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
