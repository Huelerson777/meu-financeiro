'use client';

import { useEffect, useState } from 'react';
import { CreditCard, Plus } from 'lucide-react';
import { api } from '@/services/api';
import { formatCurrency } from '@/utils/currency';
import { PurchaseModal } from '@/components/cards/purchase-modal';
import { InvoiceModal } from '@/components/cards/invoice-modal';

interface Card {
  id: string;
  name: string;
  limitAmount: number | string;
  usedLimit: number | string;
  closingDay: number;
  dueDay: number;
  color?: string;
}

export default function CardsPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [purchaseCard, setPurchaseCard] = useState<Card | null>(null);
  const [invoiceCard, setInvoiceCard] = useState<Card | null>(null);

  const [name, setName] = useState('');
  const [limitAmount, setLimitAmount] = useState('');
  const [closingDay, setClosingDay] = useState('10');
  const [dueDay, setDueDay] = useState('17');
  const [color, setColor] = useState('#8B5CF6');

  const extractList = (raw: any): Card[] => {
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.data)) return raw.data;
    return [];
  };

  const fetchCards = async () => {
    try {
      const res = await api.get('/cards');
      setCards(extractList(res.data));
    } catch {
      setCards([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenCreate = () => {
    setEditingId(null);
    setName('');
    setLimitAmount('');
    setClosingDay('10');
    setDueDay('17');
    setColor('#8B5CF6');
    setIsModalOpen(true);
  };

  const handleEdit = (c: Card) => {
    setEditingId(c.id);
    setName(c.name);
    setLimitAmount(c.limitAmount.toString());
    setClosingDay(c.closingDay.toString());
    setDueDay(c.dueDay.toString());
    setColor(c.color || '#8B5CF6');
    setIsModalOpen(true);
  };

  const handleArchive = async (c: Card) => {
    if (!window.confirm(`Excluir o cartão "${c.name}"?`)) return;
    try {
      await api.delete(`/cards/${c.id}`);
      fetchCards();
    } catch {
      alert('Erro ao excluir cartão.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        name,
        limitAmount: parseFloat(limitAmount || '0'),
        closingDay: parseInt(closingDay, 10),
        dueDay: parseInt(dueDay, 10),
        color,
      };

      if (editingId) {
        await api.patch(`/cards/${editingId}`, payload);
      } else {
        await api.post('/cards', payload);
      }

      setIsModalOpen(false);
      fetchCards();
    } catch (err: any) {
      const msg = err.response?.data?.message;
      alert(Array.isArray(msg) ? msg.join('\n') : msg || 'Erro ao salvar cartão.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold dark:text-white">Cartões</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Controle de limites, fechamento/vencimento e compras parceladas.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition shadow flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Novo Cartão
        </button>
      </div>

      {loading ? (
        <div className="text-gray-500 py-8">Carregando...</div>
      ) : cards.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow border border-gray-100 dark:border-zinc-800 p-10 flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
            <CreditCard className="w-7 h-7 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-lg font-semibold dark:text-white">Nenhum cartão cadastrado</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
            Cadastre seu primeiro cartão para começar a controlar limites e compras parceladas.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((c) => {
            const limit = Number(c.limitAmount);
            const used = Number(c.usedLimit);
            const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
            const available = limit - used;

            return (
              <div
                key={c.id}
                onClick={() => setInvoiceCard(c)}
                className="bg-white dark:bg-zinc-900 rounded-xl shadow border border-gray-100 dark:border-zinc-800 relative overflow-hidden group p-6 cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: c.color || '#8B5CF6' }} />

                <div className="absolute top-4 right-4 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); handleEdit(c); }} className="text-gray-400 hover:text-blue-500 text-sm font-medium">
                    Editar
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleArchive(c); }} className="text-gray-400 hover:text-red-500 text-sm font-medium">
                    Excluir
                  </button>
                </div>

                <h3 className="text-xl font-bold dark:text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5" style={{ color: c.color || '#8B5CF6' }} />
                  {c.name}
                </h3>

                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Fecha dia {c.closingDay} · Vence dia {c.dueDay}
                </p>

                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-500 dark:text-gray-400">Limite usado</span>
                    <span className="font-semibold dark:text-white">{formatCurrency(used)} / {formatCurrency(limit)}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: pct > 90 ? '#dc2626' : (c.color || '#8B5CF6') }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Disponível: {formatCurrency(available)}
                  </p>
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); setPurchaseCard(c); }}
                  className="mt-4 w-full bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 text-sm font-medium py-2 rounded-lg transition"
                >
                  + Lançar compra parcelada
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Criar/Editar Cartão */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-md p-6 border border-gray-200 dark:border-zinc-800">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold dark:text-white">
                {editingId ? 'Editar Cartão' : 'Novo Cartão'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-700 font-bold text-lg">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">Nome do Cartão</label>
                <input
                  type="text" required placeholder="Ex: Nubank, Inter..."
                  value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-transparent dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">Limite (R$)</label>
                <input
                  type="number" step="0.01" required
                  value={limitAmount} onChange={(e) => setLimitAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-transparent dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium dark:text-gray-300 mb-1">Dia de fechamento</label>
                  <input
                    type="number" min="1" max="31" required
                    value={closingDay} onChange={(e) => setClosingDay(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-transparent dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium dark:text-gray-300 mb-1">Dia de vencimento</label>
                  <input
                    type="number" min="1" max="31" required
                    value={dueDay} onChange={(e) => setDueDay(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-transparent dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">Cor</label>
                <input
                  type="color" value={color} onChange={(e) => setColor(e.target.value)}
                  className="w-full h-10 p-1 border border-gray-300 dark:border-zinc-700 rounded-lg bg-transparent cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm text-gray-500 hover:underline">
                  Cancelar
                </button>
                <button
                  type="submit" disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Criar Cartão'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Lançar Compra Parcelada */}
      {purchaseCard && (
        <PurchaseModal
          card={purchaseCard}
          onClose={() => setPurchaseCard(null)}
          onSuccess={() => {
            setPurchaseCard(null);
            fetchCards();
          }}
        />
      )}

      {/* Modal Fatura por Mês */}
      {invoiceCard && (
        <InvoiceModal
          card={invoiceCard}
          onClose={() => setInvoiceCard(null)}
        />
      )}
    </div>
  );
}