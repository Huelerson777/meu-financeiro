'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { X, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, TrendingUp } from 'lucide-react';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/utils/currency';

const selectClass =
  'h-10 w-full rounded-md border border-border bg-background px-3 text-sm transition-theme focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

const TYPE_OPTIONS = [
  { value: 'EXPENSE', label: 'Saída', icon: ArrowDownCircle, activeClass: 'bg-danger text-white shadow' },
  { value: 'INCOME', label: 'Entrada', icon: ArrowUpCircle, activeClass: 'bg-success text-white shadow' },
  { value: 'TRANSFER', label: 'Transferência', icon: ArrowLeftRight, activeClass: 'bg-purple-600 text-white shadow' },
  { value: 'INVESTMENT', label: 'Investir', icon: TrendingUp, activeClass: 'bg-primary text-primary-foreground shadow' },
] as const;

const TYPE_FILTER_OPTIONS = [
  { value: 'INCOME', label: 'Receitas' },
  { value: 'EXPENSE', label: 'Despesas' },
  { value: 'TRANSFER', label: 'Transferências' },
  { value: 'INVESTMENT', label: 'Investimentos' },
];

const TYPE_HELP: Record<(typeof TYPE_OPTIONS)[number]['value'], string> = {
  EXPENSE: 'Um gasto que saiu (ou vai sair) de uma conta.',
  INCOME: 'Um valor que entrou (ou vai entrar) em uma conta.',
  TRANSFER: 'Mover dinheiro de uma conta para outra.',
  INVESTMENT: 'Um aporte que sai de uma conta e vai para uma conta de investimento.',
};

interface Transaction {
  id: string;
  description: string;
  amount: number | string;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  status: 'PAID' | 'PENDING' | 'OVERDUE';
  date: string;
  accountId?: string;
  account?: { name: string };
  categoryId?: string | null;
  category?: { name: string; color: string } | null;
  transfer?: { id: string; toId: string; toAccount?: { name: string; type: string } } | null;
}

interface AccountOption {
  id: string;
  name: string;
  type: string;
  currentBalance?: number | string;
}

interface CategoryOption {
  id: string;
  name: string;
  color: string;
}

// Sem filtro nenhum, parcelas de cartão futuras (que podem ir anos à frente)
// dominam o topo da lista por ordenação de data — por isso o período padrão
// é o mês atual, igual o Dashboard já faz. "Limpar período" mostra tudo.
function currentMonthRange() {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return {
    start: fmt(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

function TransactionsPageContent() {
  // Chegando aqui pelo card de categoria do dashboard, a URL já vem com
  // ?categoryId=...&startDate=...&endDate=... — usamos isso como filtro inicial
  const searchParams = useSearchParams();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTransferId, setEditingTransferId] = useState<string | null>(null);

  // Filtro de período, categoria e tipo
  const [startDate, setStartDate] = useState(() => searchParams.get('startDate') ?? currentMonthRange().start);
  const [endDate, setEndDate] = useState(() => searchParams.get('endDate') ?? currentMonthRange().end);
  const [categoryFilter, setCategoryFilter] = useState(() => searchParams.get('categoryId') ?? '');
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [typeFilterOpen, setTypeFilterOpen] = useState(false);
  const typeFilterRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (typeFilterRef.current && !typeFilterRef.current.contains(e.target as Node)) setTypeFilterOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleTypeFilter = (value: string) => {
    setTypeFilters((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
    setPage(1);
  };

  // Descrição e valor filtram com um pequeno atraso (debounce) pra não
  // disparar uma busca a cada tecla digitada.
  const [descriptionInput, setDescriptionInput] = useState('');
  const [descriptionFilter, setDescriptionFilter] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [amountFilter, setAmountFilter] = useState('');

  useEffect(() => {
    const t = setTimeout(() => { setDescriptionFilter(descriptionInput.trim()); setPage(1); }, 500);
    return () => clearTimeout(t);
  }, [descriptionInput]);

  useEffect(() => {
    const t = setTimeout(() => { setAmountFilter(amountInput.trim()); setPage(1); }, 500);
    return () => clearTimeout(t);
  }, [amountInput]);

  // Paginação
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  // Form State
  const [uiType, setUiType] = useState<'INCOME' | 'EXPENSE' | 'TRANSFER' | 'INVESTMENT'>('EXPENSE');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [destinationAccountId, setDestinationAccountId] = useState('');
  const [status, setStatus] = useState<'PAID' | 'PENDING'>('PAID');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Sugestão automática de categoria: só sobrescreve o campo enquanto o
  // valor ali dentro ainda for uma sugestão (não uma escolha manual do usuário).
  const [categoryAutoSuggested, setCategoryAutoSuggested] = useState(false);
  const suggestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    if (suggestTimeoutRef.current) clearTimeout(suggestTimeoutRef.current);

    if ((uiType !== 'EXPENSE' && uiType !== 'INCOME') || value.trim().length < 3) return;

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

  const extractList = (rawResponse: any) => {
    if (!rawResponse) return [];
    if (Array.isArray(rawResponse)) return rawResponse;
    if (Array.isArray(rawResponse.data)) return rawResponse.data;
    if (Array.isArray(rawResponse.items)) return rawResponse.items;
    if (Array.isArray(rawResponse.accounts)) return rawResponse.accounts;
    if (Array.isArray(rawResponse.data?.accounts)) return rawResponse.data.accounts;
    if (Array.isArray(rawResponse.data?.items)) return rawResponse.data.items;
    if (Array.isArray(rawResponse.data?.data)) return rawResponse.data.data;
    return [];
  };

  const extractMeta = (rawResponse: any) => {
    return rawResponse?.data?.meta ?? rawResponse?.meta ?? null;
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      const transactionsParams: Record<string, string | number> = { page, limit: pageSize };
      if (startDate) transactionsParams.startDate = startDate;
      if (endDate) transactionsParams.endDate = endDate;
      if (categoryFilter) transactionsParams.categoryId = categoryFilter;
      if (typeFilters.length > 0) transactionsParams.type = typeFilters.join(',');
      if (descriptionFilter) transactionsParams.search = descriptionFilter;
      if (amountFilter) transactionsParams.amount = amountFilter;

      const [transRes, accRes, catRes] = await Promise.all([
        api.get('/transactions', { params: transactionsParams }).catch(() => ({ data: [] })),
        api.get('/accounts').catch(() => ({ data: [] })),
        api.get('/categories').catch(() => ({ data: [] })),
      ]);

      const transList = extractList(transRes.data);
      const accList = extractList(accRes.data);
      const catList = extractList(catRes.data);
      const transMeta = extractMeta(transRes.data);

      setTransactions(transList);
      setAccounts(accList);
      setCategories(catList);
      setTotalPages(transMeta?.totalPages ?? 1);
      setTotal(transMeta?.total ?? transList.length);

      if (accList.length > 0 && !accountId && !editingId) {
        setAccountId(accList[0].id);
      }
    } catch (err) {
      console.error('Erro geral ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, categoryFilter, typeFilters, descriptionFilter, amountFilter, page]);

  // Gera (de forma idempotente) o lançamento pendente do mês corrente pra
  // cada conta fixa ativa, assim que a tela é aberta.
  useEffect(() => {
    api.post('/recurring-bills/sync').then(() => fetchData()).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenCreate = () => {
    setEditingId(null);
    setEditingTransferId(null);
    setDescription('');
    setAmount('');
    setUiType('EXPENSE');
    setStatus('PAID');
    setCategoryId('');
    setCategoryAutoSuggested(false);
    setDestinationAccountId('');
    setDate(new Date().toISOString().split('T')[0]);
    if (accounts.length > 0) setAccountId(accounts[0].id);
    setIsModalOpen(true);
  };

  const handleEdit = (t: Transaction) => {
    if (t.type === 'TRANSFER') {
      if (!t.transfer?.id) {
        alert(
          'Esta movimentação foi criada antes da atualização do sistema e não guarda o vínculo ' +
          'necessário para edição. Você pode excluí-la e lançar novamente.'
        );
        return;
      }
      setEditingId(t.id);
      setEditingTransferId(t.transfer.id);
      setUiType(t.transfer.toAccount?.type === 'INVESTMENT' ? 'INVESTMENT' : 'TRANSFER');
      setDescription(t.description);
      setAmount(t.amount.toString());
      setStatus('PAID');
      setDate(new Date(t.date).toISOString().split('T')[0]);
      if (t.accountId) setAccountId(t.accountId);
      setDestinationAccountId(t.transfer.toId);
      setCategoryId('');
      setCategoryAutoSuggested(false);
      setIsModalOpen(true);
      return;
    }

    setEditingId(t.id);
    setEditingTransferId(null);
    setDescription(t.description);
    setAmount(t.amount.toString());
    setUiType(t.type);
    setStatus(t.status as any);
    setDate(new Date(t.date).toISOString().split('T')[0]);
    if (t.accountId) setAccountId(t.accountId);
    setCategoryId(t.categoryId || '');
    setCategoryAutoSuggested(false);
    setIsModalOpen(true);
  };

  const handleDelete = async (t: Transaction) => {
    if (!window.confirm(`Tem certeza que deseja excluir a transação "${t.description}"?`)) return;
    try {
      if (t.type === 'TRANSFER') {
        if (!t.transfer?.id) {
          alert(
            'Esta movimentação foi criada antes da atualização do sistema e não guarda o vínculo ' +
            'necessário para exclusão automática do saldo. Ajuste o saldo manualmente se precisar removê-la.'
          );
          return;
        }
        await api.delete(`/accounts/transfer/${t.transfer.id}`);
      } else {
        await api.delete(`/transactions/${t.id}`);
      }
      fetchData();
    } catch (err: any) {
      alert('Erro ao excluir transação.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!accountId) {
      alert('Selecione a conta de origem.');
      return;
    }

    setIsSubmitting(true);

    try {
      const parsedAmount = parseFloat(amount);
      const isoDate = new Date(`${date}T12:00:00.000Z`).toISOString();

      if (uiType === 'TRANSFER' || uiType === 'INVESTMENT') {
        if (!destinationAccountId) {
          alert('Selecione a conta de destino.');
          setIsSubmitting(false);
          return;
        }
        if (accountId === destinationAccountId) {
          alert('A conta de origem e destino não podem ser a mesma.');
          setIsSubmitting(false);
          return;
        }

        const transferPayload = {
          fromAccountId: accountId,
          toAccountId: destinationAccountId,
          amount: parsedAmount,
          description: description || (uiType === 'INVESTMENT' ? 'Aporte de Investimento' : 'Transferência entre contas'),
        };

        if (editingTransferId) {
          await api.patch(`/accounts/transfer/${editingTransferId}`, { ...transferPayload, date: isoDate });
        } else {
          await api.post('/accounts/transfer', transferPayload);
        }
      } else {
        const payload = {
          description,
          amount: parsedAmount,
          type: uiType,
          accountId,
          categoryId: categoryId || undefined,
          status,
          date: isoDate,
        };

        if (editingId) {
          await api.patch(`/transactions/${editingId}`, payload);
        } else {
          await api.post('/transactions', payload);
        }
      }

      setIsModalOpen(false);
      setEditingId(null);
      setEditingTransferId(null);
      fetchData();
    } catch (err: any) {
      // LOGS DETALHADOS ADICIONADOS AQUI 👇
      console.error("🚨 ERRO COMPLETO DO BACKEND:", err);
      console.error("🚨 RESPOSTA DA API:", err.response?.data);
      
      const backendMessage = err.response?.data?.message;
      const formattedError = Array.isArray(backendMessage)
        ? backendMessage.join('\n• ')
        : backendMessage || err.message || 'Erro desconhecido ao salvar transação';
      
      alert(`Erro crítico:\n• ${formattedError}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const investmentAccounts = accounts.filter(acc => acc.type === 'INVESTMENT');
  const selectedAccount = accounts.find((acc) => acc.id === accountId);

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold dark:text-white">Transações</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Gerencie suas entradas, saídas e movimentações
          </p>
        </div>
        <Button
          onClick={() => {
            fetchData();
            handleOpenCreate();
          }}
        >
          + Nova Movimentação
        </Button>
      </div>

      {/* Filtro de período, tipo, categoria, descrição e valor */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow border border-gray-100 dark:border-zinc-800 p-4 mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">De</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-transparent dark:text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Até</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-transparent dark:text-white text-sm"
          />
        </div>
        <div className="relative" ref={typeFilterRef}>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tipo</label>
          <button
            type="button"
            onClick={() => setTypeFilterOpen((o) => !o)}
            className="px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 dark:text-white text-sm min-w-[10rem] text-left"
          >
            {typeFilters.length === 0
              ? 'Todos os tipos'
              : TYPE_FILTER_OPTIONS.filter((o) => typeFilters.includes(o.value)).map((o) => o.label).join(', ')}
          </button>
          {typeFilterOpen && (
            <div className="absolute z-40 mt-1 w-48 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 shadow-lg">
              {TYPE_FILTER_OPTIONS.map((o) => (
                <label key={o.value} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer dark:text-white">
                  <input
                    type="checkbox"
                    checked={typeFilters.includes(o.value)}
                    onChange={() => toggleTypeFilter(o.value)}
                    className="h-4 w-4 rounded border-border"
                  />
                  {o.label}
                </label>
              ))}
              {typeFilters.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setTypeFilters([]); setPage(1); }}
                  className="mt-1 w-full text-left text-xs text-blue-600 hover:underline px-2 py-1"
                >
                  Limpar tipos
                </button>
              )}
            </div>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Descrição</label>
          <input
            type="text"
            placeholder="Buscar por descrição..."
            value={descriptionInput}
            onChange={(e) => setDescriptionInput(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-transparent dark:text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Valor</label>
          <input
            type="number"
            step="0.01"
            placeholder="Ex: 100,00"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-transparent dark:text-white text-sm w-32"
          />
        </div>
        {(startDate || endDate) && (
          <button
            onClick={() => { setStartDate(''); setEndDate(''); setPage(1); }}
            className="text-sm text-blue-600 hover:underline pb-2"
          >
            Limpar período
          </button>
        )}
        {(descriptionInput || amountInput) && (
          <button
            onClick={() => { setDescriptionInput(''); setAmountInput(''); setPage(1); }}
            className="text-sm text-blue-600 hover:underline pb-2"
          >
            Limpar busca
          </button>
        )}
        {categoryFilter && (
          <div className="flex items-center gap-2 pb-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
              Categoria: {categories.find((c) => c.id === categoryFilter)?.name ?? '...'}
            </span>
            <button
              onClick={() => { setCategoryFilter(''); setPage(1); }}
              className="text-sm text-blue-600 hover:underline"
            >
              Limpar categoria
            </button>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow border border-gray-100 dark:border-zinc-800 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Carregando transações...</div>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            Nenhuma transação registrada ainda.
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50">
                <th className="p-4 font-semibold dark:text-gray-200">Tipo</th>
                <th className="p-4 font-semibold dark:text-gray-200">Descrição</th>
                <th className="p-4 font-semibold dark:text-gray-200">Conta</th>
                <th className="p-4 font-semibold dark:text-gray-200">Data</th>
                <th className="p-4 font-semibold dark:text-gray-200">Status</th>
                <th className="p-4 font-semibold text-right dark:text-gray-200">Valor</th>
                <th className="p-4 font-semibold text-center dark:text-gray-200">Ações</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => {
                const isIncome = t.type === 'INCOME';
                // Investimento não é um TransactionType próprio — é uma TRANSFER cuja
                // conta de destino é do tipo INVESTMENT (mesma regra usada no backend
                // e no filtro de tipo). Sem esse check, todo investimento aparecia
                // rotulado como "Transferência" na lista.
                const isInvestment = t.type === 'TRANSFER' && t.transfer?.toAccount?.type === 'INVESTMENT';
                const isTransfer = t.type === 'TRANSFER' && !isInvestment;
                return (
                  <tr key={t.id} className="border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50/50 dark:hover:bg-zinc-800/50 group">
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        isIncome ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : isInvestment ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                        : isTransfer ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {isIncome ? '↑ Entrada' : isInvestment ? '📈 Investir' : isTransfer ? '⇄ Transf.' : '↓ Saída'}
                      </span>
                    </td>
                    <td className="p-4 dark:text-gray-200 font-medium">
                      {t.description}
                      {t.category && (
                        <span
                          className="ml-2 inline-flex items-center text-xs font-normal px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${t.category.color}20`, color: t.category.color }}
                        >
                          {t.category.name}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-gray-500 dark:text-gray-400 text-sm">{t.account?.name || '-'}</td>
                    <td className="p-4 text-gray-500 dark:text-gray-400 text-sm">{new Date(t.date).toLocaleDateString('pt-BR')}</td>
                    <td className="p-4">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        t.status === 'PAID' 
                          ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' 
                          : 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
                      }`}>
                        {t.status === 'PAID' ? 'Feito' : 'Pendente'}
                      </span>
                    </td>
                    <td className={`p-4 text-right font-semibold text-lg ${
                      isIncome ? 'text-green-600 dark:text-green-400' :
                      isInvestment ? 'text-blue-600 dark:text-blue-400' :
                      isTransfer ? 'text-purple-600 dark:text-purple-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {isIncome ? '+ ' : isTransfer || isInvestment ? '' : '- '}
                      {Number(t.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(t)} className="text-blue-500 hover:text-blue-700 text-sm font-medium">
                          Editar
                        </button>
                        <button onClick={() => handleDelete(t)} className="text-red-500 hover:text-red-700 text-sm font-medium">
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {!loading && transactions.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {total} {total === 1 ? 'transação' : 'transações'} · página {page} de {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-zinc-800 dark:text-white"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-zinc-800 dark:text-white"
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card text-card-foreground rounded-xl shadow-xl w-full max-w-lg border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-border">
              <div>
                <h2 className="text-lg font-semibold">
                  {editingId ? 'Editar Movimentação' : 'Nova Movimentação'}
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">{TYPE_HELP[uiType]}</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground transition shrink-0"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">

              {!editingId && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1 bg-muted rounded-lg">
                  {TYPE_OPTIONS.map(({ value, label, icon: Icon, activeClass }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setUiType(value)}
                      className={`flex flex-col items-center gap-1 py-2.5 text-xs font-semibold rounded-md transition ${
                        uiType === value ? activeClass : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {(uiType === 'TRANSFER' || uiType === 'INVESTMENT') ? (
                <div className="grid grid-cols-2 gap-3 bg-muted/50 p-3 rounded-lg border border-border">
                  <div className="flex flex-col gap-1.5">
                    <Label>De (Conta Origem)</Label>
                    <select required value={accountId} onChange={(e) => setAccountId(e.target.value)} className={selectClass}>
                      <option value="">Selecione...</option>
                      {accounts.map((acc) => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                    </select>
                    {/* Altura fixa reservada — evita o campo "pular" quando o saldo
                        chega depois do fetch de contas (era o bug relatado). */}
                    <p className="h-4 text-xs text-muted-foreground truncate">
                      {selectedAccount?.currentBalance !== undefined ? `Saldo: ${formatCurrency(Number(selectedAccount.currentBalance))}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Para (Conta Destino)</Label>
                    <select required value={destinationAccountId} onChange={(e) => setDestinationAccountId(e.target.value)} className={selectClass}>
                      <option value="">Selecione...</option>
                      {uiType === 'INVESTMENT'
                        ? (investmentAccounts.length > 0 ? investmentAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>) : <option disabled>Crie uma conta de Investimento!</option>)
                        : accounts.map((acc) => <option key={acc.id} value={acc.id}>{acc.name}</option>)
                      }
                    </select>
                    <p className="h-4" />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <Label>Conta Bancária</Label>
                  <select required value={accountId} onChange={(e) => setAccountId(e.target.value)} className={selectClass}>
                    {accounts.map((acc) => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                  </select>
                  <p className="h-4 text-xs text-muted-foreground truncate">
                    {selectedAccount?.currentBalance !== undefined ? `Saldo atual: ${formatCurrency(Number(selectedAccount.currentBalance))}` : ''}
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label>Descrição</Label>
                <Input
                  type="text"
                  placeholder={uiType === 'INVESTMENT' ? 'Ex: Aporte CDB...' : 'Ex: Mercado...'}
                  value={description}
                  onChange={(e) => handleDescriptionChange(e.target.value)}
                />
              </div>

              {uiType !== 'TRANSFER' && uiType !== 'INVESTMENT' && (
                <div className="flex flex-col gap-1.5">
                  <Label className="flex flex-wrap items-center gap-1 font-medium">
                    Categoria
                    {uiType === 'EXPENSE' && <span className="text-xs font-normal text-muted-foreground">(usada no gráfico do Dashboard)</span>}
                    {categoryAutoSuggested && categoryId && (
                      <span className="text-xs font-normal text-primary">· sugerida</span>
                    )}
                  </Label>
                  <select
                    value={categoryId}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Sem categoria</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  {categories.length === 0 && (
                    <p className="text-xs text-amber-500">
                      Nenhuma categoria encontrada. Saia e entre novamente na sua conta para criar as categorias padrão.
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Valor (R$)</Label>
                  <Input type="number" step="0.01" required placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Data</Label>
                  <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
              </div>

              {uiType !== 'TRANSFER' && uiType !== 'INVESTMENT' && (
                <div className="flex flex-col gap-1.5">
                  <Label>Status</Label>
                  <div className="flex gap-2 p-1 bg-muted rounded-lg w-fit">
                    <button
                      type="button"
                      onClick={() => setStatus('PAID')}
                      className={`px-4 py-1.5 text-xs font-semibold rounded-md transition ${
                        status === 'PAID' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {uiType === 'INCOME' ? 'Recebido' : 'Pago'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus('PENDING')}
                      className={`px-4 py-1.5 text-xs font-semibold rounded-md transition ${
                        status === 'PENDING' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Pendente
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2 border-t border-border">
                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} className="mt-3">
                  Cancelar
                </Button>
                <Button type="submit" isLoading={isSubmitting} className="mt-3">
                  {editingId ? 'Salvar alterações' : 'Lançar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={null}>
      <TransactionsPageContent />
    </Suspense>
  );
}