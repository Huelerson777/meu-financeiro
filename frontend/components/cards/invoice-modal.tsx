'use client';

import { useEffect, useState } from 'react';
import { X, Pencil, Trash2 } from 'lucide-react';
import { api } from '@/services/api';
import { formatCurrency } from '@/utils/currency';
import { PurchaseModal } from './purchase-modal';

interface InvoiceItem {
  id: string;
  description: string;
  amount: number;
  date: string;
  category?: { name: string; color: string } | null;
  categoryId?: string | null;
  installmentGroupId: string;
}

interface Invoice {
  month: string; // "2026-08"
  total: number;
  items: InvoiceItem[];
}

interface Card {
  id: string;
  name: string;
  color?: string;
}

interface InvoiceModalProps {
  card: Card;
  onClose: () => void;
}

const MONTH_LABELS: Record<string, string> = {
  '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
  '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
  '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro',
};

function formatMonth(key: string) {
  const [year, month] = key.split('-');
  return `${MONTH_LABELS[month] ?? month} de ${year}`;
}

// Extrai "5/12 - Seguro carro" a partir de "Seguro carro (5/12)"
function parseInstallmentLabel(description: string) {
  const match = description.match(/^(.*)\s\((\d+)\/(\d+)\)$/);
  if (!match) return { installmentLabel: null, name: description };
  const [, name, current, total] = match;
  return { installmentLabel: `${current}/${total}`, name };
}

export function InvoiceModal({ card, onClose }: InvoiceModalProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const fetchInvoices = () => {
    setLoading(true);
    api.get(`/cards/${card.id}/invoices`)
      .then((res) => {
        const raw = res.data;
        const list: Invoice[] = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
        setInvoices(list);
        const now = new Date();
        const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const hasCurrentMonth = list.some((inv) => inv.month === currentKey);
        setSelectedMonth((prev) => prev ?? (hasCurrentMonth ? currentKey : list[0]?.month ?? null));
      })
      .catch(() => setInvoices([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);

  const handleDelete = async (item: InvoiceItem) => {
    const { name } = parseInstallmentLabel(item.description);
    if (!window.confirm(`Excluir TODAS as parcelas de "${name}"? Essa ação não pode ser desfeita.`)) return;
    try {
      await api.delete(`/cards/purchases/${item.installmentGroupId}`);
      fetchInvoices();
    } catch (err: any) {
      alert('Erro ao excluir compra.');
    }
  };

  const [purchaseToEdit, setPurchaseToEdit] = useState<any>(null);

  const handleEditClick = async (item: InvoiceItem) => {
    try {
      const res = await api.get('/transactions');
      const raw = res.data;
      const all = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
      const group = all.filter((t: any) => t.installmentGroupId === item.installmentGroupId);
      if (group.length === 0) return;

      const totalAmount = group.reduce((acc: number, t: any) => acc + Number(t.amount), 0);
      const earliest = group.reduce((a: any, b: any) => (new Date(a.date) < new Date(b.date) ? a : b));
      const { name } = parseInstallmentLabel(item.description);

      setPurchaseToEdit({
        installmentGroupId: item.installmentGroupId,
        description: name,
        totalAmount,
        installmentsCount: group.length,
        purchaseDate: new Date(earliest.date).toISOString().split('T')[0],
        categoryId: item.categoryId ?? null,
      });
    } catch {
      alert('Erro ao carregar dados da compra para edição.');
    }
  };

  const currentInvoice = invoices.find((inv) => inv.month === selectedMonth);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col border border-gray-200 dark:border-zinc-800">
        <div className="flex justify-between items-center p-6 pb-4 border-b border-gray-100 dark:border-zinc-800">
          <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: card.color || '#8B5CF6' }} />
            {card.name}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-10">Carregando...</p>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-10">
            Nenhuma compra lançada neste cartão ainda.
          </p>
        ) : (
          <>
            {/* Abas de mês */}
            <div className="flex gap-2 px-6 py-3 overflow-x-auto border-b border-gray-100 dark:border-zinc-800">
              {invoices.map((inv) => (
                <button
                  key={inv.month}
                  onClick={() => setSelectedMonth(inv.month)}
                  className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium transition ${
                    selectedMonth === inv.month
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {formatMonth(inv.month)}
                </button>
              ))}
            </div>

            {/* Lista de parcelas do mês selecionado */}
            <div className="overflow-y-auto flex-1 p-6 pt-4">
              {currentInvoice?.items.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                  Nenhum lançamento neste mês.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {currentInvoice?.items.map((item) => {
                    const { installmentLabel, name } = parseInstallmentLabel(item.description);
                    return (
                      <div key={item.id} className="flex items-center justify-between gap-3 pb-3 border-b border-gray-50 dark:border-zinc-800 last:border-0 group">
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                            {installmentLabel && (
                              <span className="text-blue-600 dark:text-blue-400 font-semibold mr-1.5">
                                {installmentLabel}
                              </span>
                            )}
                            {name}
                          </span>
                          {item.category && (
                            <span
                              className="mt-1 inline-flex w-fit items-center text-xs font-normal px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: `${item.category.color}20`, color: item.category.color }}
                            >
                              {item.category.name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap">
                            {formatCurrency(item.amount)}
                          </span>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleEditClick(item)}
                              title="Editar todas as parcelas desta compra"
                              className="text-gray-400 hover:text-blue-500"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(item)}
                              title="Excluir todas as parcelas desta compra"
                              className="text-gray-400 hover:text-red-500"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Total da fatura do mês */}
            <div className="flex justify-between items-center p-6 pt-4 border-t border-gray-100 dark:border-zinc-800">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Total da fatura {currentInvoice ? formatMonth(currentInvoice.month) : ''}
              </span>
              <span className="text-lg font-bold text-gray-800 dark:text-gray-100">
                {formatCurrency(currentInvoice?.total ?? 0)}
              </span>
            </div>
          </>
        )}
      </div>

      {purchaseToEdit && (
        <PurchaseModal
          card={card as any}
          editingPurchase={purchaseToEdit}
          onClose={() => setPurchaseToEdit(null)}
          onSuccess={() => {
            setPurchaseToEdit(null);
            fetchInvoices();
          }}
        />
      )}
    </div>
  );
}