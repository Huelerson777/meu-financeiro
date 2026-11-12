'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '@/services/api';
import { formatCurrency } from '@/utils/currency';
import { todayLocalISO } from '@/utils/date';
import { notifyAlert } from '@/utils/notify';
import { AccountAvatar } from '@/components/accounts/account-avatar';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';

interface AccountOption {
  id: string;
  name: string;
  type?: string;
  color?: string;
  icon?: string;
}

interface PaymentModalProps {
  title: string;
  description?: string;
  amount: number;
  category?: { name: string; color: string } | null;
  amountEditable?: boolean;
  /** 'receive' troca os textos para recebimento (salário, receita prevista). */
  kind?: 'pay' | 'receive';
  /**
   * Conta que já vem marcada: a do lançamento, ou a conta vinculada ao cartão
   * no caso de fatura/parcela. Sem ela, a primeira conta que não é de investimento.
   */
  defaultAccountId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
  onConfirm: (accountId: string, date: string, amount: number) => Promise<void>;
}

const extractList = (raw: any): AccountOption[] => {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.data?.items)) return raw.data.items;
  if (Array.isArray(raw?.items)) return raw.items;
  return [];
};

const fieldClass =
  'h-11 w-full rounded-xl border border-input bg-card px-3.5 text-sm transition-theme hover:border-foreground/25 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15';

export function PaymentModal({
  title,
  description,
  amount,
  category,
  amountEditable,
  kind = 'pay',
  defaultAccountId,
  onClose,
  onSuccess,
  onConfirm,
}: PaymentModalProps) {
  const receive = kind === 'receive';
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState(todayLocalISO());
  const [amountValue, setAmountValue] = useState(amount.toString());
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    api.get('/accounts').then((res) => {
      const list = extractList(res.data);
      // Contas do dia a dia primeiro; investimento vai pro fim
      list.sort((a, b) => Number(a.type === 'INVESTMENT') - Number(b.type === 'INVESTMENT'));
      setAccounts(list);
      // Conta de investimento só vem marcada se for a única: pagar uma conta
      // por ela tira o gasto das despesas do mês (o Início ignora essas contas).
      const preferred = list.find((a) => a.id === defaultAccountId) ?? list.find((a) => a.type !== 'INVESTMENT') ?? list[0];
      if (preferred) setAccountId(preferred.id);
    }).catch(() => setAccounts([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId) {
      notifyAlert(receive ? 'Selecione a conta onde o dinheiro entrou.' : 'Selecione a conta de onde vai sair o pagamento.');
      return;
    }
    const parsedAmount = parseFloat(amountValue);
    if (!parsedAmount || parsedAmount <= 0) {
      notifyAlert('Informe um valor válido.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onConfirm(accountId, date, parsedAmount);
      onSuccess();
    } catch (err: any) {
      const msg = err.response?.data?.message;
      notifyAlert(Array.isArray(msg) ? msg.join('\n') : msg || (receive ? 'Erro ao registrar recebimento.' : 'Erro ao registrar pagamento.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[92dvh] w-full max-w-md animate-rise overflow-y-auto rounded-t-[1.75rem] border border-border bg-card p-5 shadow-xl sm:max-h-[90vh] sm:rounded-[1.75rem]"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold tracking-tight">{title}</h2>
            {description && (
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="truncate">{description}</span>
                {category && (
                  <span className="inline-flex items-center gap-1 text-xs">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: category.color }} />
                    {category.name}
                  </span>
                )}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-theme hover:bg-foreground/[0.06] hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-5">
          {amountEditable ? (
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-muted-foreground">{receive ? 'Valor recebido (R$)' : 'Valor pago (R$)'}</span>
              <input
                type="number" step="0.01" min="0" inputMode="decimal" required
                value={amountValue} onChange={(e) => setAmountValue(e.target.value)}
                className={`${fieldClass} font-num text-base font-semibold`}
              />
            </label>
          ) : (
            <div className="flex items-center justify-between rounded-2xl bg-foreground/[0.04] px-4 py-3">
              <span className="text-sm text-muted-foreground">{receive ? 'Valor a receber' : 'Valor a pagar'}</span>
              <span className="font-num text-lg font-bold">{formatCurrency(amount)}</span>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted-foreground">{receive ? 'Entrou na conta' : 'Pagar com a conta'}</span>
            <div className="flex flex-wrap gap-2">
              {accounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma conta encontrada.</p>
              ) : (
                accounts.map((acc) => (
                  <Chip key={acc.id} active={accountId === acc.id} onClick={() => setAccountId(acc.id)} className="pl-1.5">
                    <AccountAvatar name={acc.name} color={acc.color} icon={acc.icon} className="h-6 w-6 rounded-full text-[10px]" />
                    {acc.name}
                    {acc.id === defaultAccountId && <span className="text-[11px] font-normal opacity-70">· padrão</span>}
                  </Chip>
                ))
              )}
            </div>
          </div>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted-foreground">{receive ? 'Data do recebimento' : 'Data do pagamento'}</span>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={fieldClass} />
          </label>

          <div className="flex gap-3 border-t border-border/60 pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" isLoading={isSubmitting} disabled={accounts.length === 0}>
              {receive ? 'Confirmar recebimento' : 'Confirmar pagamento'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
