'use client';

import { notifyAlert } from '@/utils/notify';
import { useEffect, useRef, useState } from 'react';
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
  const [amountMode, setAmountMode] = useState<'total' | 'installment'>('total');
  const [amountValue, setAmountValue] = useState(editingPurchase?.totalAmount.toString() ?? '');
  const [installmentsCount, setInstallmentsCount] = useState(editingPurchase?.installmentsCount.toString() ?? '1');
  const [purchaseDate, setPurchaseDate] = useState(editingPurchase?.purchaseDate ?? new Date().toISOString().split('T')[0]);
  const [categoryId, setCategoryId] = useState(editingPurchase?.categoryId ?? '');
  const [categoryAutoSuggested, setCategoryAutoSuggested] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const suggestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api.get('/categories').then((res) => {
      const raw = res.data;
      const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
      setCategories(list);
    }).catch(() => setCategories([]));
  }, []);

  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    if (suggestTimeoutRef.current) clearTimeout(suggestTimeoutRef.current);
    if (editingPurchase || value.trim().length < 3) return;

    suggestTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await api.get('/transactions/suggest-category', { params: { description: value } });
        const suggestion = res.data?.data ?? res.data;
        if (suggestion?.categoryId && (categoryId === '' || categoryAutoSuggested)) {
          setCategoryId(suggestion.categoryId);
          setCategoryAutoSuggested(true);
        }
      } catch {
        // silencioso — sugestão é um "nice to have", não pode travar o formulário
      }
    }, 500);
  };

  const handleCategoryChange = (value: string) => {
    setCategoryId(value);
    setCategoryAutoSuggested(false);
  };

  const availableLimit = Number(card.limitAmount) - Number(card.usedLimit);
  const parsedAmount = parseFloat(amountValue || '0');
  const parsedCount = parseInt(installmentsCount || '1', 10);
  const parsedTotal = amountMode === 'installment' ? parsedAmount * parsedCount : parsedAmount;
  const installmentPreview = amountMode === 'installment' ? parsedAmount : (parsedCount > 0 ? parsedTotal / parsedCount : 0);

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
      notifyAlert(Array.isArray(msg) ? msg.join('\n') : msg || 'Erro ao salvar compra.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-end justify-center z-50 sm:items-center sm:p-4">
        <div className="bg-card rounded-t-2xl sm:rounded-xl shadow-xl w-full max-w-md p-6 border border-border animate-rise max-h-[92dvh] overflow-y-auto sm:max-h-[90vh]">
        <div className="flex justify-between items-center mb-1">
          <h2 className="text-xl font-bold">{editingPurchase ? 'Editar compra' : 'Lançar compra'}</h2>
          <button onClick={onClose} className="text-foreground hover:text-foreground/80 font-bold text-lg">
            ✕
          </button>
        </div>
        <p className="text-sm text-foreground mb-5">
          No cartão <strong>{card.name}</strong> · Disponível: {formatCurrency(availableLimit)}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Descrição</label>
            <input
              type="text" required placeholder="Ex: Notebook novo"
              value={description} onChange={(e) => handleDescriptionChange(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg bg-transparent"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium">
                {amountMode === 'total' ? 'Valor total da compra (R$)' : 'Valor de cada parcela (R$)'}
              </label>
              <div className="flex gap-1 p-0.5 bg-muted rounded-md">
                <button
                  type="button"
                  onClick={() => setAmountMode('total')}
                  className={`px-2 py-0.5 text-xs font-medium rounded transition ${amountMode === 'total' ? 'bg-card shadow text-foreground' : 'text-foreground'}`}
                >
                  Total
                </button>
                <button
                  type="button"
                  onClick={() => setAmountMode('installment')}
                  className={`px-2 py-0.5 text-xs font-medium rounded transition ${amountMode === 'installment' ? 'bg-card shadow text-foreground' : 'text-foreground'}`}
                >
                  Por parcela
                </button>
              </div>
            </div>
            <input
              type="number" step="0.01" required placeholder={amountMode === 'installment' ? 'Ex: 10,00' : undefined}
              value={amountValue} onChange={(e) => setAmountValue(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg bg-transparent"
            />
            {amountMode === 'installment' && parsedCount > 0 && parsedAmount > 0 && (
              <p className="text-xs text-foreground mt-1">
                Total da compra: {formatCurrency(parsedTotal)} ({parsedCount}x de {formatCurrency(parsedAmount)})
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Nº de parcelas</label>
              <input
                type="number" min="1" max="48" required
                value={installmentsCount} onChange={(e) => setInstallmentsCount(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg bg-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Data da compra</label>
              <input
                type="date" required
                value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg bg-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Categoria
              {categoryAutoSuggested && categoryId && (
                <span className="ml-1 text-xs font-normal text-primary">· sugerida</span>
              )}
            </label>
            <select
              value={categoryId} onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg bg-card"
            >
              <option value="">Sem categoria</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {parsedTotal > 0 && parsedCount > 0 && (
            <div className="bg-primary/10 rounded-lg p-3 text-sm text-primary">
              {parsedCount}x de <strong>{formatCurrency(installmentPreview)}</strong>
              {parsedTotal > availableLimit && (
                <p className="text-danger mt-1 font-medium">
                  ⚠️ Valor acima do limite disponível!
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-foreground hover:underline">
              Cancelar
            </button>
            <button
              type="submit" disabled={isSubmitting}
              className="bg-primary hover:brightness-110 active:scale-[0.97] text-primary-foreground px-5 py-2 rounded-md text-sm font-medium transition disabled:opacity-50"
            >
              {isSubmitting ? 'Salvando...' : editingPurchase ? 'Salvar alterações' : 'Lançar compra'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}