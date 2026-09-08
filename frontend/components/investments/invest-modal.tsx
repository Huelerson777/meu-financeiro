'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { investmentsService } from '@/services/investments.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/utils/currency';

const selectClass =
  'h-10 w-full rounded-md border border-border bg-background px-3 text-sm transition-theme focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

interface AccountOption {
  id: string;
  name: string;
  type: string;
  currentBalance?: number | string;
}

interface InvestModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

/**
 * Mesmo fluxo de "Investir" que já existia em Transações (aporte simples ou
 * aporte com ativo vinculado), mas acessível direto da tela de Investimentos
 * — sem precisar passar por Transações pra registrar um aporte.
 */
export function InvestModal({ open, onClose, onCreated }: InvestModalProps) {
  const queryClient = useQueryClient();

  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [accountId, setAccountId] = useState('');
  const [destinationAccountId, setDestinationAccountId] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const [investMode, setInvestMode] = useState<'simple' | 'asset'>('simple');
  // Ativo comprado antes de usar o app: registra só a posição, sem mexer em
  // saldo de nenhuma conta (só faz sentido no modo "Registrar ativo").
  const [alreadyOwned, setAlreadyOwned] = useState(false);
  const [assetCategory, setAssetCategory] = useState<'FIXED_INCOME' | 'STOCK' | 'FUND' | 'CRYPTO' | 'REAL_ESTATE' | 'OTHER'>('FIXED_INCOME');
  const [assetTicker, setAssetTicker] = useState('');
  const [assetQuantity, setAssetQuantity] = useState('');
  const [assetUnitPrice, setAssetUnitPrice] = useState('');
  const [assetIndexer, setAssetIndexer] = useState<'CDI' | 'SELIC' | 'IPCA_PLUS' | 'PREFIXADO'>('CDI');
  const [assetRate, setAssetRate] = useState('');
  const [assetStartDate, setAssetStartDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (!open) return;

    setAccountId('');
    setDestinationAccountId('');
    setDescription('');
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setInvestMode('simple');
    setAlreadyOwned(false);
    setAssetCategory('FIXED_INCOME');
    setAssetTicker('');
    setAssetQuantity('');
    setAssetUnitPrice('');
    setAssetIndexer('CDI');
    setAssetRate('');
    setAssetStartDate(new Date().toISOString().split('T')[0]);

    setLoadingAccounts(true);
    api
      .get('/accounts', { params: { limit: 100 } })
      .then((res) => {
        const list = res.data?.data?.items ?? res.data?.items ?? [];
        setAccounts(list);
        if (list.length > 0) setAccountId(list[0].id);
      })
      .catch(() => setAccounts([]))
      .finally(() => setLoadingAccounts(false));
  }, [open]);

  if (!open) return null;

  const investmentAccounts = accounts.filter((acc) => acc.type === 'INVESTMENT');
  const selectedAccount = accounts.find((acc) => acc.id === accountId);
  const skipTransfer = investMode === 'asset' && alreadyOwned;
  const isStockLike = investMode === 'asset' && (assetCategory === 'STOCK' || assetCategory === 'FUND');
  const stockTotal = Math.round(((parseFloat(assetUnitPrice) || 0) * (parseFloat(assetQuantity) || 0)) * 100) / 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!destinationAccountId || (!skipTransfer && !accountId)) {
      alert(skipTransfer ? 'Selecione a conta de investimento.' : 'Selecione a conta de origem e a conta de destino.');
      return;
    }
    if (!skipTransfer && accountId === destinationAccountId) {
      alert('A conta de origem e destino não podem ser a mesma.');
      return;
    }

    const parsedAmount = isStockLike
      ? Math.round(parseFloat(assetUnitPrice) * parseFloat(assetQuantity) * 100) / 100
      : parseFloat(amount);

    if (investMode === 'asset') {
      if (!description.trim()) {
        alert('Dê um nome pro ativo.');
        return;
      }
      if (assetCategory === 'FIXED_INCOME' && !assetRate) {
        alert('Informe a taxa contratada.');
        return;
      }
      if (isStockLike && (!assetQuantity || !assetUnitPrice)) {
        alert('Informe a quantidade e o preço unitário.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (investMode === 'asset') {
        await investmentsService.createPosition({
          ...(skipTransfer ? {} : { fromAccountId: accountId }),
          toAccountId: destinationAccountId,
          amount: parsedAmount,
          name: description,
          category: assetCategory,
          date,
          ...(assetCategory === 'FIXED_INCOME'
            ? { indexer: assetIndexer, rate: parseFloat(assetRate), startDate: assetStartDate }
            : {}),
          ...(assetCategory === 'STOCK' || assetCategory === 'FUND'
            ? { quantity: parseFloat(assetQuantity), ticker: assetTicker || undefined }
            : {}),
        });
      } else {
        await api.post('/accounts/transfer', {
          fromAccountId: accountId,
          toAccountId: destinationAccountId,
          amount: parsedAmount,
          description: description || 'Aporte de Investimento',
          date: new Date(`${date}T12:00:00.000Z`).toISOString(),
        });
      }

      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      onCreated();
      onClose();
    } catch (err: any) {
      const backendMessage = err.response?.data?.message;
      const formattedError = Array.isArray(backendMessage)
        ? backendMessage.join('\n• ')
        : backendMessage || err.message || 'Erro desconhecido ao registrar o aporte';
      alert(`Erro:\n• ${formattedError}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card text-card-foreground rounded-xl shadow-xl w-full max-w-lg border border-border max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold">Novo aporte</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {skipTransfer
                ? 'Um ativo que você já possuía — só registra a posição, sem mover saldo de nenhuma conta.'
                : 'Um aporte que sai de uma conta e vai para uma conta de investimento.'}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition shrink-0" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
          {investmentAccounts.length === 0 && !loadingAccounts ? (
            <p className="text-sm text-amber-500">
              Você ainda não tem uma conta do tipo "Investimento". Cadastre uma na aba Contas antes de registrar um aporte.
            </p>
          ) : (
            <>
              <div className={`grid gap-3 bg-muted/50 p-3 rounded-lg border border-border ${skipTransfer ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {!skipTransfer && (
                  <div className="flex flex-col gap-1.5">
                    <Label>De (Conta Origem)</Label>
                    <select required value={accountId} onChange={(e) => setAccountId(e.target.value)} className={selectClass}>
                      <option value="">Selecione...</option>
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                      ))}
                    </select>
                    <p className="h-4 text-xs text-muted-foreground truncate">
                      {selectedAccount?.currentBalance !== undefined ? `Saldo: ${formatCurrency(Number(selectedAccount.currentBalance))}` : ''}
                    </p>
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <Label>{skipTransfer ? 'Conta de investimento' : 'Para (Conta Destino)'}</Label>
                  <select required value={destinationAccountId} onChange={(e) => setDestinationAccountId(e.target.value)} className={selectClass}>
                    <option value="">Selecione...</option>
                    {investmentAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>{acc.name}</option>
                    ))}
                  </select>
                  <p className="h-4" />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-1 p-0.5 bg-muted rounded-md w-fit">
                  {(['simple', 'asset'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setInvestMode(mode)}
                      className={`px-3 py-1 text-xs font-medium rounded transition ${
                        investMode === mode ? 'bg-background shadow text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {mode === 'simple' ? 'Aporte simples' : 'Registrar ativo'}
                    </button>
                  ))}
                </div>

                {investMode === 'asset' && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={alreadyOwned}
                      onChange={(e) => setAlreadyOwned(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-border"
                    />
                    Já possuía esse ativo (não mover saldo)
                  </label>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>{investMode === 'asset' ? 'Nome do ativo' : 'Descrição'}</Label>
                <Input
                  type="text"
                  placeholder={investMode === 'asset' ? 'Ex: CDB Banco XP...' : 'Ex: Aporte CDB...'}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {investMode === 'asset' && (
                <div className="flex flex-col gap-3 bg-muted/50 p-3 rounded-lg border border-border">
                  <div className="flex flex-col gap-1.5">
                    <Label>Categoria do ativo</Label>
                    <select
                      className={selectClass}
                      value={assetCategory}
                      onChange={(e) => setAssetCategory(e.target.value as typeof assetCategory)}
                    >
                      <option value="FIXED_INCOME">Renda fixa (CDB, Tesouro, LCI/LCA...)</option>
                      <option value="STOCK">Ação</option>
                      <option value="FUND">Fundo/FII</option>
                      <option value="CRYPTO">Criptomoeda</option>
                      <option value="REAL_ESTATE">Imóvel</option>
                      <option value="OTHER">Outro</option>
                    </select>
                  </div>

                  {assetCategory === 'FIXED_INCOME' ? (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <Label>Indexador</Label>
                        <select
                          className={selectClass}
                          value={assetIndexer}
                          onChange={(e) => setAssetIndexer(e.target.value as typeof assetIndexer)}
                        >
                          <option value="CDI">% do CDI</option>
                          <option value="SELIC">% da Selic</option>
                          <option value="IPCA_PLUS">IPCA + juros</option>
                          <option value="PREFIXADO">Prefixado</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label>{assetIndexer === 'PREFIXADO' ? 'Taxa a.a. (%)' : assetIndexer === 'IPCA_PLUS' ? 'Juros a.a. (%)' : '% do indexador'}</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder={assetIndexer === 'CDI' || assetIndexer === 'SELIC' ? 'Ex: 110' : 'Ex: 6.5'}
                          value={assetRate}
                          onChange={(e) => setAssetRate(e.target.value)}
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label>Início do rendimento</Label>
                        <Input type="date" value={assetStartDate} onChange={(e) => setAssetStartDate(e.target.value)} />
                      </div>
                    </div>
                  ) : assetCategory === 'STOCK' || assetCategory === 'FUND' ? (
                    <div className="flex flex-col gap-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <Label>Ticker (opcional)</Label>
                          <Input
                            type="text"
                            placeholder="Ex: PETR4"
                            value={assetTicker}
                            onChange={(e) => setAssetTicker(e.target.value.toUpperCase())}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label>Quantidade</Label>
                          <Input
                            type="number"
                            step="0.00000001"
                            min="0"
                            placeholder="Ex: 3"
                            value={assetQuantity}
                            onChange={(e) => setAssetQuantity(e.target.value)}
                            required
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label>Preço unitário (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Ex: 7,00"
                            value={assetUnitPrice}
                            onChange={(e) => setAssetUnitPrice(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Total investido: <span className="font-medium text-foreground">{formatCurrency(stockTotal)}</span>
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Sem cotação automática pra essa categoria — o valor atual fica manual, editável a qualquer momento aqui na tela de Investimentos.
                    </p>
                  )}
                </div>
              )}

              <div className={isStockLike ? '' : 'grid grid-cols-2 gap-4'}>
                {!isStockLike && (
                  <div className="flex flex-col gap-1.5">
                    <Label>{skipTransfer ? 'Valor investido (total)' : 'Valor (R$)'}</Label>
                    <Input type="number" step="0.01" required placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <Label>{skipTransfer ? 'Data da compra' : 'Data'}</Label>
                  <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <Button type="button" variant="ghost" onClick={onClose} className="mt-3">
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSubmitting} disabled={investmentAccounts.length === 0} className="mt-3">
              {skipTransfer ? 'Registrar ativo' : 'Lançar aporte'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
