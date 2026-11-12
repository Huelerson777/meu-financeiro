'use client';

import { notifyAlert, confirmDialog } from '@/utils/notify';
import { useEffect, useState } from 'react';
import { CreditCard, Plus, Pencil, Trash2 } from 'lucide-react';
import { LogoField } from '@/components/accounts/logo-field';
import { AccountAvatar } from '@/components/accounts/account-avatar';
import { isImageIcon } from '@/utils/image-resize';
import { api } from '@/services/api';
import { formatCurrency } from '@/utils/currency';
import { Ring } from '@/components/ui/ring';
import { Story, Dim } from '@/components/ui/story';
import { Money } from '@/components/dashboard/month-story';
import { PurchaseModal } from '@/components/cards/purchase-modal';
import { RecurringPurchaseModal } from '@/components/cards/recurring-purchase-modal';
import { InvoiceModal } from '@/components/cards/invoice-modal';

interface Card {
  id: string;
  name: string;
  limitAmount: number | string;
  usedLimit: number | string;
  closingDay: number;
  dueDay: number;
  color?: string;
  icon?: string;
  paymentAccountId?: string | null;
  currentInvoiceOpenTotal?: number | string;
}

interface AccountOption {
  id: string;
  name: string;
  type: string;
  color?: string;
  icon?: string;
}

const DEFAULT_COLOR = '#8B5CF6';

export function CardsView() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [purchaseCard, setPurchaseCard] = useState<Card | null>(null);
  const [recurringCard, setRecurringCard] = useState<Card | null>(null);
  const [invoiceCard, setInvoiceCard] = useState<Card | null>(null);

  const [name, setName] = useState('');
  const [limitAmount, setLimitAmount] = useState('');
  const [closingDay, setClosingDay] = useState('10');
  const [dueDay, setDueDay] = useState('17');
  const [color, setColor] = useState(DEFAULT_COLOR);
  // logo: undefined = sem mudança | string = nova imagem | null = remover
  const [logo, setLogo] = useState<string | null | undefined>(undefined);
  const [currentIcon, setCurrentIcon] = useState<string | undefined>(undefined);
  const [paymentAccountId, setPaymentAccountId] = useState<string>('');
  const [accounts, setAccounts] = useState<AccountOption[]>([]);

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
    // Gera (de forma idempotente) a cobrança do mês corrente de cada compra
    // recorrente ativa assim que a lista de cartões é aberta — sem isso, só
    // aconteceria ao entrar na fatura de cada cartão individualmente.
    api.post('/cards/recurring-purchases/sync').catch(() => {}).finally(fetchCards);
    api
      .get('/accounts')
      .then((res) => {
        const raw = res.data;
        const list: AccountOption[] = Array.isArray(raw?.data?.items) ? raw.data.items : Array.isArray(raw?.items) ? raw.items : Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : [];
        setAccounts(list.filter((a) => a.type !== 'INVESTMENT'));
      })
      .catch(() => setAccounts([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenCreate = () => {
    setLogo(undefined);
    setCurrentIcon(undefined);
    setEditingId(null);
    setName('');
    setLimitAmount('');
    setClosingDay('10');
    setDueDay('17');
    setColor(DEFAULT_COLOR);
    setPaymentAccountId('');
    setIsModalOpen(true);
  };

  const handleEdit = (c: Card) => {
    setEditingId(c.id);
    setName(c.name);
    setLimitAmount(c.limitAmount.toString());
    setClosingDay(c.closingDay.toString());
    setDueDay(c.dueDay.toString());
    setColor(c.color || DEFAULT_COLOR);
    setLogo(undefined);
    setCurrentIcon(c.icon);
    setPaymentAccountId(c.paymentAccountId ?? '');
    setIsModalOpen(true);
  };

  const handleArchive = async (c: Card) => {
    if (!(await confirmDialog(`Excluir o cartão "${c.name}"?`))) return;
    try {
      await api.delete(`/cards/${c.id}`);
      fetchCards();
    } catch {
      notifyAlert('Erro ao excluir cartão.');
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
        paymentAccountId: paymentAccountId || null,
        ...(logo !== undefined ? { icon: logo } : {}),
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
      notifyAlert(Array.isArray(msg) ? msg.join('\n') : msg || 'Erro ao salvar cartão.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openInvoicesTotal = cards.reduce((sum, c) => sum + Number(c.currentInvoiceOpenTotal ?? 0), 0);
  const usedLimitTotal = cards.reduce((sum, c) => sum + Number(c.usedLimit ?? 0), 0);
  const limitTotal = cards.reduce((sum, c) => sum + Number(c.limitAmount ?? 0), 0);

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          {cards.length === 0 ? (
            <Story>
              Controle limites, fechamento e compras parceladas. <Dim>Cadastre seu primeiro cartão.</Dim>
            </Story>
          ) : (
            <Story>
              <Dim>As próximas faturas somam</Dim> <Money value={openInvoicesTotal} className="text-warning" />
              <Dim>. Você usa</Dim> <Money value={usedLimitTotal} /> <Dim>de</Dim> <Money value={limitTotal} />{' '}
              <Dim>de limite.</Dim>
            </Story>
          )}
        </div>
        <button
          onClick={handleOpenCreate}
          className="btn-sheen inline-flex h-10 w-fit shrink-0 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.18),0_6px_14px_-6px_hsl(var(--primary)/0.55)] transition-theme hover:-translate-y-px hover:brightness-110 active:scale-[0.97]"
        >
          <Plus className="h-4 w-4" /> Novo cartão
        </button>
      </div>

      {loading ? (
        <div className="text-muted-foreground py-8">Carregando...</div>
      ) : cards.length === 0 ? (
        <div className="rounded-[1.75rem] bg-foreground/[0.03] p-10 flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <CreditCard className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Nenhum cartão cadastrado</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Cadastre seu primeiro cartão para começar a controlar limites e compras parceladas.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {cards.map((c) => {
            const cardColor = c.color || DEFAULT_COLOR;
            const openInvoice = Number(c.currentInvoiceOpenTotal ?? 0);
            const limit = Number(c.limitAmount ?? 0);
            const used = Number(c.usedLimit ?? 0);
            const usedPct = limit > 0 ? used / limit : 0;
            const payer = c.paymentAccountId ? accounts.find((a) => a.id === c.paymentAccountId)?.name : undefined;

            return (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => setInvoiceCard(c)}
                onKeyDown={(e) => { if (e.key === 'Enter') setInvoiceCard(c); }}
                className="group relative flex cursor-pointer gap-4 rounded-[1.75rem] bg-foreground/[0.03] p-5 transition-colors hover:bg-foreground/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:p-6"
              >
                {/* Anel = limite usado; a cor do cartão aparece no traço */}
                <Ring value={usedPct} size={72} thickness={6} color={usedPct >= 0.9 ? 'hsl(var(--danger))' : usedPct >= 0.7 ? 'hsl(var(--warning))' : cardColor} aria-label={`${Math.round(usedPct * 100)}% do limite usado`}>
                  {isImageIcon(c.icon) ? (
                    <AccountAvatar name={c.name} color={cardColor} icon={c.icon} className="h-9 w-9 rounded-full" />
                  ) : (
                    <>
                      <span className="font-num text-base font-bold leading-none">{Math.round(usedPct * 100)}%</span>
                      <span className="mt-0.5 text-[10px] text-muted-foreground">do limite</span>
                    </>
                  )}
                </Ring>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display min-w-0 break-words text-lg font-bold leading-tight tracking-tight">{c.name}</h3>
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="-mr-2 -mt-1 flex shrink-0 gap-0.5 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:opacity-0"
                    >
                      <button onClick={() => handleEdit(c)} aria-label={`Editar ${c.name}`} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-theme hover:bg-primary/10 hover:text-primary">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleArchive(c)} aria-label={`Excluir ${c.name}`} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-theme hover:bg-danger/10 hover:text-danger">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* A fatura contada numa linha, em vez de caixinhas separadas */}
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {openInvoice > 0 ? (
                      <>
                        Fatura de <span className="font-num font-semibold text-warning">{formatCurrency(openInvoice)}</span>, fecha dia {c.closingDay} e vence dia {c.dueDay}
                      </>
                    ) : (
                      <>
                        <span className="font-semibold text-success">Nada em aberto</span> · fecha dia {c.closingDay}, vence dia {c.dueDay}
                      </>
                    )}
                    {payer && <> · paga com {payer}</>}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <span className="font-num font-semibold text-foreground">{formatCurrency(Math.max(0, limit - used))}</span> disponíveis de {formatCurrency(limit)}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setPurchaseCard(c); }}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-theme active:scale-[0.97]"
                      style={{ backgroundColor: `${cardColor}1f`, color: cardColor }}
                    >
                      <Plus className="h-4 w-4" /> Compra
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setRecurringCard(c); }}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-muted-foreground transition-theme hover:bg-foreground/[0.06] hover:text-foreground active:scale-[0.97]"
                    >
                      <Plus className="h-4 w-4" /> Recorrente
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Criar/Editar Cartão */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-end justify-center z-50 sm:items-center sm:p-4">
        <div className="bg-card text-card-foreground rounded-t-2xl sm:rounded-xl shadow-xl w-full max-w-md p-6 border border-border animate-rise max-h-[92dvh] overflow-y-auto sm:max-h-[90vh]">
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
                <label className="block text-sm font-medium text-muted-foreground mb-1">Conta que paga a fatura</label>
                <select
                  value={paymentAccountId}
                  onChange={(e) => setPaymentAccountId(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                >
                  <option value="">Escolher na hora de pagar</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Vem marcada ao pagar a fatura ou uma parcela. Dá pra trocar na hora.
                </p>
              </div>

              <LogoField name={name} color={color} currentIcon={currentIcon} value={logo} onChange={setLogo} />

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
                  className="bg-primary hover:brightness-110 hover:-translate-y-px active:scale-[0.97] btn-sheen text-primary-foreground px-5 py-2 rounded-md text-sm font-medium transition disabled:opacity-50"
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

      {/* Modal Lançar Compra Recorrente */}
      {recurringCard && (
        <RecurringPurchaseModal
          card={recurringCard}
          onClose={() => setRecurringCard(null)}
          onSuccess={() => {
            setRecurringCard(null);
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
