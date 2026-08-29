'use client';

import { useEffect, useState } from 'react';
import { api } from '@/services/api';

interface Card {
  id: string;
  name: string;
}

interface CategoryOption {
  id: string;
  name: string;
}

interface CreditModalProps {
  card: Card;
  defaultDate: string; // YYYY-MM-DD dentro do mês da fatura selecionada
  onClose: () => void;
  onSuccess: () => void;
}

export function CreditModal({ card, defaultDate, onClose, onSuccess }: CreditModalProps) {
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [categoryId, setCategoryId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    api.get('/categories').then((res) => {
      const raw = res.data;
      const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
      setCategories(list);
    }).catch(() => setCategories([]));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post(`/cards/${card.id}/credits`, {
        description,
        amount: parseFloat(amount || '0'),
        date,
        categoryId: categoryId || undefined,
      });
      onSuccess();
    } catch (err: any) {
      const msg = err.response?.data?.message;
      alert(Array.isArray(msg) ? msg.join('\n') : msg || 'Erro ao lançar crédito.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-md p-6 border border-gray-200 dark:border-zinc-800">
        <div className="flex justify-between items-center mb-1">
          <h2 className="text-xl font-bold dark:text-white">Lançar crédito / estorno</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 font-bold text-lg">
            ✕
          </button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          No cartão <strong>{card.name}</strong> · o valor é descontado da fatura do mês escolhido.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium dark:text-gray-300 mb-1">Descrição</label>
            <input
              type="text" required placeholder="Ex: Estorno - compra cancelada"
              value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-transparent dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium dark:text-gray-300 mb-1">Valor do crédito (R$)</label>
              <input
                type="number" step="0.01" min="0.01" required
                value={amount} onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-transparent dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium dark:text-gray-300 mb-1">Data</label>
              <input
                type="date" required
                value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-transparent dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium dark:text-gray-300 mb-1">Categoria</label>
            <select
              value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 dark:text-white"
            >
              <option value="">Sem categoria</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:underline">
              Cancelar
            </button>
            <button
              type="submit" disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              {isSubmitting ? 'Salvando...' : 'Lançar crédito'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
