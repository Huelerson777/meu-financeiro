'use client';

import { notifyAlert } from '@/utils/notify';
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

interface EditingRecurring {
  id: string;
  description: string;
  amount: number;
  chargeDay: number;
  categoryId?: string | null;
}

interface RecurringPurchaseModalProps {
  card: Card;
  onClose: () => void;
  onSuccess: () => void;
  editingRecurring?: EditingRecurring | null;
}

export function RecurringPurchaseModal({ card, onClose, onSuccess, editingRecurring }: RecurringPurchaseModalProps) {
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [description, setDescription] = useState(editingRecurring?.description ?? '');
  const [amount, setAmount] = useState(editingRecurring?.amount.toString() ?? '');
  const [chargeDay, setChargeDay] = useState(editingRecurring?.chargeDay.toString() ?? new Date().getDate().toString());
  const [categoryId, setCategoryId] = useState(editingRecurring?.categoryId ?? '');
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
      const payload = {
        description,
        amount: parseFloat(amount || '0'),
        chargeDay: parseInt(chargeDay, 10),
        categoryId: categoryId || undefined,
      };

      if (editingRecurring) {
        await api.patch(`/cards/recurring-purchases/${editingRecurring.id}`, payload);
      } else {
        await api.post(`/cards/${card.id}/recurring-purchases`, payload);
      }
      onSuccess();
    } catch (err: any) {
      const msg = err.response?.data?.message;
      notifyAlert(Array.isArray(msg) ? msg.join('\n') : msg || 'Erro ao salvar compra recorrente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-end justify-center z-50 sm:items-center sm:p-4">
        <div className="bg-card rounded-t-2xl sm:rounded-xl shadow-xl w-full max-w-md p-6 border border-border animate-rise max-h-[92dvh] overflow-y-auto sm:max-h-[90vh]">
        <div className="flex justify-between items-center mb-1">
          <h2 className="text-xl font-bold">
            {editingRecurring ? 'Editar assinatura' : 'Lançar compra recorrente'}
          </h2>
          <button onClick={onClose} className="text-foreground hover:text-foreground/80 font-bold text-lg">
            ✕
          </button>
        </div>
        <p className="text-sm text-foreground mb-5">
          No cartão <strong>{card.name}</strong> · mesmo valor todo mês, sem data final. Ex: Apple, streaming, mensalidade.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Descrição</label>
            <input
              type="text" required placeholder="Ex: Apple One"
              value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg bg-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Valor mensal (R$)</label>
              <input
                type="number" step="0.01" required
                value={amount} onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg bg-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Dia da cobrança</label>
              <input
                type="number" min="1" max="31" required
                value={chargeDay} onChange={(e) => setChargeDay(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg bg-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Categoria</label>
            <select
              value={categoryId ?? ''} onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg bg-card"
            >
              <option value="">Sem categoria</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-foreground hover:underline">
              Cancelar
            </button>
            <button
              type="submit" disabled={isSubmitting}
              className="bg-primary hover:brightness-110 hover:-translate-y-px active:scale-[0.97] btn-sheen text-primary-foreground px-5 py-2 rounded-md text-sm font-medium transition disabled:opacity-50"
            >
              {isSubmitting ? 'Salvando...' : editingRecurring ? 'Salvar alterações' : 'Lançar recorrente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
