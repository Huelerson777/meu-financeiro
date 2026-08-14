'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/services/api';

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
}

interface CategoryOption {
  id: string;
  name: string;
  color: string;
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
  const [startDate, setStartDate] = useState(() => searchParams.get('startDate') ?? '');
  const [endDate, setEndDate] = useState(() => searchParams.get('endDate') ?? '');
  const [categoryFilter, setCategoryFilter] = useState(() => searchParams.get('categoryId') ?? '');
  const [typeFilter, setTypeFilter] = useState<'' | 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'INVESTMENT'>('');

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
      if (typeFilter) transactionsParams.type = typeFilter;

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
  }, [startDate, endDate, categoryFilter, typeFilter, page]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setEditingTransferId(null);
    setDescription('');
    setAmount('');
    setUiType('EXPENSE');
    setStatus('PAID');
    setCategoryId('');
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

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold dark:text-white">Transações</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Gerencie suas entradas, saídas e movimentações
          </p>
        </div>
        <button
          onClick={() => {
            fetchData();
            handleOpenCreate();
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow transition"
        >
          + Nova Movimentação
        </button>
      </div>

      {/* Filtro de período, tipo e categoria */}
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
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tipo</label>
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value as typeof typeFilter); setPage(1); }}
            className="px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 dark:text-white text-sm"
          >
            <option value="">Todos os tipos</option>
            <option value="INCOME">Receitas</option>
            <option value="EXPENSE">Despesas</option>
            <option value="TRANSFER">Transferências</option>
            <option value="INVESTMENT">Investimentos</option>
          </select>
        </div>
        {(startDate || endDate) && (
          <button
            onClick={() => { setStartDate(''); setEndDate(''); setPage(1); }}
            className="text-sm text-blue-600 hover:underline pb-2"
          >
            Limpar período
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
                const isTransfer = t.type === 'TRANSFER';
                return (
                  <tr key={t.id} className="border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50/50 dark:hover:bg-zinc-800/50 group">
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        isIncome ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                        : isTransfer ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {isIncome ? '↑ Entrada' : isTransfer ? '⇄ Transf.' : '↓ Saída'}
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
                      isTransfer ? 'text-purple-600 dark:text-purple-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {isIncome ? '+ ' : isTransfer ? '' : '- '}
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
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-md p-6 border border-gray-200 dark:border-zinc-800">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold dark:text-white">
                {editingId ? 'Editar Movimentação' : 'Nova Movimentação'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-700 font-bold text-lg">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              
              {!editingId && (
                <div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-1 bg-gray-100 dark:bg-zinc-800 rounded-lg mb-4">
                    <button type="button" onClick={() => setUiType('EXPENSE')} className={`py-2 text-xs font-semibold rounded transition ${uiType === 'EXPENSE' ? 'bg-red-600 text-white shadow' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'}`}>↓ Saída</button>
                    <button type="button" onClick={() => setUiType('INCOME')} className={`py-2 text-xs font-semibold rounded transition ${uiType === 'INCOME' ? 'bg-green-600 text-white shadow' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'}`}>↑ Entrada</button>
                    <button type="button" onClick={() => setUiType('TRANSFER')} className={`py-2 text-xs font-semibold rounded transition ${uiType === 'TRANSFER' ? 'bg-purple-600 text-white shadow' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'}`}>⇄ Transf.</button>
                    <button type="button" onClick={() => setUiType('INVESTMENT')} className={`py-2 text-xs font-semibold rounded transition ${uiType === 'INVESTMENT' ? 'bg-blue-600 text-white shadow' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'}`}>📈 Investir</button>
                  </div>
                </div>
              )}

              {(uiType === 'TRANSFER' || uiType === 'INVESTMENT') ? (
                <div className="grid grid-cols-2 gap-3 bg-gray-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-gray-100 dark:border-zinc-700">
                  <div>
                    <label className="block text-xs font-medium dark:text-gray-300 mb-1">De (Conta Origem)</label>
                    <select required value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-full px-2 py-2 text-sm border border-gray-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-900 dark:text-white">
                      <option value="">Selecione...</option>
                      {accounts.map((acc) => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium dark:text-gray-300 mb-1">Para (Conta Destino)</label>
                    <select required value={destinationAccountId} onChange={(e) => setDestinationAccountId(e.target.value)} className="w-full px-2 py-2 text-sm border border-gray-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-900 dark:text-white">
                      <option value="">Selecione...</option>
                      {uiType === 'INVESTMENT' 
                        ? (investmentAccounts.length > 0 ? investmentAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>) : <option disabled>Crie uma conta de Investimento!</option>)
                        : accounts.map((acc) => <option key={acc.id} value={acc.id}>{acc.name}</option>)
                      }
                    </select>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium dark:text-gray-300 mb-1">Conta Bancária</label>
                  <select required value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 dark:text-white">
                    {accounts.map((acc) => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">Descrição</label>
                <input type="text" placeholder={uiType === 'INVESTMENT' ? 'Ex: Aporte CDB...' : 'Ex: Mercado...'} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-transparent dark:text-white" />
              </div>

              {uiType !== 'TRANSFER' && uiType !== 'INVESTMENT' && (
                <div>
                  <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                    Categoria {uiType === 'EXPENSE' && <span className="text-xs font-normal text-gray-400">(usada no gráfico do Dashboard)</span>}
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 dark:text-white"
                  >
                    <option value="">Sem categoria</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  {categories.length === 0 && (
                    <p className="text-xs text-amber-500 mt-1">
                      Nenhuma categoria encontrada. Saia e entre novamente na sua conta para criar as categorias padrão.
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium dark:text-gray-300 mb-1">Valor (R$)</label>
                  <input type="number" step="0.01" required placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-transparent dark:text-white" />
                </div>
                {uiType !== 'TRANSFER' && uiType !== 'INVESTMENT' && (
                  <div>
                    <label className="block text-sm font-medium dark:text-gray-300 mb-1">Status</label>
                    <select value={status} onChange={(e: any) => setStatus(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 dark:text-white">
                      <option value="PAID">{uiType === 'INCOME' ? 'Recebido' : 'Pago'}</option>
                      <option value="PENDING">Pendente</option>
                    </select>
                  </div>
                )}
                <div className={(uiType === 'TRANSFER' || uiType === 'INVESTMENT') ? "col-span-1" : "col-span-2"}>
                  <label className="block text-sm font-medium dark:text-gray-300 mb-1">Data</label>
                  <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-transparent dark:text-white" />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm text-gray-500 hover:underline">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-2 rounded-lg text-sm font-semibold text-white shadow bg-blue-600 hover:bg-blue-700">
                  {isSubmitting ? 'Salvando...' : 'Confirmar'}
                </button>
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