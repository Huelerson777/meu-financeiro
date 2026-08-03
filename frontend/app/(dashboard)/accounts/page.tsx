'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/services/api';

interface Account {
  id: string;
  name: string;
  type: string;
  initialBalance?: number | string;
  currentBalance?: number | string;
  color?: string;
  icon?: string;
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estado para controlar se estamos editando ou criando
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState('CHECKING');
  const [initialBalance, setInitialBalance] = useState('');
  const [color, setColor] = useState('#3b82f6');

  const extractList = (rawResponse: any): Account[] => {
    if (!rawResponse) return [];
    if (Array.isArray(rawResponse)) return rawResponse;
    if (Array.isArray(rawResponse.data)) return rawResponse.data;
    if (Array.isArray(rawResponse.items)) return rawResponse.items;
    if (Array.isArray(rawResponse.accounts)) return rawResponse.accounts;
    if (Array.isArray(rawResponse.data?.accounts)) return rawResponse.data.accounts;
    if (Array.isArray(rawResponse.data?.items)) return rawResponse.data.items;
    return [];
  };

  const fetchAccounts = async () => {
    try {
      const response = await api.get('/accounts');
      const list = extractList(response.data);
      setAccounts(list);
    } catch (err: any) {
      console.error('❌ Erro ao buscar contas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  // Abrir modal para Criar Nova Conta
  const handleOpenCreate = () => {
    setEditingId(null);
    setName('');
    setType('CHECKING');
    setInitialBalance('');
    setColor('#3b82f6');
    setIsModalOpen(true);
  };

  // Abrir modal para Editar Conta Existente
  const handleEdit = (acc: Account) => {
    setEditingId(acc.id);
    setName(acc.name);
    setType(acc.type);
    setInitialBalance(acc.initialBalance?.toString() || '0');
    setColor(acc.color || '#3b82f6');
    setIsModalOpen(true);
  };

  // Arquivar Conta (Soft Delete)
  const handleArchive = async (id: string, accountName: string) => {
    if (!window.confirm(`Tem certeza que deseja remover a conta "${accountName}"?`)) return;

    try {
      await api.delete(`/accounts/${id}`);
      fetchAccounts();
    } catch (err: any) {
      alert('Erro ao arquivar a conta.');
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        name,
        type,
        initialBalance: parseFloat(initialBalance || '0'),
        color: color || '#3b82f6',
      };

      if (editingId) {
        // Modo Edição (PATCH)
        await api.patch(`/accounts/${editingId}`, payload);
      } else {
        // Modo Criação (POST)
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

      {loading ? (
        <div className="text-gray-500 py-8">Carregando contas...</div>
      ) : accounts.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-lg shadow text-center text-gray-500 dark:text-gray-400">
          Nenhuma conta cadastrada ainda.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {accounts.map((acc) => (
            <div 
              key={acc.id} 
              className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow border border-gray-100 dark:border-zinc-800 relative overflow-hidden group"
            >
              <div 
                className="absolute top-0 left-0 right-0 h-1" 
                style={{ backgroundColor: acc.color || '#3b82f6' }}
              />
              
              {/* Botões de Ação (Aparecem no hover ou em telas menores) */}
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
                {acc.type}
              </span>
              <h3 className="text-xl font-bold mt-3 dark:text-white">{acc.name}</h3>
              <p className="text-2xl font-semibold mt-2 text-green-600 dark:text-green-400">
                {Number(acc.currentBalance ?? acc.initialBalance ?? 0).toLocaleString('pt-BR', { 
                  style: 'currency', 
                  currency: 'BRL' 
                })}
              </p>
            </div>
          ))}
        </div>
      )}

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
                <label className="block text-sm font-medium dark:text-gray-300 mb-1">Saldo Inicial (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-transparent dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
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