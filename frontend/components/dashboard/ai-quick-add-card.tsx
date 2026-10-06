'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/services/api';
import { useAccounts } from '@/hooks/use-accounts';
import { formatCurrency } from '@/utils/currency';

interface CategoryOption {
  id: string;
  name: string;
}

interface CardOption {
  id: string;
  name: string;
}

type DraftType = 'EXPENSE' | 'INCOME' | 'TRANSFER' | 'INVESTMENT';

interface Draft {
  type: DraftType;
  description: string;
  amount: number;
  date: string;
  status: 'PAID' | 'PENDING';
  accountId?: string;
  toAccountId?: string;
  cardId?: string;
  installmentsCount?: number;
  categoryId?: string;
}

const TYPE_OPTIONS: { value: DraftType; label: string }[] = [
  { value: 'EXPENSE', label: 'Despesa' },
  { value: 'INCOME', label: 'Receita' },
  { value: 'TRANSFER', label: 'Transferência' },
  { value: 'INVESTMENT', label: 'Investir' },
];

const selectClass =
  'h-11 w-full rounded-md border border-input bg-card px-3 text-sm transition-theme focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30';

export function AiQuickAddCard({ onSuccess }: { onSuccess?: () => void }) {
  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [target, setTarget] = useState<'account' | 'card'>('account');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [cards, setCards] = useState<CardOption[]>([]);
  const { data: accountsData } = useAccounts();
  const accounts = accountsData?.items ?? [];
  const investmentAccounts = accounts.filter((a) => a.type === 'INVESTMENT');

  useEffect(() => {
    api.get('/categories').then((res) => {
      const raw = res.data;
      setCategories(Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : []);
    }).catch(() => setCategories([]));

    api.get('/cards').then((res) => {
      const raw = res.data;
      setCards(Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : []);
    }).catch(() => setCards([]));
  }, []);

  useEffect(() => {
    if (successMessage) {
      const t = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [successMessage]);

  const handleInterpret = async () => {
    if (text.trim().length < 3) return;
    setParsing(true);
    setParseError(null);
    try {
      const res = await api.post('/transactions/parse', { text });
      const parsed: Draft = res.data?.data ?? res.data;
      setDraft(parsed);
      setTarget(parsed.cardId ? 'card' : 'account');
    } catch (err: any) {
      const msg = err.response?.data?.message;
      setParseError(Array.isArray(msg) ? msg.join('\n') : msg || 'Não consegui interpretar esse texto.');
    } finally {
      setParsing(false);
    }
  };

  const handleCancel = () => {
    setDraft(null);
    setParseError(null);
    setSubmitError(null);
  };

  const handleSubmit = async () => {
    if (!draft) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (draft.type === 'TRANSFER' || draft.type === 'INVESTMENT') {
        if (!draft.accountId) throw new Error('Selecione a conta de origem.');
        if (!draft.toAccountId) throw new Error('Selecione a conta de destino.');
        if (draft.accountId === draft.toAccountId) throw new Error('A conta de origem e destino não podem ser a mesma.');
        await api.post('/accounts/transfer', {
          fromAccountId: draft.accountId,
          toAccountId: draft.toAccountId,
          amount: draft.amount,
          description: draft.description || (draft.type === 'INVESTMENT' ? 'Aporte de Investimento' : 'Transferência entre contas'),
        });
      } else if (target === 'card') {
        if (!draft.cardId) throw new Error('Selecione um cartão.');
        await api.post(`/cards/${draft.cardId}/purchases`, {
          description: draft.description,
          totalAmount: draft.amount,
          installmentsCount: draft.installmentsCount || 1,
          purchaseDate: draft.date,
          categoryId: draft.categoryId || undefined,
        });
      } else {
        if (!draft.accountId) throw new Error('Selecione uma conta.');
        await api.post('/transactions', {
          accountId: draft.accountId,
          categoryId: draft.categoryId || undefined,
          type: draft.type,
          description: draft.description,
          amount: draft.amount,
          status: draft.status,
          date: `${draft.date}T12:00:00.000Z`,
        });
      }

      setSuccessMessage(`✅ Lançado: ${draft.description} — ${formatCurrency(draft.amount)}`);
      setDraft(null);
      setText('');
      onSuccess?.();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message;
      setSubmitError(Array.isArray(msg) ? msg.join('\n') : msg || 'Erro ao lançar transação.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.07] via-card to-card">
      <CardHeader className="flex-row items-center gap-3 space-y-0 pb-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_6px_14px_-6px_hsl(var(--primary)/0.6)]">
          <Sparkles className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <CardTitle className="text-base">Lançamento por IA</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">Escreva como você falaria e confirme antes de lançar.</p>
        </div>
      </CardHeader>
      <CardContent>
        {!draft ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex-1">
                <Input
                  className="h-12 bg-card text-base"
                  placeholder="Ex: mercado 85,90 ontem no nubank"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleInterpret()}
                  disabled={parsing}
                />
              </div>
              <Button size="lg" onClick={handleInterpret} isLoading={parsing} disabled={text.trim().length < 3}>
                Interpretar
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {['Almoço 32,90 hoje', 'Salário 6500 ontem', 'Uber 22,50 no cartão'].map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setText(example)}
                  className="rounded-full border border-border/70 bg-card px-3 py-1 text-xs text-muted-foreground transition-theme hover:border-primary/40 hover:text-foreground active:scale-95"
                >
                  {example}
                </button>
              ))}
            </div>
            {parseError && <p className="text-sm text-danger">{parseError}</p>}
            {successMessage && <p className="text-sm font-medium text-success">{successMessage}</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex w-fit gap-1 rounded-xl bg-muted p-1">
              {TYPE_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDraft({ ...draft, type: value })}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
                    draft.type === value ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <Input
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="Descrição"
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number"
                step="0.01"
                value={draft.amount}
                onChange={(e) => setDraft({ ...draft, amount: parseFloat(e.target.value) || 0 })}
              />
              <Input
                type="date"
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              />
            </div>

            {draft.type === 'TRANSFER' || draft.type === 'INVESTMENT' ? (
              <div className="grid grid-cols-2 gap-3">
                <select
                  className={selectClass}
                  value={draft.accountId ?? ''}
                  onChange={(e) => setDraft({ ...draft, accountId: e.target.value || undefined })}
                >
                  <option value="">De (origem)</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <select
                  className={selectClass}
                  value={draft.toAccountId ?? ''}
                  onChange={(e) => setDraft({ ...draft, toAccountId: e.target.value || undefined })}
                >
                  <option value="">Para (destino)</option>
                  {(draft.type === 'INVESTMENT' ? investmentAccounts : accounts).map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <>
                <div className="flex w-fit gap-1 rounded-xl bg-muted p-1">
                  {(['account', 'card'] as const).map((tgt) => (
                    <button
                      key={tgt}
                      type="button"
                      onClick={() => setTarget(tgt)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
                        target === tgt ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {tgt === 'account' ? 'Conta' : 'Cartão'}
                    </button>
                  ))}
                </div>

                {target === 'account' ? (
                  <select
                    className={selectClass}
                    value={draft.accountId ?? ''}
                    onChange={(e) => setDraft({ ...draft, accountId: e.target.value || undefined })}
                  >
                    <option value="">Selecione a conta</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      className={selectClass}
                      value={draft.cardId ?? ''}
                      onChange={(e) => setDraft({ ...draft, cardId: e.target.value || undefined })}
                    >
                      <option value="">Selecione o cartão</option>
                      {cards.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      min={1}
                      max={48}
                      value={draft.installmentsCount ?? 1}
                      onChange={(e) => setDraft({ ...draft, installmentsCount: parseInt(e.target.value, 10) || 1 })}
                      placeholder="Nº de parcelas"
                    />
                  </div>
                )}

                <select
                  className={selectClass}
                  value={draft.categoryId ?? ''}
                  onChange={(e) => setDraft({ ...draft, categoryId: e.target.value || undefined })}
                >
                  <option value="">Sem categoria</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </>
            )}

            {submitError && <p className="text-sm text-danger">{submitError}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={handleCancel} disabled={submitting}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} isLoading={submitting}>
                Lançar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
