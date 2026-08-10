'use client';

import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import { formatCurrency } from '@/utils/currency';

interface Card {
  id: string;
  name: string;
  limitAmount: number | string;
  usedLimit: number | string;
  color?: string;
}

interface CategoryOption {
  id: string;
  name: string;
}

interface EditingPurchase {
  installmentGroupId: string;
  description: string;
  totalAmount: number;
  installmentsCount: number;
  purchaseDate: string;
  categoryId?: string | null;
}

interface PurchaseModalProps {
  card: Card;
  onClose: () => void;
  onSuccess: () => void;
  editingPurchase?: EditingPurchase | null;
}

export function PurchaseModal({ card, onClose, onSuccess, editingPurchase }: PurchaseModalProps) {
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [description, setDescription] = useState(editingPurchase?.description ?? '');
  const [totalAmount, setTotalAmount] = useState(editingPurchase?.totalAmount.toString() ?? '');
  const [installmentsCount, setInstallmentsCount] = useState(editingPurchase?.installmentsCount.toString() ?? '1');
  const [purchaseDate, setPurchaseDate] = useState(editingPurchase?.purchaseDate ?? new Date().toISOString().split('T')[0]);
  const [categoryId, setCategoryId] = useState(editingPurchase?.categoryId ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    api.get('/categories').then((res) => {
      const raw = res.data;
      const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
      setCategories(list);
    }).catch(() => setCategories([]));
  }, []);

  const availableLimit = Number(card.limitAmount) - Number(card.usedLimit);
  const parsedTotal = parseFloat(totalAmount || '0');
  const parsedCount = parseInt(installmentsCount || '1', 10);
  const installmentPreview = parsedCount > 0 ? parsedTotal / parsedCount : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        description,
        totalAmount: parsedTotal,
        installmentsCount: parsedCount,
        purchaseDate,
        categoryId: categoryId || undefined,
      };

      if (editingPurchase) {
        await api.patch(`/cards/purchases/${editingPurchase.installmentGroupId}`, payload);
      } else {
        await api.post(`/cards/${card.id}/purchases`, payload);
      }
      onSuccess();
    } catch (err: any) {
      const msg = err.response?.data?.message;
      alert(Array.isArray(msg) ? msg.join('\n') : msg || 'Erro ao salvar compra.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-md p-6 border border-gray-200 dark:border-zinc-800">
        <div className="flex justify-between items-center mb-1">
          <h2 className="text-xl font-bold dark:text-white">{editingPurchase ? 'Editar compra' : 'Lançar compra'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 font-bold text-lg">
            ✕
          </button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          No cartão <strong>{card.name}</strong> · Disponível: {formatCurrency(availableLimit)}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium dark:text-gray-300 mb-1">Descrição</label>
            <input
              type="text" required placeholder="Ex: Notebook novo"
              value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-transparent dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium dark:text-gray-300 mb-1">Valor total da compra (R$)</label>
            <input
              type="number" step="0.01" required
              value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-transparent dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium dark:text-gray-300 mb-1">Nº de parcelas</label>
              <input
                type="number" min="1" max="48" required
                value={installmentsCount} onChange={(e) => setInstallmentsCount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-transparent dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium dark:text-gray-300 mb-1">Data da compra</label>
              <input
                type="date" required
                value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)}
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

          {parsedTotal > 0 && parsedCount > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-300">
              {parsedCount}x de <strong>{formatCurrency(installmentPreview)}</strong>
              {parsedTotal > availableLimit && (
                <p className="text-red-500 dark:text-red-400 mt-1 font-medium">
                  ⚠️ Valor acima do limite disponível!
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:underline">
              Cancelar
            </button>
            <button
              type="submit" disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              {isSubmitting ? 'Salvando...' : editingPurchase ? 'Salvar alterações' : 'Lançar compra'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}