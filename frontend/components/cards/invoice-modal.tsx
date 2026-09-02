'use client';

import { useEffect, useState } from 'react';
import { X, Pencil, Trash2, MinusCircle, Repeat } from 'lucide-react';
import { api } from '@/services/api';
import { formatCurrency } from '@/utils/currency';
import { PurchaseModal } from './purchase-modal';
import { RecurringPurchaseModal } from './recurring-purchase-modal';
import { PaymentModal } from './payment-modal';
import { CreditModal } from './credit-modal';

interface InvoiceItem {
  id: string;
  description: string;
  amount: number;
  date: string;
  purchaseDate: string | null;
  createdAt: string;
  category?: { name: string; color: string } | null;
  categoryId?: string | null;
  installmentGroupId: string | null;
  installmentId: string | null;
  paid: boolean;
  paidAt?: string | null;
  paidFromAccountName?: string | null;
  isCredit: boolean;
  cardRecurringPurchaseId: string | null;
}

interface Invoice {
  month: string; // "2026-08"
  total: number;
  openTotal: number;
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

function formatDay(dateStr: string) {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Agrupa os itens (já ordenados pelo backend) em blocos consecutivos do mesmo dia de
// compra. Usa purchaseDate (dia em que a compra de fato aconteceu) em vez de "date"
// (data de vencimento da parcela, sempre o mesmo dia do mês pra toda a fatura).
// Compras lançadas antes desse campo existir não têm purchaseDate — cai pra
// createdAt (dia do lançamento) como aproximação. Créditos/estornos não têm
// purchaseDate (não são parcela) — usam o próprio "date", que pra eles já é a
// data real informada.
function groupItemsByDay(items: InvoiceItem[]) {
  const groups: { day: string; items: InvoiceItem[] }[] = [];
  for (const item of items) {
    const day = formatDay(item.purchaseDate ?? (item.isCredit ? item.date : item.createdAt));
    const last = groups[groups.length - 1];
    if (last && last.day === day) {
      last.items.push(item);
    } else {
      groups.push({ day, items: [item] });
    }
  }
  return groups;
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
    // Gera (de forma idempotente) a cobrança do mês corrente de cada compra
    // recorrente ativa antes de mostrar a fatura, assim como recurring-bills
    // faz no Dashboard.
    api.post('/cards/recurring-purchases/sync').catch(() => {}).finally(fetchInvoices);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);

  const handleDelete = async (item: InvoiceItem) => {
    if (item.isCredit) {
      if (!window.confirm(`Excluir o crédito "${item.description}"?`)) return;
      try {
        await api.delete(`/cards/credits/${item.id}`);
        fetchInvoices();
      } catch (err: any) {
        alert('Erro ao excluir crédito.');
      }
      return;
    }

    if (item.cardRecurringPurchaseId) {
      if (!window.confirm(`Cancelar a assinatura "${item.description}"? As cobranças já geradas continuam, só não gera mais nos próximos meses.`)) return;
      try {
        await api.delete(`/cards/recurring-purchases/${item.cardRecurringPurchaseId}`);
        fetchInvoices();
      } catch (err: any) {
        alert('Erro ao cancelar assinatura.');
      }
      return;
    }

    const { name } = parseInstallmentLabel(item.description);
    if (!window.confirm(`Excluir TODAS as parcelas de "${name}"? Essa ação não pode ser desfeita.`)) return;
    try {
      await api.delete(`/cards/purchases/${item.installmentGroupId}`);
      fetchInvoices();
    } catch (err: any) {
      alert('Erro ao excluir compra.');
    }
  };

  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [payingSelection, setPayingSelection] = useState(false);

  const toggleSelected = (installmentId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(installmentId)) next.delete(installmentId);
      else next.add(installmentId);
      return next;
    });
  };

  const handleSelectMonth = (month: string) => {
    setSelectedMonth(month);
    setSelectedIds(new Set());
  };

  // Clique no botão redondo: parcela paga desfaz o pagamento; parcela em
  // aberto entra/sai da seleção pra pagar (via barra de pagamento em lote,
  // que funciona tanto para 1 quanto para várias parcelas de uma vez).
  const handleCircleClick = async (item: InvoiceItem) => {
    if (!item.installmentId) return;

    if (!item.paid) {
      toggleSelected(item.installmentId);
      return;
    }

    // Desfazer pagamento: devolve o valor pra conta de onde saiu
    if (!window.confirm('Desfazer o pagamento desta parcela? O valor volta para a conta de origem.')) return;
    try {
      await api.patch(`/cards/installments/${item.installmentId}/unpay`);
      fetchInvoices();
    } catch (err: any) {
      const msg = err.response?.data?.message;
      alert(Array.isArray(msg) ? msg.join('\n') : msg || 'Erro ao desfazer pagamento.');
    }
  };

  const [purchaseToEdit, setPurchaseToEdit] = useState<any>(null);
  const [recurringToEdit, setRecurringToEdit] = useState<any>(null);
  const [showCreditModal, setShowCreditModal] = useState(false);

  const handleEditClick = async (item: InvoiceItem) => {
    if (item.cardRecurringPurchaseId) {
      try {
        const res = await api.get(`/cards/${card.id}/recurring-purchases`);
        const raw = res.data;
        const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
        const recurring = list.find((r: any) => r.id === item.cardRecurringPurchaseId);
        if (!recurring) return;
        setRecurringToEdit({
          id: recurring.id,
          description: recurring.description,
          amount: Number(recurring.amount),
          chargeDay: recurring.chargeDay,
          categoryId: recurring.categoryId ?? null,
        });
      } catch {
        alert('Erro ao carregar dados da assinatura para edição.');
      }
      return;
    }

    try {
      const res = await api.get('/transactions', { params: { type: 'EXPENSE', limit: 100 } });
      const raw = res.data;
      const all = Array.isArray(raw?.data?.items) ? raw.data.items
        : Array.isArray(raw?.items) ? raw.items
        : Array.isArray(raw) ? raw
        : [];
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
        // purchaseDate só existe pra compras lançadas depois desse campo existir;
        // pra compras antigas cai pro "date" (vencimento) como aproximação.
        purchaseDate: new Date(earliest.purchaseDate ?? earliest.date).toISOString().split('T')[0],
        categoryId: item.categoryId ?? null,
      });
    } catch {
      alert('Erro ao carregar dados da compra para edição.');
    }
  };

  const currentInvoice = invoices.find((inv) => inv.month === selectedMonth);
  const openItems = currentInvoice?.items.filter((item) => item.installmentId && !item.paid) ?? [];
  const selectedItems = openItems.filter((item) => selectedIds.has(item.installmentId!));
  const selectedTotal = selectedItems.reduce((acc, item) => acc + item.amount, 0);
  const allOpenSelected = openItems.length > 0 && selectedIds.size === openItems.length;

  const toggleSelectAllOpen = () => {
    setSelectedIds(allOpenSelected ? new Set() : new Set(openItems.map((item) => item.installmentId!)));
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col border border-gray-200 dark:border-zinc-800">
        <div className="flex-shrink-0 flex justify-between items-center p-6 pb-4 border-b border-gray-100 dark:border-zinc-800">
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
            <div className="flex-shrink-0 flex gap-2 px-6 py-3 overflow-x-auto border-b border-gray-100 dark:border-zinc-800">
              {invoices.map((inv) => (
                <button
                  key={inv.month}
                  onClick={() => handleSelectMonth(inv.month)}
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
              {openItems.length > 0 && (
                <div className="flex justify-end mb-2">
                  <button
                    type="button"
                    onClick={toggleSelectAllOpen}
                    className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {allOpenSelected ? 'Limpar seleção' : 'Selecionar todas em aberto'}
                  </button>
                </div>
              )}
              {currentInvoice?.items.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                  Nenhum lançamento neste mês.
                </p>
              ) : (
                <div className="flex flex-col gap-4">
                  {groupItemsByDay(currentInvoice?.items ?? []).map((group) => (
                    <div key={group.day} className="flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {group.day}
                        </span>
                        <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-700" />
                      </div>
                      {group.items.map((item) => {
                    const { installmentLabel, name } = parseInstallmentLabel(item.description);
                    return (
                      <div key={item.id} className="flex items-center justify-between gap-3 pb-3 border-b border-gray-50 dark:border-zinc-800 last:border-0 group">
                        <div className="flex items-center gap-3 min-w-0">
                          {item.isCredit ? (
                            <MinusCircle className="flex-shrink-0 w-5 h-5 text-green-500" />
                          ) : item.installmentId && (
                            <button
                              type="button"
                              onClick={() => handleCircleClick(item)}
                              title={
                                item.paid
                                  ? 'Desfazer pagamento'
                                  : selectedIds.has(item.installmentId)
                                    ? 'Remover da seleção'
                                    : 'Selecionar para pagar'
                              }
                              className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
                                item.paid
                                  ? 'bg-green-500 border-green-500 text-white'
                                  : selectedIds.has(item.installmentId)
                                    ? 'bg-blue-600 border-blue-600 text-white'
                                    : 'border-gray-300 dark:border-zinc-600 text-transparent hover:border-blue-400'
                              }`}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3">
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                            </button>
                          )}
                          <div className="flex flex-col min-w-0">
                            <span className={`text-sm font-medium truncate ${item.isCredit ? 'text-green-600 dark:text-green-400' : item.paid ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-800 dark:text-gray-100'}`}>
                              {installmentLabel && (
                                <span className="text-blue-600 dark:text-blue-400 font-semibold mr-1.5">
                                  {installmentLabel}
                                </span>
                              )}
                              {item.cardRecurringPurchaseId && (
                                <Repeat
                                  className="inline-block w-3 h-3 mr-1 mb-0.5 text-purple-500"
                                  aria-label="Assinatura recorrente"
                                />
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
                            {item.paid && item.paidFromAccountName && (
                              <span className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                                Pago com {item.paidFromAccountName}
                                {item.paidAt && ` em ${new Date(item.paidAt).toLocaleDateString('pt-BR')}`}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className={`text-sm font-semibold whitespace-nowrap ${item.isCredit ? 'text-green-600 dark:text-green-400' : item.paid ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-800 dark:text-gray-100'}`}>
                            {formatCurrency(item.amount)}
                          </span>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!item.isCredit && (
                              <button
                                onClick={() => handleEditClick(item)}
                                title={item.cardRecurringPurchaseId ? 'Editar assinatura' : 'Editar todas as parcelas desta compra'}
                                className="text-gray-400 hover:text-blue-500"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(item)}
                              title={
                                item.isCredit
                                  ? 'Excluir este crédito'
                                  : item.cardRecurringPurchaseId
                                    ? 'Cancelar assinatura'
                                    : 'Excluir todas as parcelas desta compra'
                              }
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
                  ))}
                </div>
              )}
            </div>

            {/* Barra de ação para pagamento em lote */}
            {selectedIds.size > 0 && (
              <div className="flex-shrink-0 flex items-center justify-between gap-3 px-6 py-3 border-t border-gray-100 dark:border-zinc-800 bg-blue-50 dark:bg-blue-950/30">
                <span className="text-sm text-gray-700 dark:text-gray-200">
                  {selectedItems.length} selecionada{selectedItems.length > 1 ? 's' : ''} · {formatCurrency(selectedTotal)}
                </span>
                <button
                  onClick={() => setPayingSelection(true)}
                  className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
                >
                  {selectedItems.length > 1 ? 'Pagar selecionadas' : 'Pagar selecionada'}
                </button>
              </div>
            )}

            {/* Total da fatura do mês */}
            <div className="flex-shrink-0 flex flex-col gap-3 p-6 pt-4 border-t border-gray-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowCreditModal(true)}
                disabled={!selectedMonth}
                className="self-start text-xs font-medium text-green-600 dark:text-green-400 hover:underline disabled:opacity-50"
              >
                + Lançar crédito / estorno nesta fatura
              </button>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Total da fatura {currentInvoice ? formatMonth(currentInvoice.month) : ''}
                </span>
                <span className="text-lg font-bold text-gray-800 dark:text-gray-100">
                  {formatCurrency(currentInvoice?.total ?? 0)}
                </span>
              </div>
              {currentInvoice && currentInvoice.openTotal > 0 && (
                <button
                  onClick={() => setPayingInvoice(currentInvoice)}
                  className="w-full bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2.5 rounded-lg transition"
                >
                  Pagar fatura total em aberto ({formatCurrency(currentInvoice.openTotal)})
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {showCreditModal && selectedMonth && (
        <CreditModal
          card={card}
          defaultDate={`${selectedMonth}-01`}
          onClose={() => setShowCreditModal(false)}
          onSuccess={() => {
            setShowCreditModal(false);
            fetchInvoices();
          }}
        />
      )}

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

      {recurringToEdit && (
        <RecurringPurchaseModal
          card={card}
          editingRecurring={recurringToEdit}
          onClose={() => setRecurringToEdit(null)}
          onSuccess={() => {
            setRecurringToEdit(null);
            fetchInvoices();
          }}
        />
      )}

      {payingInvoice && (
        <PaymentModal
          title="Pagar fatura total"
          description={`${card.name} · ${formatMonth(payingInvoice.month)}`}
          amount={payingInvoice.openTotal}
          onClose={() => setPayingInvoice(null)}
          onSuccess={() => {
            setPayingInvoice(null);
            fetchInvoices();
          }}
          onConfirm={(accountId, date) =>
            api.post(`/cards/${card.id}/invoices/pay`, { accountId, date, month: payingInvoice.month }).then(() => {})
          }
        />
      )}

      {payingSelection && (
        <PaymentModal
          title={selectedItems.length > 1 ? 'Pagar selecionadas' : 'Pagar selecionada'}
          description={`${selectedItems.length} lançamento${selectedItems.length > 1 ? 's' : ''} selecionado${selectedItems.length > 1 ? 's' : ''}`}
          amount={selectedTotal}
          onClose={() => setPayingSelection(false)}
          onSuccess={() => {
            setPayingSelection(false);
            setSelectedIds(new Set());
            fetchInvoices();
          }}
          onConfirm={(accountId, date) =>
            api.patch('/cards/installments/pay-batch', {
              installmentIds: selectedItems.map((item) => item.installmentId!),
              accountId,
              date,
            }).then(() => {})
          }
        />
      )}
    </div>
  );
}