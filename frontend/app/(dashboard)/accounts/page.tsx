'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/services/api';
import { formatCurrency } from '@/utils/currency';

interface Account {
  id: string;
  name: string;
  type: string;
  initialBalance?: number | string;
  currentBalance?: number | string;
  color?: string;
  icon?: string;
  includeInDashboard: boolean;
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CHECKING: 'Conta Corrente',
  SAVINGS: 'Poupança',
  WALLET: 'Carteira',
  CASH: 'Dinheiro Espécie',
  INVESTMENT: 'Investimento',
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState('CHECKING');
  const [initialBalance, setInitialBalance] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [includeInDashboard, setIncludeInDashboard] = useState(true);

  const extractList = (rawResponse: any): Account[] => {
    if (!rawResponse) return [];
    if (Array.isArray(rawResponse)) return rawResponse;
    if (Array.isArray(rawResponse.data)) return rawResponse.data;
    if (Array.isArray(rawResponse.items)) return rawResponse.items;
    if (Array.isArray(rawResponse.data?.items)) return rawResponse.data.items;
    return [];
  };

  const fetchAccounts = async () => {
    try {
      const response = await api.get('/accounts');
      const list = extractList(response.data);
      setAccounts(list);
    } catch (err: any) {
      console.error('Erro ao buscar contas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAccounts(); }, []);

  const handleOpenCreate = () => {
    setEditingId(null);
    setName('');
    setType('CHECKING');
    setInitialBalance('');
    setColor('#3b82f6');
    setIncludeInDashboard(true);
    setIsModalOpen(true);
  };

  const handleEdit = (acc: Account) => {
    setEditingId(acc.id);
    setName(acc.name);
    setType(acc.type);
    // No modo edição este campo representa o saldo ATUAL (não o inicial da
    // criação) — é o que aparece na aba Contas e no Saldo Geral.
    setInitialBalance((acc.currentBalance ?? acc.initialBalance)?.toString() || '0');
    setColor(acc.color || '#3b82f6');
    setIncludeInDashboard(acc.includeInDashboard ?? true);
    setIsModalOpen(true);
  };

  // ITEM 6 — Toggle rápido de "controle de saldo" direto no card, sem abrir modal
  const handleToggleDashboard = async (acc: Account) => {
    const newValue = !acc.includeInDashboard;
    // Atualiza otimisticamente na UI
    setAccounts((prev) =>
      prev.map((a) => (a.id === acc.id ? { ...a, includeInDashboard: newValue } : a))
    );
    try {
      await api.patch(`/accounts/${acc.id}`, { includeInDashboard: newValue });
    } catch (err) {
      // Reverte se der erro
      setAccounts((prev) =>
        prev.map((a) => (a.id === acc.id ? { ...a, includeInDashboard: !newValue } : a))
      );
      alert('Erro ao atualizar preferência da conta.');
    }
  };

  const handleArchive = async (id: string, accountName: string) => {
    if (!window.confirm(`Tem certeza que deseja remover a conta "${accountName}"?`)) return;
    try {
      await api.delete(`/accounts/${id}`);
      fetchAccounts();
    } catch {
      alert('Erro ao arquivar a conta.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const balanceValue = parseFloat(initialBalance || '0');
      const payload = editingId
        ? {
            name,
            type,
            // Correção direta do saldo atual — initialBalance não muda aqui,
            // ele só faz sentido no momento da criação da conta.
            currentBalance: balanceValue,
            color: color || '#3b82f6',
            includeInDashboard,
          }
        : {
            name,
            type,
            initialBalance: balanceValue,
            color: color || '#3b82f6',
            includeInDashboard, // ITEM 1 — enviado ao backend
          };

      if (editingId) {
        await api.patch(`/accounts/${editingId}`, payload);
      } else {
        await api.post('/accounts', payload);
      }

      setIsModalOpen(false);
      setEditingId(null);
      await fetchAccounts();
    } catch (err: any) {
      const backendMessage = err.response?.data?.message;
      const formattedError = Array.isArray(backendMessage)
        ? backendMessage.join('\n• ')
        : backendMessage || 'Erro ao salvar conta';
      alert(`Erro no servidor:\n• ${formattedError}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold dark:text-white">Minhas Contas</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Gerencie seus saldos, carteiras e instituições
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition shadow"
        >
          + Nova Conta
        </button>
      </div>

      {/* Legenda */}
      <div className="mb-4 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span className="inline-block w-3 h-3 rounded-full bg-blue-500"></span>
        Contas marcadas com{' '}
        <strong className="text-gray-700 dark:text-gray-200">Controle de Saldo</strong>{' '}
        entram no <strong className="text-gray-700 dark:text-gray-200">Saldo Geral</strong> do Dashboard
      </div>

      {loading ? (
        <div className="text-gray-500 py-8">Carregando contas...</div>
      ) : accounts.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-lg shadow text-center text-gray-500 dark:text-gray-400">
          Nenhuma conta cadastrada ainda.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow border border-gray-100 dark:border-zinc-800 relative overflow-hidden group"
            >
              {/* Barra de cor no topo */}
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ backgroundColor: acc.color || '#3b82f6' }}
              />

              {/* Botões Editar / Excluir (hover) */}
              <div className="absolute top-4 right-4 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleEdit(acc)}
                  className="text-gray-400 hover:text-blue-500 text-sm font-medium"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleArchive(acc.id, acc.name)}
                  className="text-gray-400 hover:text-red-500 text-sm font-medium"
                >
                  Excluir
                </button>
              </div>

              <span className="text-xs uppercase font-bold tracking-wider text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">
                {ACCOUNT_TYPE_LABELS[acc.type] ?? acc.type}
              </span>
              <h3 className="text-xl font-bold mt-3 dark:text-white">{acc.name}</h3>
              <p className="text-2xl font-semibold mt-2 text-green-600 dark:text-green-400">
                {formatCurrency(acc.currentBalance ?? acc.initialBalance)}
              </p>

              {/* ITEM 6 — Botão toggle "Utilizar para controle de saldo" */}
              <button
                onClick={() => handleToggleDashboard(acc)}
                title={
                  acc.includeInDashboard
                    ? 'Clique para remover do Saldo Geral'
                    : 'Clique para incluir no Saldo Geral'
                }
                className={`mt-4 flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                  acc.includeInDashboard
                    ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-600 dark:text-blue-300'
                    : 'bg-gray-100 border-gray-300 text-gray-400 dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-500'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    acc.includeInDashboard ? 'bg-blue-500' : 'bg-gray-400'
                  }`}
                />
                {acc.includeInDashboard ? 'No controle de saldo' : 'Fora do saldo geral'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal Criar / Editar */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-md p-6 border border-gray-200 dark:border-zinc-800">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold dark:text-white">
                {editingId ? 'Editar Conta' : 'Nova Conta Bancária'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">Nome da Conta</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Itaú, Nubank, Carteira..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-transparent dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">Tipo de Conta</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="CHECKING">Conta Corrente</option>
                  <option value="SAVINGS">Poupança</option>
                  <option value="WALLET">Carteira</option>
                  <option value="CASH">Dinheiro Espécie</option>
                  <option value="INVESTMENT">Investimento</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">
                  {editingId ? 'Saldo Atual (R$)' : 'Saldo Inicial (R$)'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-transparent dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {editingId && (
                  <p className="text-xs text-gray-400 mt-1">
                    Corrige o saldo desta conta diretamente — use se o valor mostrado estiver divergente do real.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">Cor</label>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full h-10 p-1 border border-gray-300 dark:border-zinc-700 rounded-lg bg-transparent cursor-pointer"
                />
              </div>

              {/* ITEM 1 — Toggle "Utilizar para controle de saldo" no modal */}
              <div className="flex items-start gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setIncludeInDashboard(!includeInDashboard)}
                  className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    includeInDashboard ? 'bg-blue-600' : 'bg-gray-300 dark:bg-zinc-600'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      includeInDashboard ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
                <div>
                  <p className="text-sm font-medium dark:text-gray-200">
                    Utilizar para controle de saldo
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {includeInDashboard
                      ? 'Esta conta entra no Saldo Geral do Dashboard.'
                      : 'Esta conta NÃO aparece no Saldo Geral (ex: conta de investimentos separada).'}
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-500 hover:underline"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Criar Conta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
