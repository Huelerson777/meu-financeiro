'use client';

import { useEffect, useState } from 'react';
import { CreditCard, Plus, Pencil, Trash2 } from 'lucide-react';
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
  currentInvoiceOpenTotal?: number | string;
}

const DEFAULT_COLOR = '#8B5CF6';

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
  const [color, setColor] = useState(DEFAULT_COLOR);

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
    setColor(DEFAULT_COLOR);
    setIsModalOpen(true);
  };

  const handleEdit = (c: Card) => {
    setEditingId(c.id);
    setName(c.name);
    setLimitAmount(c.limitAmount.toString());
    setClosingDay(c.closingDay.toString());
    setDueDay(c.dueDay.toString());
    setColor(c.color || DEFAULT_COLOR);
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
          <h1 className="text-3xl font-bold text-foreground">Cartões</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Controle de limites, fechamento/vencimento e compras parceladas.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg font-medium transition shadow flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Novo Cartão
        </button>
      </div>

      {loading ? (
        <div className="text-muted-foreground py-8">Carregando...</div>
      ) : cards.length === 0 ? (
        <div className="bg-card rounded-xl shadow-sm border border-border p-10 flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <CreditCard className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Nenhum cartão cadastrado</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Cadastre seu primeiro cartão para começar a controlar limites e compras parceladas.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((c) => {
            const cardColor = c.color || DEFAULT_COLOR;
            const openInvoice = Number(c.currentInvoiceOpenTotal ?? 0);

            return (
              <div
                key={c.id}
                onClick={() => setInvoiceCard(c)}
                className="bg-card rounded-xl shadow-sm border border-border relative overflow-hidden group p-6 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <div className="absolute top-0 left-0 right-0 h-1.5" style={{ backgroundColor: cardColor }} />
                <div
                  className="absolute -top-10 -right-10 h-32 w-32 rounded-full blur-2xl pointer-events-none"
                  style={{ backgroundColor: `${cardColor}33` }}
                />

                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEdit(c); }}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition"
                    title="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleArchive(c); }}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-danger hover:bg-danger/10 transition"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="relative flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${cardColor}20` }}
                  >
                    <CreditCard className="w-5 h-5" style={{ color: cardColor }} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-foreground truncate">{c.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      Fecha dia {c.closingDay} · Vence dia {c.dueDay}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2.5">
                  <span className="text-sm text-muted-foreground">Próxima fatura em aberto</span>
                  <span className={`font-semibold ${openInvoice > 0 ? 'text-warning' : 'text-success'}`}>
                    {formatCurrency(openInvoice)}
                  </span>
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); setPurchaseCard(c); }}
                  className="mt-3 w-full text-sm font-medium py-2 rounded-lg transition"
                  style={{ backgroundColor: `${cardColor}14`, color: cardColor }}
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
          <div className="bg-card text-card-foreground rounded-xl shadow-xl w-full max-w-md p-6 border border-border">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-foreground">
                {editingId ? 'Editar Cartão' : 'Novo Cartão'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground font-bold text-lg">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Nome do Cartão</label>
                <input
                  type="text" required placeholder="Ex: Nubank, Inter..."
                  value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Limite (R$)</label>
                <input
                  type="number" step="0.01" required
                  value={limitAmount} onChange={(e) => setLimitAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Dia de fechamento</label>
                  <input
                    type="number" min="1" max="31" required
                    value={closingDay} onChange={(e) => setClosingDay(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Dia de vencimento</label>
                  <input
                    type="number" min="1" max="31" required
                    value={dueDay} onChange={(e) => setDueDay(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Cor</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color" value={color} onChange={(e) => setColor(e.target.value)}
                    className="h-10 w-14 p-1 border border-border rounded-lg bg-transparent cursor-pointer shrink-0"
                  />
                  <div
                    className="flex-1 h-10 rounded-lg flex items-center px-3 gap-2 text-sm font-medium"
                    style={{ backgroundColor: `${color}20`, color }}
                  >
                    <CreditCard className="w-4 h-4" />
                    {name || 'Pré-visualização'}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm text-muted-foreground hover:underline">
                  Cancelar
                </button>
                <button
                  type="submit" disabled={isSubmitting}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
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
